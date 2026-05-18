const CACHE_NAME = 'jap-trainer-v10'; // Versionsnummer erhöht!
const urlsToCache = [
  './',
  './index.html',
  './app.js',
  './manifest.json'
];

// Beim Installieren Dateien cachen
self.addEventListener('install', event => {
  self.skipWaiting(); // Zwingt den neuen Service Worker, sofort aktiv zu werden
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

// Alten Cache löschen
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// NETWORK FIRST STRATEGIE: Immer zuerst das Netz fragen, nur wenn offline, den Cache nutzen
self.addEventListener('fetch', event => {
  // Ignoriere Anfragen an das Google Apps Script
  if (event.request.url.includes('script.google.com')) {
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Wenn Netzwerk erfolgreich, aktualisiere den Cache im Hintergrund
        const resClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, resClone);
        });
        return response;
      })
      .catch(() => {
        // Wenn offline, nutze den Cache
        return caches.match(event.request);
      })
  );
});