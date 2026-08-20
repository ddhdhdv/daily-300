/* 每日300题 Service Worker：网络优先，离线回退缓存。
   全部使用相对路径：本地 dev（根路径）与 GitHub Pages（/daily-300/ 子路径）均正确。 */
const CACHE = 'daily300-v1'
// './' 相对 sw.js 所在目录解析
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const clone = res.clone()
          caches.open(CACHE).then((cache) => cache.put(req, clone)).catch(() => {})
        }
        return res
      })
      .catch(() =>
        caches.match(req).then((hit) => {
          if (hit) return hit
          if (req.mode === 'navigate') return caches.match('./index.html')
          return new Response('离线且无缓存', { status: 503, statusText: 'Offline' })
        })
      )
  )
})
