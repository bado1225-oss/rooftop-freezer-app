// rooftop-freezer-app Service Worker
// v3: Firebase 移行に伴い network-first へ刷新
//
// 方針:
//  - index.html / manifest など「コードが入る系」は network-first
//    （新しいバージョンが Vercel にあれば必ず取りに行く）
//  - 画像（アイコン）は cache-first（変わらないので速度優先）
//  - キャッシュ名にバージョンを入れて、古いキャッシュは activate 時に削除
const CACHE_NAME = 'rooftop-inventory-pwa-v3';
const IMAGE_CACHE = 'rooftop-inventory-img-v1';
const PRECACHE_URLS = [
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(IMAGE_CACHE).then((cache) => cache.addAll(PRECACHE_URLS).catch(()=>{}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // 古い名前のキャッシュ（v1, v2 など）を全部削除
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) =>
        (key !== CACHE_NAME && key !== IMAGE_CACHE) ? caches.delete(key) : Promise.resolve()
      ))
    ).then(() => self.clients.claim())
  );
});

// 画像かどうかの判定
function isImage(url){
  return /\.(png|jpg|jpeg|gif|webp|svg|ico)(\?.*)?$/i.test(url);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  // 外部CDN（Firebase, gstatic, Google）はSWで触らない（ブラウザに任せる）
  if(url.origin !== self.location.origin) return;

  // 画像: cache-first
  if(isImage(url.pathname)){
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(IMAGE_CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(()=>cached))
    );
    return;
  }

  // それ以外（HTML/JS など）: network-first、失敗時のみキャッシュ
  event.respondWith(
    fetch(req).then(res => {
      // 同一オリジンの正常応答だけキャッシュ
      if(res && res.status === 200){
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req).then(cached => cached || caches.match('./index.html')))
  );
});
