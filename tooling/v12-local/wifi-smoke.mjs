import { execFileSync,spawn } from 'node:child_process'
import { resolve,join } from 'node:path'
import { mkdirSync,writeFileSync,readFileSync,readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { get } from 'node:https'
import { createServer } from 'node:net'
import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
const temp=resolve('../wifi-test-'+Date.now());mkdirSync(temp,{recursive:true})
const cert=join(temp,'test-only-cert.pem'),key=join(temp,'test-only-key.pem')
execFileSync('C:/Program Files/Git/usr/bin/openssl.exe',['req','-x509','-newkey','rsa:2048','-nodes','-subj','/CN=V12-Test-Only','-addext','subjectAltName=IP:127.0.0.1','-addext','basicConstraints=critical,CA:FALSE','-addext','extendedKeyUsage=serverAuth','-keyout',key,'-out',cert,'-days','1'],{stdio:'ignore'})
const free=createServer();await new Promise((ok,no)=>{free.once('error',no);free.listen(8443,'127.0.0.1',()=>free.close(ok))})
const site=resolve('dist-v12-wifi'),inventory=join(temp,'artifact.json')
function files(dir,prefix=''){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name),prefix+e.name+'/'):[{path:prefix+e.name,sha256:createHash('sha256').update(readFileSync(join(dir,e.name))).digest('hex')}])}
writeFileSync(inventory,JSON.stringify({build:JSON.parse(readFileSync(join(site,'wifi-build.json'),'utf8')),files:files(site)}))
const config=join(temp,'wifi.private.json');writeFileSync(config,JSON.stringify({origin:'https://127.0.0.1:8443',site,cert,key,inventory}))
const child=spawn(process.execPath,['tooling/v12-local/wifi-server.mjs',config],{stdio:['ignore','pipe','pipe'],windowsHide:true});let log='';child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d)
const request=(options={})=>new Promise((ok,no)=>{get('https://127.0.0.1:8443/',options,r=>{let body='';r.on('data',d=>body+=d);r.on('end',()=>ok({status:r.statusCode,body}))}).on('error',no)})
const result={atUTC:new Date().toISOString(),tests:[],androidMeasured:false,systemTrustChanged:false}
let browser
try{
  for(let i=0;i<30&&!log.includes('clientTrust');i++)await new Promise(r=>setTimeout(r,100))
  assert(log.includes('clientTrust'),log)
  await assert.rejects(request(),e=>/SELF_SIGNED_CERT|CERT_HAS_EXPIRED|UNABLE_TO_VERIFY/.test(e.code))
  result.tests.push({name:'default client rejects untrusted test certificate',pass:true})
  assert.equal((await request({ca:readFileSync(cert)})).status,200)
  await assert.rejects(request({ca:readFileSync(cert),headers:{Host:'wrong.example:8443'}}),e=>e.code==='ERR_TLS_CERT_ALTNAME_INVALID')
  result.tests.push({name:'explicit test-client CA validates TLS; wrong hostname rejected (not Android trust)',pass:true})
  browser=await chromium.launch();const page=await browser.newPage()
  await assert.rejects(page.goto('https://127.0.0.1:8443/'),/ERR_CERT_AUTHORITY_INVALID/)
  result.tests.push({name:'Chromium stops on untrusted cert; no warning bypass',pass:true})
  const http=await browser.newPage();await http.route('http://192.168.77.10:8443/**',async route=>{
    const path=new URL(route.request().url()).pathname
    const file=resolve('dist-v12-wifi','.'+(path==='/'?'/index.html':path));await route.fulfill({body:readFileSync(file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'})
  })
  await http.goto('http://192.168.77.10:8443/');await http.getByText('検証用HTTPS origin以外では起動しません',{exact:false}).waitFor({timeout:10000})
  const facts=await http.evaluate(async()=>({secure:isSecureContext,dbs:await indexedDB.databases()}))
  assert.equal(facts.secure,false);assert.deepEqual(facts.dbs,[])
  result.tests.push({name:'LAN HTTP is non-secure; candidate fails before DB',pass:true,facts})
  result.result='PASS_BOUNDARIES_ONLY'
}catch(e){result.result='FAIL';result.error=String(e);process.exitCode=1}
finally{if(browser)await browser.close();child.kill();mkdirSync('evidence/issue30-v12/wifi',{recursive:true});writeFileSync('evidence/issue30-v12/wifi/tests.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2))}
