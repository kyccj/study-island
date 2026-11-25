// 오프라인용: 앱 파일을 캐시하고, 인터넷이 되면 새 버전으로 갈아끼운다.
const CACHE = 'study-island-v3';
const ASSETS = ['field', 'water', 'nature', 'house', 'player', 'ripple', 'coin', 'heart', 'can', 'shovel', 'seed',
  'fruit-cherry', 'fruit-orange', 'fruit-lemon', 'fruit-pear', 'fruit-banana', 'fruit-grapes',
  'res-rock', 'res-copper', 'res-silver', 'res-gold', 'gem-red', 'gem-green', 'gem-purple', 'gem-yellow', 'moneybag', 'chest'].map((a) => `assets/${a}.png`);
const FILES = ['./', 'index.html', 'style.css', 'data.js', 'core.js', 'icons.js', 'island.js', 'app.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', ...ASSETS];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then((r) => {
    const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
