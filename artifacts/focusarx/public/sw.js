// FocusArx service worker — production caching strategy.
//
// - Precache the app shell (index.html + manifest + icons) on install.
// - Network-first for navigation + hashed /assets/* so users always get the
//   freshest build, falling back to cache when offline.
// - Never cache /api/* (authenticated data must stay fresh).
// Bump CACHE_NAME on deploy to invalidate stale caches.

const CACHE_NAME = "focusarx-v3";

const APP_SHELL = [
  "/",
  "/manifest.json",
  "/logo.png",
  "/favicon.svg",
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
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put("/", clone));
          return resp;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  // Hashed build assets: cache-first (they are immutable), then network.
  if (url.pathname.startsWith("/assets/") || url.pathname === "/opengraph.jpg") {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((resp) => {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
            return resp;
          })
      )
    );
    return;
  }

  // Everything else: network-first, fall back to cache.
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
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
      data: data.url ? { url: data.url } : undefined,
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
