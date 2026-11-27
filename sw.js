// 오프라인용: 앱 파일을 캐시하고, 인터넷이 되면 새 버전으로 갈아끼운다.
const CACHE = 'study-island-v4';
const SPR = ['sprout', 'sapling', 'young', 'tree', 'blossom', 'forest', 'pine', 'palm', 'bush', 'mushroom', 'flower_pink', 'flower_yellow', 'flower_white', 'flower_lilac',
  'tuft', 'stone', 'shell', 'starfish', 'weeds', 'can', 'sign', 'fence', 'post', 'lily', 'dig', 'house', 'shop', 'museum', 'player',
  ...['cherry', 'orange', 'lemon', 'pear', 'banana', 'grapes'].map((k) => 'fruit_' + k)].map((a) => `a/${a}`);
const ASSETS = ['coin', 'heart', 'seed', ...SPR,
  'fruit-cherry', 'fruit-orange', 'fruit-lemon', 'fruit-pear', 'fruit-banana', 'fruit-grapes',
  'res-rock', 'res-copper', 'res-silver', 'res-gold', 'gem-red', 'gem-green', 'gem-purple', 'gem-yellow', 'moneybag', 'chest'].map((a) => `assets/${a}.png`);
// 도감 아이콘(assets/ic/*)은 처음 볼 때 캐시된다
const FILES = ['./', 'index.html', 'style.css', 'data.js', 'core.js', 'icons.js', 'island.js', 'app.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', ...ASSETS];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then((r) => {
    const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
