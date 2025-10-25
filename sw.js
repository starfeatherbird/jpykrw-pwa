// sw.js — JPY↔KRW PWA with auto-update
const CACHE_VERSION = 'v1';
const CACHE_NAME = `jpykrw-cache-${CACHE_VERSION}`;
const CORE_ASSETS = ['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('jpykrw-cache-') && k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
    const all = await self.clients.matchAll({ includeUncontrolled: true });
    for (const c of all) c.postMessage({ type: 'NEW_VERSION_READY' });
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin === location.origin) {
    event.respondWith((async () => {
      const cached = await caches.match(event.request);
      const fetchPromise = fetch(event.request).then((res) => {
        caches.open(CACHE_NAME).then((c) => c.put(event.request, res.clone()));
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })());
    return;
  }
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
