// FocusArx service worker — production caching strategy with deployment
// skew protection.
//
// Key features:
// - Precache the app shell (index.html + manifest + icons) on install.
// - Network-first for navigations and static files, falling back to cache when
//   offline; cache-first for immutable hashed /assets/*.
// - Never cache /api/* (authenticated data must stay fresh).
// - Version-aware cache: each worker version gets its own cache namespace, and
//   activate() purges every older namespace, so stale JS chunks cannot survive a
//   deployment.
// - Supports CLEAR_CACHE messages from the frontend (reloadCoordinator) when
//   deployment skew or a stale chunk is detected, triggering a full cache purge
//   before the page reloads.
//
// Bump SW_VERSION when the service worker logic itself changes — this forces the
// browser to install the new worker and purge old caches.
//
// v9 fixes the two behaviours that made "refresh to update" fail:
//   • navigations used to be cached under a single key ("/"), so /dashboard's
//     response overwrote the homepage entry and the offline fallback could
//     serve the wrong route. Entries are now keyed by their own URL.
//   • /assets/* only checked `resp.ok`, so an HTML error page served in place
//     of a missing chunk (the old catch-all rewrite) was cached as JavaScript
//     and replayed forever. The content type is now verified as well.

const SW_VERSION = "focusarx-sw-v9";
const CACHE_NAME = SW_VERSION;

const APP_SHELL = [
  "/",
  "/manifest.json",
  "/favicon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/icon-180.png",
];

// Never cache these paths: per-user data, the deployment beacon, and this file.
const NEVER_CACHE = ["/sw.js", "/api/"];

/**
 * True when a response is safe to cache.
 *
 * `resp.ok` alone is not enough: an HTML document served where a module was
 * requested (the failure mode behind "have to keep reloading to load a feature")
 * is a 200, and once cached under an asset URL it outlives every reload.
 */
function isCacheableResponse(resp, expectedType) {
  if (!resp || !resp.ok) return false;
  if (resp.type === "opaqueredirect" || resp.type === "error") return false;

  const contentType = (resp.headers.get("content-type") || "").toLowerCase();
  if (!contentType) return false;

  switch (expectedType) {
    case "script":
      return contentType.includes("javascript") || contentType.includes("ecmascript");
    case "style":
      return contentType.includes("text/css");
    case "html":
      return contentType.includes("text/html");
    default:
      // Images, fonts, JSON, anything else static: any real content type is fine.
      return true;
  }
}

function assetTypeFor(pathname) {
  if (/\.(?:m?js|cjs)$/.test(pathname)) return "script";
  if (/\.css$/.test(pathname)) return "style";
  if (/\.html?$/.test(pathname)) return "html";
  return "other";
}

/**
 * Store a response, keyed by the URL that actually produced it.
 *
 * Cache.put() rejects a redirected response cached under the original request
 * URL, and doing that would also teach the offline fallback the wrong page, so
 * redirected responses are stored under their final URL.
 */
async function cacheResponse(request, resp, expectedType) {
  if (!isCacheableResponse(resp, expectedType)) return;
  const key = resp.redirected ? resp.url : request;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(key, resp.clone());
  } catch {
    // Quota or a non-cacheable key — caching is an optimisation, never fatal.
  }
}

// Listen for messages from the frontend (reloadCoordinator / deployment skew).
self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_CACHE") {
    event.waitUntil(
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
        .then(() => caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
    );
    // Reply so the caller can stop waiting on a worker that will never answer
    // (an unregistered controller would otherwise leave a pending promise).
    if (event.source && typeof event.source.postMessage === "function") {
      event.source.postMessage({ type: "CLEAR_CACHE_DONE" });
    }
  }

  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // addAll() fails the whole install if one shell file 404s; cache them
      // individually so a missing icon cannot take down the worker.
      .then((cache) =>
        Promise.all(
          APP_SHELL.map((path) =>
            cache
              .add(path)
              .catch(() => console.warn("[sw] app shell precache failed for", path))
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        // Delete every cache from a previous worker version. This is what makes
        // a deployment actually replace the old build on the next load.
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip cross-origin and non-GET requests.
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== "GET") return;

  // Never cache API calls, the deployment beacon, or this file.
  if (NEVER_CACHE.some((prefix) => url.pathname.startsWith(prefix))) return;

  const isNavigation = event.request.mode === "navigate";

  if (isNavigation) {
    // Network-first: a deploy must reach the user on their very next load.
    event.respondWith(
      fetch(event.request)
        .then((resp) => {
          // Cache each route under its own URL — prerendered pages differ
          // (/blog/guide vs /pricing), so collapsing them to "/" served the
          // wrong document offline and hid updates.
          cacheResponse(event.request, resp, "html");
          return resp;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          // Exact route first, then the shell, then an honest offline message.
          const cached =
            (await cache.match(event.request)) ||
            (await cache.match(url.pathname)) ||
            (await cache.match("/"));
          return (
            cached ||
            new Response(
              "<!DOCTYPE html><html lang=\"en\"><meta charset=\"utf-8\">" +
                "<title>FocusArx — offline</title>" +
                "<h1>You are offline</h1><p>Please check your connection and try again.</p>",
              { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 }
            )
          );
        })
    );
    return;
  }

  // Hashed build assets: immutable, so cache-first is correct — but only ever
  // cache a response that really is the asset type that was requested.
  if (url.pathname.startsWith("/assets/")) {
    const expected = assetTypeFor(url.pathname);
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((resp) => {
            cacheResponse(event.request, resp, expected);
            return resp;
          })
          .catch(() => new Response("Not Found", { status: 404, statusText: "Not Found" }));
      })
    );
    return;
  }

  // Everything else (images, fonts, static files): network-first, fall back to
  // cache. Non-HTML, non-script, non-style responses are cached as-is.
  const expected = assetTypeFor(url.pathname);
  event.respondWith(
    fetch(event.request)
      .then((resp) => {
        cacheResponse(event.request, resp, expected);
        return resp;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        return cached || new Response("Offline", { status: 503, statusText: "Service Unavailable" });
      })
  );
});

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title || "FocusArx", {
      body: data.body || "You have a new notification",
      icon: "/logo.png",
      badge: "/logo.png",
      data: { url: data.url || "/", sound: data.sound || "default" },
      requireInteraction: data.priority === true,
      tag: data.priority === true ? "focusarx-priority" : undefined,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url;
  if (url) {
    event.waitUntil(clients.openWindow(url));
    return;
  }
  event.waitUntil(clients.openWindow("/"));
});
