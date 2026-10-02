const CACHE_NAME = 'pasma-sys-cache-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Detect development environment (localhost, 127.0.0.1, or ais-dev / ais-pre subdomains)
const isDevEnv = () => {
  return self.location.hostname.includes('ais-dev') || 
         self.location.hostname.includes('ais-pre') || 
         self.location.hostname === 'localhost' || 
         self.location.hostname === '127.0.0.1';
};

// Install Event
self.addEventListener('install', (event) => {
  if (isDevEnv()) {
    console.log('[sw] Dev Mode: skipping cache population');
    self.skipWaiting();
    return;
  }

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: Network-First with Cache as Safe Refuge
self.addEventListener('fetch', (event) => {
  // In dev environment, bypass caching to avoid white pages or stale code
  if (isDevEnv()) {
    return; // Leaving request to be handled natively by browser
  }

  // Bypass dynamic backend API endpoints so real-time calls always hit the network
  if (event.request.url.includes('/api/')) {
    return;
  }

  // Only handle GET requests and local domains
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Network-First strategy: Always prioritize fresh real-time data from network.
  // The local cache serves as an instant refuge when offline or disconnected.
  event.respondWith(
    fetch(event.request).then((networkResponse) => {
      if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
        return networkResponse;
      }

      // Update cache refuge with fresh response
      return caches.open(CACHE_NAME).then((cache) => {
        return cache.put(event.request, networkResponse.clone()).catch(() => undefined);
      }).then(() => networkResponse).catch(() => networkResponse);
    }).catch((error) => {
      // Network failed: Graceful refuge fallback to local cache
      return caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        if (event.request.mode === 'navigate' || (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'))) {
          return caches.match('/');
        }

        throw error;
      });
    })
  );
});
