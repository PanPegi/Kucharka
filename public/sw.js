const CACHE_NAME = 'kucharka-v2';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.png'
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
  // Vynutí, aby nový SW ovládal stránku ihned, bez nutnosti restartu
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // PHP požadavky (ukládání/načítání dat) necachejeme
  if (event.request.url.includes('.php')) {
    return;
  }

  // STRATEGIE: NETWORK FIRST
  // Nejdřív zkusíme síť, pokud selže (offline), jdeme do cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Pokud je odpověď v pořádku, uložíme ji do cache pro příště
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Síť selhala (jsme offline), vrátíme soubor z cache
        return caches.match(event.request);
      })
  );
});