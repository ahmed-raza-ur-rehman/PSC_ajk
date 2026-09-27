/* NeuroPrep Service Worker — Offline cache for question banks & assets */
const CACHE_NAME = 'neuroprep-v3';
const CORE_ASSETS = [
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  '../builder/questions.json',
  '../board/index.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS.map(u => new Request(u, {cache:'no-cache'}))).catch(()=>{}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Cache-first for JSON banks, network-first for HTML
  if (url.pathname.endsWith('.json')) {
    event.respondWith(
      caches.match(req).then(cached => {
        const fetchPromise = fetch(req).then(networkRes => {
          if (networkRes.ok) {
            caches.open(CACHE_NAME).then(cache => cache.put(req, networkRes.clone()));
          }
          return networkRes;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
  } else {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
  }
});
