/* global self, caches, URL, fetch */
const prefix = 'training-check-v13-test-static:'
const manifest = self.__WB_MANIFEST
const version = manifest.map(entry => entry.revision ?? entry.url).join(':')
const cacheName = prefix + version
const scope = self.registration.scope
const index = new URL('index.html', scope).href
const urls = new Set(manifest.map(entry => new URL(entry.url, scope).href))

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll([...urls].map(url => new Request(url, { cache: 'reload' })))))
})

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(name => name.startsWith(prefix) && name !== cacheName)
    .map(name => caches.delete(name)))))
})

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(scope)) return
  const key = event.request.mode === 'navigate' ? index : event.request.url
  if (!urls.has(key)) return
  event.respondWith(caches.open(cacheName).then(async cache => (await cache.match(key)) ?? fetch(event.request)))
})
