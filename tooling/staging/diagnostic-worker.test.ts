import { expect, it, vi } from 'vitest'
vi.mock('./.generated/diagnostic.txt', () => ({ default: '<h1>read-only diagnostic</h1>' }))
vi.mock('./.generated/initializer.txt', () => ({ default: 'forbidden initializer' }))
import diagnostic from './diagnostic-worker'
const env = { ASSETS: { fetch: vi.fn(async () => new Response('accepted product')) }, PREP_RUN: '', PREP_EXPIRES: '', PREP_TOKEN_HASH: '' }
it('exposes only the exact read-only GET and leaves the mutation gate closed', async () => {
  const response = await diagnostic.fetch(new Request('https://staging.example/__staging/diagnose.html'), env)
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toContain('no-store')
  expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
  expect(response.headers.get('Content-Security-Policy')).toContain("connect-src 'none'")
  for (const [path, method] of [['diagnose.html', 'POST'], ['diagnose.html?q=1', 'GET'], ['initializer', 'POST'], ['authorize', 'POST']]) {
    expect((await diagnostic.fetch(new Request('https://staging.example/__staging/' + path, { method }), env)).status).toBe(403)
  }
  expect(await (await diagnostic.fetch(new Request('https://staging.example/'), env)).text()).toBe('accepted product')
})
