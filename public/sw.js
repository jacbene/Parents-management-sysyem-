const CACHE_NAME = 'apee-portal-cache-v1';
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

// Fetch Event
self.addEventListener('fetch', (event) => {
  // In dev environment, bypass caching to avoid white pages or stale code
  if (isDevEnv()) {
    return; // Leaving request to be handled natively by browser
  }

  // Only handle GET requests and local domains
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch((err) => {
        // Fallback uniquement pour les requêtes de navigation HTML
        if (event.request.mode === 'navigate' || (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'))) {
          return caches.match('/', { ignoreSearch: true });
        }
        throw err;
      });
    })
  );
});
