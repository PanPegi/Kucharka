const CACHE_NAME = 'kucharka-v1';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.png'
  // SEM DOPLŇ NÁZVY ZE SLOŽKY assets, např.:
  // './assets/index-D123.js',
  // './assets/index-D123.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  // PHP požadavky (ukládání/načítání dat) necachejeme, ty potřebují síť
  if (event.request.url.includes('.php')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Pokud máme v cache, vrátíme to, jinak jdeme na síť
      return cachedResponse || fetch(event.request);
    })
  );
});