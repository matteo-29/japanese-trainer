const CACHE_NAME = 'japanisch-trainer-v3'; // Erhöhen Sie diese Nummer (v2, v3, etc.) bei jedem großen Update!
const urlsToCache = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './icon.png'
];

self.addEventListener('install', event => {
  // skipWaiting sorgt für sofortiges Update
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  // Alte Caches löschen, wenn eine neue Version da ist
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});