import { createServer } from 'node:https'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve,dirname,extname,sep } from 'node:path'
import { X509Certificate,createPublicKey,createHash } from 'node:crypto'
import { networkInterfaces } from 'node:os'
const configFile=resolve(process.argv[2]??'wifi.private.json'),base=dirname(configFile)
const config=JSON.parse(readFileSync(configFile,'utf8')),root=resolve(base,config.site)
const metadata=JSON.parse(readFileSync(resolve(root,'wifi-build.json'),'utf8')),u=new URL(metadata.origin)
for(const p of [configFile,resolve(base,config.cert),resolve(base,config.key),resolve(base,config.inventory)])if(p.startsWith(root+sep))throw Error('private config/cert/key/inventory must be outside site')
const inventory=JSON.parse(readFileSync(resolve(base,config.inventory),'utf8'))
if(inventory.build.origin!==metadata.origin)throw Error('inventory origin mismatch')
const allowed=new Set(inventory.files.map(f=>f.path))
for(const row of inventory.files){const file=resolve(root,row.path);if(!file.startsWith(root+sep)||createHash('sha256').update(readFileSync(file)).digest('hex')!==row.sha256)throw Error('artifact inventory/hash mismatch')}
if(u.protocol!=='https:'||u.port!=='8443'||config.origin!==u.origin)throw Error('origin/config/build mismatch')
const octets=u.hostname.split('.').map(Number)
const privateIP=octets.length===4&&(octets[0]===10||(octets[0]===192&&octets[1]===168)||(octets[0]===172&&octets[1]>=16&&octets[1]<=31))
if(!privateIP&&!(metadata.testOnly&&u.hostname==='127.0.0.1'))throw Error('private LAN IPv4 only')
if(!Object.values(networkInterfaces()).flat().some(a=>a?.address===u.hostname))throw Error('bind address is not a current local interface')
const cert=readFileSync(resolve(base,config.cert)),key=readFileSync(resolve(base,config.key)),x=new X509Certificate(cert)
if(!x.checkIP(u.hostname)||Date.parse(x.validTo)<=Date.now()||Date.parse(x.validFrom)>Date.now())throw Error('certificate SAN/validity mismatch')
if(!createPublicKey(key).export({type:'spki',format:'der'}).equals(x.publicKey.export({type:'spki',format:'der'})))throw Error('certificate/key mismatch')
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json','.json':'application/json'}
const server=createServer({cert,key,minVersion:'TLSv1.2'},async(req,res)=>{
  if(req.headers.host!==u.host){res.writeHead(403);res.end('WiFi candidate Host mismatch');return}
  try{
    const path=new URL(req.url,u.origin).pathname,file=resolve(root,'.'+decodeURIComponent(path==='/'?'/index.html':path))
    if(!file.startsWith(root+sep))throw Error('path')
    if(!allowed.has(path==='/'?'index.html':decodeURIComponent(path).slice(1)))throw Error('not in pinned artifact')
    const body=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream','Cache-Control':'no-store'});res.end(body)
  }catch{res.writeHead(404);res.end('Not found')}
})
server.on('error',()=>{console.error('WiFi HTTPS start failed; no automatic port/firewall change');process.exitCode=1})
server.listen(8443,u.hostname,()=>console.log(JSON.stringify({origin:u.origin,testOnly:metadata.testOnly,certificateSHA256:x.fingerprint256,clientTrust:'NOT_VERIFIED',stop:'Ctrl+C; no trust/firewall/DB changes'})))
