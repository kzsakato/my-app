import {chromium} from '@playwright/test'
import assert from 'node:assert/strict'
import {writeFileSync,mkdirSync} from 'node:fs'
const b=await chromium.launch(),c=await b.newContext(),p=await c.newPage();p.setDefaultTimeout(15000)
const result={atUTC:new Date().toISOString(),syntheticOldSW:true,ownerBrowserUsed:false}
try{
 await c.request.post('http://localhost:4182/__test/old')
 await p.goto('http://localhost:4182/__test/install');await p.evaluate(()=>navigator.serviceWorker.ready)
 await p.evaluate(async()=>{await new Promise(ok=>{const r=indexedDB.open('training-check',7);r.onupgradeneeded=()=>r.result.createObjectStore('sentinel');r.onsuccess=()=>{const db=r.result,tx=db.transaction('sentinel','readwrite');tx.objectStore('sentinel').put('OLD-DUMMY-PRESERVED','value');tx.oncomplete=()=>{db.close();ok()}}})})
 await p.goto('http://localhost:4182/');await p.getByText('OLD-V1R-SYNTHETIC').waitFor()
 await c.request.post('http://localhost:4182/__test/new')
 await p.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update()})
 await p.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration())?.waiting)
 await p.close()
 const next=await c.newPage();await next.goto('http://localhost:4182/');await next.getByRole('heading',{name:'今週の実施メニュー'}).waitFor({timeout:15000})
 const facts=await next.evaluate(async()=>{
  const db=await new Promise(ok=>{const r=indexedDB.open('training-check',7);r.onsuccess=()=>ok(r.result)})
  const old=await new Promise(ok=>{const r=db.transaction('sentinel').objectStore('sentinel').get('value');r.onsuccess=()=>ok(r.result)});db.close()
  return{old,dbs:await indexedDB.databases(),controller:navigator.serviceWorker.controller?.scriptURL}
 })
 assert.equal(facts.old,'OLD-DUMMY-PRESERVED');assert(facts.dbs.some(x=>x.name==='training-check-v12-local-man'));assert.equal(facts.controller,'http://localhost:4182/sw.js')
 result.result='PASS';result.facts=facts
}catch(e){result.result='FAIL';result.error=String(e);process.exitCode=1}
finally{await c.request.post('http://localhost:4182/__test/new');await c.close();await b.close();mkdirSync('evidence/issue30-v12/worker',{recursive:true});writeFileSync('evidence/issue30-v12/worker/old-sw.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result))}
