import {createServer} from 'node:http'
import {readFile} from 'node:fs/promises'
import {resolve,extname,sep} from 'node:path'
const root=resolve('dist-v12-worker');let old=false
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json','.json':'application/json'}
createServer(async(req,res)=>{
 if(req.headers.host!=='localhost:4182'){res.writeHead(403);res.end('test Host mismatch');return}
 const path=new URL(req.url,'http://localhost:4182').pathname
 if(req.method==='POST'&&['/__test/old','/__test/new'].includes(path)){old=path.endsWith('/old');res.end('test mode changed');return}
 if(path==='/__test/install'){res.setHeader('Content-Type','text/html');res.end('<p>Old V1R synthetic setup</p><script>navigator.serviceWorker.register("/sw.js",{scope:"/"})</script>');return}
 if(path==='/sw.js'&&old){res.setHeader('Content-Type','text/javascript');res.setHeader('Cache-Control','no-store');res.end('self.addEventListener("install",e=>self.skipWaiting());self.addEventListener("activate",e=>e.waitUntil(clients.claim()));self.addEventListener("fetch",e=>{if(e.request.mode==="navigate")e.respondWith(new Response("<p>OLD-V1R-SYNTHETIC</p>",{headers:{"Content-Type":"text/html"}}))});');return}
 try{const file=resolve(root,'.'+decodeURIComponent(path==='/'?'/index.html':path));if(!file.startsWith(root+sep))throw Error('path');res.setHeader('Content-Type',types[extname(file)]??'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(await readFile(file))}catch{res.writeHead(404);res.end('Not found')}
}).listen(4182,'127.0.0.1',()=>console.log('Worker candidate local test only'))
