const CACHE_NAME = 'kucharka-v1';

// Seznam souborů pro offline provoz
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './favicon.png',
  './favicon.ico'
];

// Instalace Service Workeru a uložení souborů do cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('SW: Cache otevřena');
        return cache.addAll(urlsToCache);
      })
  );
});

// Aktivace a promazání staré cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('SW: Mažu starou cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Strategie: Síť jako první, při neúspěchu cache (Network-first)
// To je pro kuchařku nejlepší, aby se hned ukázaly nové recepty, když je internet
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});