const CACHE_NAME = 'kucharka-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico',
  './favicon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting(); // Okamžitá aktivace
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim()); // Okamžité převzetí kontroly
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});