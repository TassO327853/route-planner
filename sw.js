// Service Worker - 行程规划助手
const CACHE_NAME = 'route-planner-v1';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/db.js',
  './js/geocoding.js',
  './js/tsp.js',
  './js/app.js',
  './manifest.json'
];

// 安装：缓存核心资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 请求策略：缓存优先，网络兜底（CDN 资源走网络优先）
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // CDN 资源不缓存（Vue/Vant/Dexie/高德），始终走网络
  if (url.origin !== location.origin) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 本地资源：缓存优先
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
