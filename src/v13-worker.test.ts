import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

const source = readFileSync(new URL('./v13-worker.js', import.meta.url), 'utf8')
const origin = 'https://training.example'
const scope = origin + '/v13-test/'
const script = scope + 'v13-worker.js'
const current = 'training-check-v13-test-static:index-v1:asset-v1'
const stale = 'training-check-v13-test-static:old'
const primary = 'workbox-precache-v2-' + origin + '/'
const other = 'other-site-cache'

function harness() {
  const handlers = new Map<string, (event: object) => void>()
  const cache = { match: vi.fn().mockResolvedValue('cached'), addAll: vi.fn().mockResolvedValue(undefined) }
  const caches = {
    open: vi.fn().mockResolvedValue(cache),
    keys: vi.fn().mockResolvedValue([primary, other, current, stale]),
    delete: vi.fn().mockResolvedValue(true),
  }
  const fetch = vi.fn().mockResolvedValue('network')
  const load = (registeredScope = scope, scriptURL = script, asset = 'assets/app.js') => runInNewContext(source, {
    URL, Request, caches, fetch,
    self: {
      location: new URL(scriptURL), registration: { scope: registeredScope },
      __WB_MANIFEST: [{ url: 'index.html', revision: 'index-v1' }, { url: asset, revision: 'asset-v1' }],
      addEventListener: (name: string, handler: (event: object) => void) => handlers.set(name, handler),
    },
  })
  const request = (url: string, mode = 'navigate', method = 'GET') => {
    const respondWith = vi.fn()
    handlers.get('fetch')!({ request: { url, mode, method }, respondWith })
    return respondWith
  }
  return { handlers, cache, caches, fetch, load, request }
}

describe('V1.3 service worker scope guard', () => {
  it.each([origin + '/', origin + '/my-app/', scope + 'nested/'])('rejects registration at %s before installing handlers', badScope => {
    const worker = harness()
    expect(() => worker.load(badScope)).toThrow('V13_SERVICE_WORKER_SCOPE_MISMATCH')
    expect(worker.handlers.size).toBe(0)
    expect(worker.caches.open).not.toHaveBeenCalled()
  })

  it('rejects a script served from the primary path', () => {
    const worker = harness()
    expect(() => worker.load(scope, origin + '/v13-worker.js')).toThrow('V13_SERVICE_WORKER_SCOPE_MISMATCH')
    expect(worker.handlers.size).toBe(0)
  })

  it.each(['../index.html', 'https://other.example/v13-test/asset.js'])('rejects a precache entry outside its scope: %s', asset => {
    const worker = harness()
    expect(() => worker.load(scope, script, asset)).toThrow('V13_SERVICE_WORKER_ASSET_OUTSIDE_SCOPE')
    expect(worker.handlers.size).toBe(0)
  })

  it.each(['/', '/my-app/', '/v13-test-other/', '/v13-test/../my-app/', '/v13-test'])('does not answer navigation to %s', path => {
    const worker = harness()
    worker.load()
    expect(worker.request(origin + path)).not.toHaveBeenCalled()
    expect(worker.caches.open).not.toHaveBeenCalled()
    expect(worker.fetch).not.toHaveBeenCalled()
  })

  it('ignores cross-origin navigations, non-GET requests and unlisted assets', () => {
    const worker = harness()
    worker.load()
    expect(worker.request('https://other.example/v13-test/')).not.toHaveBeenCalled()
    expect(worker.request(scope, 'navigate', 'POST')).not.toHaveBeenCalled()
    expect(worker.request(scope + 'other.js', 'cors')).not.toHaveBeenCalled()
    expect(worker.caches.open).not.toHaveBeenCalled()
  })

  it('serves only its own navigation fallback and allowlisted asset', async () => {
    const worker = harness()
    worker.load()
    await expect(worker.request(scope + 'analysis?mode=weekly').mock.calls[0][0]).resolves.toBe('cached')
    expect(worker.cache.match).toHaveBeenLastCalledWith(scope + 'index.html')
    await expect(worker.request(scope + 'assets/app.js', 'cors').mock.calls[0][0]).resolves.toBe('cached')
    expect(worker.cache.match).toHaveBeenLastCalledWith(scope + 'assets/app.js')
    expect(worker.caches.open).toHaveBeenCalledWith(current)
  })

  it('falls back to the original scoped request on a cache miss', async () => {
    const worker = harness()
    worker.load()
    worker.cache.match.mockResolvedValueOnce(undefined)
    const url = scope + 'analysis?mode=weekly'
    await expect(worker.request(url).mock.calls[0][0]).resolves.toBe('network')
    expect(worker.fetch).toHaveBeenCalledWith({ url, mode: 'navigate', method: 'GET' })
  })

  it('precaches only scoped resources and removes only stale V1.3 caches', async () => {
    const worker = harness()
    worker.load()
    const waitUntil = vi.fn()
    worker.handlers.get('install')!({ waitUntil })
    await waitUntil.mock.calls[0][0]
    expect(worker.cache.addAll.mock.calls[0][0].map((request: Request) => request.url)).toEqual([
      scope + 'index.html', scope + 'assets/app.js',
    ])
    worker.handlers.get('activate')!({ waitUntil })
    await waitUntil.mock.calls[1][0]
    expect(worker.caches.delete.mock.calls).toEqual([[stale]])
  })
})
