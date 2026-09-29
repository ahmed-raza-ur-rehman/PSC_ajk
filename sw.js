/* ═══════════════════════════════════════════════════════════════
   NeuroPrep Service Worker v4 — offline-first app shell,
   runtime-cached question banks (never pre-download the full bank).
   ═══════════════════════════════════════════════════════════════ */
const VERSION = 'neuroprep-v4';
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const RUNTIME_MAX_ENTRIES = 80;

const SHELL_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './offline.html',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS.map((url) => new Request(url, { cache: 'no-cache' }))))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone()).then(() => trimCache(cacheName));
      }
      return response;
    })
    .catch(() => undefined);
  return cached || (await network) || Response.error();
}

async function trimCache(cacheName) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= RUNTIME_MAX_ENTRIES) return;
  for (const key of keys.slice(0, keys.length - RUNTIME_MAX_ENTRIES)) await cache.delete(key);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // fonts etc. — browser cache handles them

  // App navigations: network first, fall back to shell, then offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(async () => (await caches.match('./index.html')) || (await caches.match('./')) || caches.match('./offline.html'))
    );
    return;
  }

  // Question banks & data: served instantly from cache, refreshed in background.
  const isData = url.pathname.startsWith('/board/') || url.pathname.startsWith('/data/');
  const isAsset = /\.(css|js|png|svg|ico|webmanifest|json)$/.test(url.pathname);
  if (isData || isAsset) {
    event.respondWith(staleWhileRevalidate(request, isData ? RUNTIME_CACHE : SHELL_CACHE));
  }
});
