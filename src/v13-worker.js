/* global self, caches, URL, fetch */
const scope = new URL('/v13-test/', self.location.origin)
const worker = new URL('v13-worker.js', scope)
if (self.registration.scope !== scope.href || self.location.href !== worker.href) {
  throw new Error('V13_SERVICE_WORKER_SCOPE_MISMATCH')
}

const isWithinScope = url => url.origin === scope.origin && url.pathname.startsWith(scope.pathname)
const prefix = 'training-check-v13-test-static:'
const manifest = self.__WB_MANIFEST
const version = manifest.map(entry => entry.revision ?? entry.url).join(':')
const cacheName = prefix + version
const index = new URL('index.html', scope).href
const urls = new Set(manifest.map(entry => {
  const url = new URL(entry.url, scope)
  if (!isWithinScope(url)) throw new Error('V13_SERVICE_WORKER_ASSET_OUTSIDE_SCOPE')
  return url.href
}))

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll([...urls].map(url => new Request(url, { cache: 'reload' })))))
})

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(name => name.startsWith(prefix) && name !== cacheName)
    .map(name => caches.delete(name)))))
})

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET' || !isWithinScope(new URL(request.url))) return
  const key = request.mode === 'navigate' ? index : request.url
  if (!urls.has(key)) return
  event.respondWith(caches.open(cacheName).then(async cache => (await cache.match(key)) ?? fetch(request)))
})
