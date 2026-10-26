import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
const root = resolve('dist-v12-local')
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.webmanifest':'application/manifest+json', '.json':'application/json' }
createServer(async (req,res) => {
  if (req.headers.host !== 'localhost:4182') { res.writeHead(403); res.end('Local MAN origin required'); return }
  try {
    const url = new URL(req.url, 'http://localhost:4182')
    const file = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname))
    if (!file.startsWith(root + '/'.replace('/', process.platform === 'win32' ? '\\' : '/'))) throw Error('path')
    const body = await readFile(file)
    res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' }); res.end(body)
  } catch { res.writeHead(404); res.end('Not found') }
}).listen(4182, '127.0.0.1', () => console.log('V1.2 dummy-only: http://localhost:4182 (loopback only)'))
