import diagnostic from './.generated/diagnostic.txt'
import worker from './worker'

// Temporary entrypoint only. Restoring wrangler.json removes this surface.
export default {
  async fetch(request: Request, env: Parameters<typeof worker.fetch>[1]): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/__staging/diagnose.html' && !url.search && request.method === 'GET') {
      return new Response(diagnostic, { headers: {
        'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store, max-age=0',
        'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; worker-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
      } })
    }
    return worker.fetch(request, env)
  },
}
