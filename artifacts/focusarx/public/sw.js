/**
 * FocusArx V15 - Enhanced Service Worker for Offline Support & Performance
 * 
 * Features:
 * - Multi-cache strategy (static, dynamic, images)
 * - Cache-first for static assets with background updates
 * - Network-first for API calls with offline fallback
 * - Stale-while-revalidate for HTML pages
 * - Background sync for offline focus sessions
 * - Push notifications with rich media
 * - Automatic cache versioning and cleanup
 */

const CACHE_VERSION = 'v15';
const STATIC_CACHE = `focusarx-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `focusarx-dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE = `focusarx-images-${CACHE_VERSION}`;

// Assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/offline.html',
];

self.addEventListener('install', (event) => {
  console.log('[FocusArx SW v15] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[FocusArx SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[FocusArx SW] Installation complete, skipping waiting');
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error('[FocusArx SW] Installation error:', err);
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[FocusArx SW v15] Activating...');
  const allowedCaches = [STATIC_CACHE, DYNAMIC_CACHE, IMAGE_CACHE];
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              const isAllowed = allowedCaches.includes(name);
              if (!isAllowed) {
                console.log('[FocusArx SW] Deleting old cache:', name);
              }
              return !isAllowed;
            })
            .map((name) => caches.delete(name))
        );
      })
      .then(() => {
        console.log('[FocusArx SW] Activation complete, claiming clients');
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other browser requests
  if (url.protocol.startsWith('chrome-extension') || 
      url.protocol.startsWith('blob:') ||
      url.protocol.startsWith('data:')) {
    return;
  }

  // Handle API requests - Network First strategy
  if (url.pathname.startsWith('/api')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Handle image requests - Cache First with fallback
  if (request.destination === 'image') {
    event.respondWith(cacheFirstStrategy(request, IMAGE_CACHE));
    return;
  }

  // Handle static assets - Cache First strategy
  if (request.destination === 'style' || 
      request.destination === 'script' ||
      request.destination === 'font') {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
    return;
  }

  // Handle HTML pages - Stale While Revalidate
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Default - Cache First
  event.respondWith(cacheFirstStrategy(request, DYNAMIC_CACHE));
});

// Cache-First Strategy
async function cacheFirstStrategy(request, cacheName) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[FocusArx SW] Cache hit:', request.url);
      
      // Update cache in background (stale while revalidate pattern)
      fetch(request).then((response) => {
        if (response && response.status === 200) {
          caches.open(cacheName).then((cache) => {
            cache.put(request, response);
          });
        }
      }).catch(() => {
        // Network error, ignore
      });
      
      return cachedResponse;
    }
    
    // Not in cache, fetch from network
    console.log('[FocusArx SW] Cache miss, fetching:', request.url);
    const networkResponse = await fetch(request);
    
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[FocusArx SW] Cache-first error:', error);
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }
    
    throw error;
  }
}

// Network-First Strategy (for API calls)
async function networkFirstStrategy(request) {
  try {
    console.log('[FocusArx SW] Network-first attempt:', request.url);
    const networkResponse = await fetch(request);
    
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[FocusArx SW] Network failed, trying cache:', request.url);
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return error response if nothing available
    return new Response(JSON.stringify({ 
      error: 'Offline', 
      message: 'You are currently offline. Some features may not work.' 
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Stale-While-Revalidate Strategy (for HTML pages)
async function staleWhileRevalidate(request) {
  try {
    const cachedResponse = await caches.match(request);
    
    // Fetch updated version in background
    fetch(request).then((response) => {
      if (response && response.status === 200) {
        caches.open(STATIC_CACHE).then((cache) => {
          cache.put(request, response);
        });
      }
    }).catch(() => {
      // Network error, ignore
    });
    
    // Return cached version immediately
    if (cachedResponse) {
      console.log('[FocusArx SW] Serving stale:', request.url);
      return cachedResponse;
    }
    
    // No cache, fetch from network
    console.log('[FocusArx SW] Fetching fresh:', request.url);
    return await fetch(request);
  } catch (error) {
    console.error('[FocusArx SW] Stale-while-revalidate error:', error);
    
    // Return offline page for navigation
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }
    
    throw error;
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[FocusArx SW] Sync event:', event.tag);
  
  if (event.tag === 'sync-focus-session') {
    event.waitUntil(syncFocusSessions());
  }
});

async function syncFocusSessions() {
  try {
    // Get pending sessions from IndexedDB
    const pendingSessions = await getPendingSessions();
    
    if (pendingSessions.length === 0) {
      return;
    }
    
    console.log('[FocusArx SW] Syncing', pendingSessions.length, 'sessions');
    
    // Send to server
    await Promise.all(pendingSessions.map((session) => {
      return fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(session),
      });
    }));
    
    console.log('[FocusArx SW] Sessions synced successfully');
  } catch (error) {
    console.error('[FocusArx SW] Sync failed:', error);
    // Will retry automatically
  }
}

async function getPendingSessions() {
  // Placeholder - would integrate with IndexedDB in main thread
  return [];
}

// Push notifications with rich media
self.addEventListener('push', (event) => {
  console.log('[FocusArx SW] Push received');
  
  const data = event.data?.json() ?? {};
  const { title, body, icon, badge, url } = data;
  
  event.waitUntil(
    self.registration.showNotification(title || 'FocusArx', {
      body: body || 'Time to focus!',
      icon: icon || '/icon-192.png',
      badge: badge || '/icon-192.png',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      tag: 'focusarx-notification',
      data: { url: url || '/' },
    })
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[FocusArx SW] Notification clicked');
  event.notification.close();
  
  const targetUrl = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if available
        if (clientList.length > 0) {
          return clientList[0].focus();
        }
        // Open new window
        return clients.openWindow(targetUrl);
      })
  );
});

// Message handler for communication with main thread
self.addEventListener('message', (event) => {
  console.log('[FocusArx SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(STATIC_CACHE)
        .then((cache) => cache.addAll(event.data.urls))
    );
  }
});

console.log('[FocusArx SW v15] Service worker loaded');
