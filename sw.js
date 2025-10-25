// sw.js — jpykrw-pwa
// 최신 버전 자동 적용 + 즉시 활성화 + 안전한 캐시 전략
// 배포 시 CACHE_VERSION만 v2 → v3 → v4 … 식으로 올리세요.
const CACHE_VERSION = 'v3';
const CACHE_NAME = `jpykrw-cache-${CACHE_VERSION}`;

// 앱이 동작하는 데 꼭 필요한 정적 자원만 "프리캐시"
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// 설치: 핵심 자원 미리 캐싱 + 즉시 대기 해제
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

// 활성화: 이전 캐시 정리 + 모든 클라이언트 즉시 제어 + 새 버전 알림
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => k.startsWith('jpykrw-cache-') && k !== CACHE_NAME)
        .map(k => caches.delete(k))
    );
    await self.clients.claim();
    const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    for (const client of clients) {
      client.postMessage({ type: 'NEW_VERSION_READY' });
    }
  })());
});

// 가져오기 전략
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) 앱 정적 파일(동일 출처): 캐시 우선 + 백그라운드 최신화
  if (url.origin === location.origin) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      const networkFetch = fetch(req).then((res) => {
        // 성공하면 최신본으로 갱신
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        return res;
      }).catch(() => cached); // 오프라인이면 캐시로
      return cached || networkFetch;
    })());
    return;
  }

  // 2) 외부 API(환율 등): 네트워크 우선 + 실패 시 캐시
  //    - API 응답을 캐시에 두면 오프라인에서도 마지막 값 사용 가능
  if (/\b(exchangerate|open\.er-api|allorigins)\b/.test(url.href)) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req, { cache: 'no-store' });
        const copy = res.clone();
        (await caches.open(CACHE_NAME)).put(req, copy);
        return res;
      } catch (e) {
        const cached = await caches.match(req);
        if (cached) return cached;
        throw e; // 캐시도 없으면 원래 에러 전파
      }
    })());
    return;
  }

  // 3) 그 외 요청: 네트워크 우선, 실패 시 캐시 백업
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
