// FocusArx service worker — production caching strategy.
//
// - Precache the app shell (index.html + manifest + icons) on install.
// - Network-first for navigation + hashed /assets/* so users always get the
//   freshest build, falling back to cache when offline.
// - Never cache /api/* (authenticated data must stay fresh).
// Bump CACHE_NAME on deploy to invalidate stale caches.

const CACHE_NAME = "focusarx-v6";

const APP_SHELL = [
  "/",
  "/manifest.json",
  "/favicon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip cross-origin and non-GET requests.
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== "GET") return;

  // Never cache API calls — they carry per-user auth state.
  if (url.pathname.startsWith("/api/")) return;

  const isNavigation = event.request.mode === "navigate";

  if (isNavigation) {
    // Network-first with an offline fallback to the cached app shell.
    event.respondWith(
      fetch(event.request)
        .then((resp) => {
          // Only cache successful responses
          if (resp && resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put("/", clone));
          }
          return resp;
        })
        .catch(() => {
          return caches.match("/").then((cached) => {
            return cached || new Response("<!DOCTYPE html><h1>Offline</h1><p>Please check your connection.</p>", {
              headers: { "Content-Type": "text/html" },
              status: 503,
            });
          });
        })
    );
    return;
  }

  // Hashed build assets: cache-first (they are immutable), then network.
  if (url.pathname.startsWith("/assets/") || url.pathname === "/opengraph.jpg") {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((resp) => {
          // Only cache successful responses
          if (resp && resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          }
          return resp;
        }).catch(() => {
          // For assets, return a 404 Response instead of undefined
          return new Response("Not Found", { status: 404, statusText: "Not Found" });
        });
      })
    );
    return;
  }

  // Everything else: network-first, fall back to cache.
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request).then((cached) => {
        return cached || new Response("Offline", { status: 503, statusText: "Service Unavailable" });
      });
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
