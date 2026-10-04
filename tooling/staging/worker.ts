import initializer from './.generated/initializer.txt'

type Env = { ASSETS: { fetch(r: Request): Promise<Response> }; PREP_TOKEN_HASH?: string; PREP_RUN?: string; PREP_EXPIRES?: string }
const noStore = { 'Cache-Control': 'no-store, max-age=0', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' }
export async function permitted(request: Request, env: Env, now = Date.now()) {
  if (!env.PREP_RUN || !env.PREP_TOKEN_HASH || !env.PREP_EXPIRES || !Number.isFinite(Date.parse(env.PREP_EXPIRES)) || now >= Date.parse(env.PREP_EXPIRES)) return false
  if (request.headers.get('Origin') !== new URL(request.url).origin) return false
  const token = request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1]
  if (!token) return false
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))].map(n => n.toString(16).padStart(2, '0')).join('')
  return hash === env.PREP_TOKEN_HASH
}
const shell = `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Staging preparation</title><body><p id="status" role="status"></p><script>
(async()=>{const stop=()=>document.getElementById('status').textContent='STOP';try{
const token=location.hash.slice(1);if(!token){stop();return}
const r=await fetch('/__staging/initializer',{method:'POST',cache:'no-store',headers:{Authorization:'Bearer '+token}});
if(!r.ok){history.replaceState(null,'',location.pathname);stop();return}
const blob=URL.createObjectURL(new Blob([await r.text()],{type:'text/javascript'}));
const s=document.createElement('script');s.src=blob;s.onload=()=>URL.revokeObjectURL(blob);s.onerror=stop;document.body.appendChild(s);
}catch{history.replaceState(null,'',location.pathname);stop()}})();</script></body></html>`
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname
    if (path === '/__staging/prepare.html' && request.method === 'GET') return new Response(shell, { headers: { ...noStore, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline' blob:; connect-src 'self'; worker-src 'none'; frame-ancestors 'none'; base-uri 'none'" } })
    if (path.startsWith('/__staging/')) {
      if (request.method !== 'POST' || !await permitted(request, env)) return new Response('STOP', { status: 403, headers: noStore })
      if (path === '/__staging/authorize') return Response.json({ run: env.PREP_RUN }, { headers: noStore })
      if (path === '/__staging/initializer') return new Response(initializer, { headers: { ...noStore, 'Content-Type': 'text/javascript; charset=utf-8' } })
      return new Response('STOP', { status: 404, headers: noStore })
    }
    return env.ASSETS.fetch(request)
  },
}
