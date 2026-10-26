import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
const root=fileURLToPath(new URL('./site/',import.meta.url))
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json','.json':'application/json'}
createServer(async(req,res)=>{
  if(req.headers.host!=='localhost:4182'){res.writeHead(403);res.end('Local MAN origin required');return}
  try {
    const path=new URL(req.url,'http://localhost:4182').pathname
    if(path==='/__session') {res.setHeader('Content-Type','application/json');res.end(JSON.stringify({pid:process.pid,session:process.env.V12_SESSION_ID}));return}
    const file=resolve(root,'.'+decodeURIComponent(path==='/'?'/index.html':path))
    if(!file.startsWith(resolve(root)+sep))throw Error('path')
    const body=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(body)
  }catch{res.writeHead(404);res.end('Not found')}
}).listen(4182,'127.0.0.1')
