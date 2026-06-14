// sw.js - Service worker for offline support
//
// 전략 A: Network-First for 디렉토리 파일
// - 메인 런처(스코프 루트 — 루트 배포 '/' 또는 GitHub Pages '/jjamjjami-gyosil/' — 및 /index.html)
//   + games/registry.json + manifest.json → 항상 네트워크 우선
//   (NETWORK_TIMEOUT_MS 내 응답 없거나 실패 시 캐시 폴백)
//   → 새 게임 추가 시 사용자에게 즉시 표시됨
// - 그 외 게임 파일들 (game.js, style.css 등) → 캐시 우선 (빠른 로딩 + 오프라인 지원)
//   → 이미 배포된 games/*·shared/* 파일을 수정해도, 배포 시 CACHE_NAME이 커밋 SHA로
//     자동 치환되므로 기존 방문자에게 다음 접속 시 반영됨 (수동 버전 범프 불필요).

// 배포 시 .github/workflows/pages.yml이 이 값을 커밋 SHA로 자동 치환한다.
// (게임/공통 파일 수정이 기존 방문자에게 확실히 반영되도록 — 수동 +1 불필요)
// 로컬 개발에서는 아래 기본값이 그대로 쓰인다.
const CACHE_NAME = 'gyosil-noriplan-1b6d5c9';

// 느린 회선에서 network-first가 첫 화면을 오래 막지 않도록 캐시로 폴백하는 대기 시간
const NETWORK_TIMEOUT_MS = 3000;

// Install: pre-cache the launcher
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll([
        './',
        './index.html',
        './shared/style.css',
        './shared/engine.js',
        './games/registry.json',
        './favicon.svg',
        './og-image.svg',
        './og-image.png',
        './manifest.json'
      ]);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

// "디렉토리 파일" 판별: 게임 목록을 결정하는 파일들
// - 메인 런처 index.html (게임 카드 그리드 포함)
// - games/registry.json (게임 폴더 목록)
// - manifest.json (앱 메타데이터)
// 게임 폴더 안의 index.html은 제외 (그건 게임 자체이므로 캐시 우선)
// SW 스코프 루트 경로 — 루트 배포면 '/', GitHub Pages 프로젝트 페이지면 '/jjamjjami-gyosil/'
var SCOPE_PATH = new URL('./', self.location).pathname;

function isDirectoryFile(url) {
  var pathname = new URL(url).pathname;

  // 메인 런처: 스코프 루트 또는 '/index.html'로 끝 (단, '/games/xxx/index.html'은 제외)
  if (pathname === SCOPE_PATH ||
      pathname.endsWith('/index.html') && !pathname.includes('/games/')) {
    return true;
  }
  // registry.json
  if (pathname.endsWith('/games/registry.json')) return true;
  // manifest.json
  if (pathname.endsWith('/manifest.json')) return true;

  return false;
}

// Fetch: 디렉토리 파일은 network-first, 나머지는 cache-first
self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  if (isDirectoryFile(event.request.url)) {
    // Network-First: 항상 최신 가져오기, 실패/지연(타임아웃) 시 캐시 폴백
    var networkFetch = fetch(event.request, { cache: 'no-cache' }).then(function(response) {
      // 성공 시 캐시 갱신 (오프라인 폴백용)
      if (response.ok) {
        var clone = response.clone();
        return caches.open(CACHE_NAME).then(function(cache) {
          return cache.put(event.request, clone);
        }).then(function() { return response; });
      }
      return response;
    });
    // 타임아웃으로 캐시가 먼저 응답해도 fetch는 끝까지 진행해 다음 방문용 캐시를 갱신
    event.waitUntil(networkFetch.then(null, function() {}));

    event.respondWith(
      Promise.race([
        networkFetch.then(null, function() { return null; }),
        new Promise(function(resolve) {
          setTimeout(function() { resolve(null); }, NETWORK_TIMEOUT_MS);
        })
      ]).then(function(response) {
        if (response) return response;
        // 네트워크 실패 또는 응답 지연 → 캐시에서 시도
        return caches.match(event.request).then(function(cached) {
          // 캐시도 없으면 (첫 방문 + 느린 회선) 네트워크 응답을 끝까지 기다림
          return cached || networkFetch;
        });
      }).catch(function() {
        return new Response('Offline', { status: 503 });
      })
    );
    return;
  }

  // Cache-First: 게임 파일들 (빠른 로딩 + 오프라인 지원)
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;

      return fetch(event.request, { cache: 'no-cache' }).then(function(response) {
        if (response.ok && (event.request.url.includes('/games/') || event.request.url.includes('/shared/'))) {
          var responseClone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      }).catch(function() {
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
