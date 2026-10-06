import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {chromium} from '@playwright/test';
const dir='tooling/staging/.generated';let phase='accepted';let diagnosticRequests=0;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(req.url==='/__staging/diagnose.html'){diagnosticRequests++;res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; worker-src 'none'; base-uri 'none'"});res.end(fs.readFileSync(dir+'/diagnostic.txt'));return;}
 if(url.pathname.startsWith('/__staging/')){res.writeHead(403);res.end('STOP');return;}
 const root=path.resolve(phase==='temporary'?dir+'/diagnostic-dist':'dist');const file=path.resolve(root,url.pathname==='/'?'index.html':'.'+url.pathname);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/json','Cache-Control':'no-store'});res.end(fs.readFileSync(file));
});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const snapshot=p=>p.evaluate(async()=>{
 const databases=await indexedDB.databases(),data={};
 for(const entry of databases){const db=await new Promise((ok,no)=>{const r=indexedDB.open(entry.name);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});const stores={};
  for(const name of [...db.objectStoreNames]){const tx=db.transaction(name,'readonly'),store=tx.objectStore(name);const pair=await Promise.all(['getAllKeys','getAll'].map(method=>new Promise((ok,no)=>{const r=store[method]();r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})));stores[name]=pair;}
  data[entry.name]={version:db.version,stores};db.close();
 }
 return {data,localStorage:Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])),sessionStorage:Object.fromEntries(Object.keys(sessionStorage).sort().map(k=>[k,sessionStorage.getItem(k)]))};
});
const swState=p=>p.evaluate(async()=>{
 const cached=[];
 for(const name of (await caches.keys()).sort())cached.push({name,keys:(await (await caches.open(name)).keys()).map(r=>r.url).sort()});
 return {controller:navigator.serviceWorker.controller?.scriptURL??null,registrations:(await navigator.serviceWorker.getRegistrations()).map(r=>({scope:r.scope,active:r.active?.scriptURL,state:r.active?.state})),caches:cached};
});
const results=[];
async function diagnostic(p,expected){
 const before=await snapshot(p),swBefore=await swState(p);diagnosticRequests=0;
 await p.goto(origin+'/__staging/diagnose.html',{waitUntil:'networkidle'});
 if(await p.locator('#result').count()!==1)return null;
 await p.waitForFunction(()=>document.querySelector('#result')?.textContent?.startsWith('{'));
 const result=JSON.parse(await p.locator('#result').innerText());assert.equal(result.storage?.classification??result.classification,expected);
 assert.equal(diagnosticRequests,1);assert.deepEqual(await snapshot(p),before);assert.deepEqual(await swState(p),swBefore);
 assert(!(await p.locator('body').innerText()).includes('H14_PRIVATE_SENTINEL'));
 return {classification:expected,storageSHA256:hash(before),storageUnchanged:true,swAndCacheUnchanged:true,serverDiagnosticRequests:diagnosticRequests,result};
}
try {
 for(const kind of ['legacy','canonical']){
  phase='accepted';
  const context=await chromium.launchPersistentContext(dir+'/h14-local-'+kind,{headless:true});
  const writes=[],swCalls=[],network=[];
  await context.exposeBinding('__h14Mutation',(_,kind,detail)=>{(kind==='sw'?swCalls:writes).push(detail)});
  await context.addInitScript(()=>{
   for(const key of ['put','add','delete','clear']){const old=IDBObjectStore.prototype[key];IDBObjectStore.prototype[key]=function(...args){window.__h14Mutation('idb',this.name+':'+key);return old.apply(this,args)}}
   for(const key of ['register']){const old=ServiceWorkerContainer.prototype[key];ServiceWorkerContainer.prototype[key]=function(...args){window.__h14Mutation('sw',key);return old.apply(this,args)}}
   for(const key of ['update','unregister']){const old=ServiceWorkerRegistration.prototype[key];ServiceWorkerRegistration.prototype[key]=function(...args){window.__h14Mutation('sw',key);return old.apply(this,args)}}
  });context.on('request',r=>network.push({url:r.url(),method:r.method()}));
  try {
   const p=await context.newPage();await p.goto(origin+'/',{waitUntil:'networkidle'});await p.waitForFunction(()=>navigator.serviceWorker.controller!==null);
   if(kind==='canonical'){
    const prepared=JSON.parse(fs.readFileSync(dir+'/prepared-readback.json'));prepared.data.profile.sex='H14_PRIVATE_SENTINEL';
    await p.evaluate(async prepared=>{const db=await new Promise(ok=>{const r=indexedDB.open('training-check');r.onsuccess=()=>ok(r.result)});const tx=db.transaction(['canonical','cutover','baseline'],'readwrite');tx.objectStore('canonical').put(prepared.data,'app');tx.objectStore('cutover').put(prepared.authority,'state');tx.objectStore('baseline').put(prepared.baseline,'pre-migration-legacy-source');await new Promise((ok,no)=>{tx.oncomplete=ok;tx.onerror=no});db.close()},prepared);
    await p.reload({waitUntil:'networkidle'});
   }
   const before=await snapshot(p);const oldReach=await p.goto(origin+'/__staging/diagnose.html',{waitUntil:'networkidle'});assert.equal(await p.locator('#result').count(),0);
   phase='temporary';let result;
   for(let attempt=1;attempt<=12;attempt++){
    await p.goto(origin+'/',{waitUntil:'networkidle'});await p.waitForTimeout(5000);
    writes.length=0;swCalls.length=0;network.length=0;
    result=await diagnostic(p,kind==='legacy'?'legacy-active':'canonical-ready');
    if(result){result.ordinaryUpdateAttempts=attempt;break;}
   }
   assert(result,'Normal SW update did not reach diagnostic in bounded attempts');
   assert.deepEqual(await snapshot(p),before);assert.deepEqual(writes,[]);assert.deepEqual(swCalls,[]);assert(network.every(r=>r.method==='GET'&&r.url===origin+'/__staging/diagnose.html'));
   result.diagnosticMutationCalls=writes.slice();result.diagnosticSWCalls=swCalls.slice();result.network=network.slice();
   await p.reload({waitUntil:'networkidle'});assert.deepEqual(await snapshot(p),before);assert.equal(JSON.parse(await p.locator('#result').innerText()).storage.classification,result.classification);
   // Prove temporary exclusion is limited to the exact path, not query variants.
   await p.goto(origin+'/__staging/diagnose.html?other=1',{waitUntil:'networkidle'});assert.equal(await p.locator('#result').count(),0);
   phase='accepted';let restored=false;
   for(let attempt=1;attempt<=12;attempt++){
    await p.goto(origin+'/',{waitUntil:'networkidle'});await p.waitForTimeout(5000);await p.goto(origin+'/__staging/diagnose.html',{waitUntil:'networkidle'});
    if(await p.locator('#result').count()===0){restored=true;result.restoreAttempts=attempt;break;}
   }
   assert(restored,'Accepted SW restoration not observed');assert.deepEqual(await snapshot(p),before);
   results.push({profile:kind,oldSWIntercepted:true,...result,acceptedSWRestored:true});
  }finally{await context.close()}
 }
 // No DB must remain no DB; errors must be STOP, never default classification.
 const browser=await chromium.launch();try{
  for(const kind of ['pristine','read-error','canonical-missing','canonical-invalid','stores-missing']){const c=await browser.newContext();try{
   if(kind==='read-error')await c.addInitScript(()=>{indexedDB.databases=async()=>{throw Error('H14_PRIVATE_SENTINEL')}});
   const p=await c.newPage();await p.goto(origin+'/__staging/diagnose.html',{waitUntil:'networkidle'});await p.waitForFunction(()=>document.querySelector('#result')?.textContent?.startsWith('{'));
   if(['canonical-missing','canonical-invalid','stores-missing'].includes(kind)){
    await p.evaluate(async kind=>{
      const db=await new Promise((ok,no)=>{const r=indexedDB.open('training-check',1);r.onupgradeneeded=()=>{r.result.createObjectStore('cutover');if(kind==='canonical-invalid')r.result.createObjectStore('canonical')};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
      if(kind!=='stores-missing'){const tx=db.transaction([...db.objectStoreNames],'readwrite');tx.objectStore('cutover').put({authoritative:true},'state');if(kind==='canonical-invalid')tx.objectStore('canonical').put({secret:'H14_PRIVATE_SENTINEL'},'app');await new Promise((ok,no)=>{tx.oncomplete=ok;tx.onerror=no})}db.close();
    },kind);
    await diagnostic(p,kind==='stores-missing'?'legacy-active':'canonical-recovery-required');
   }
   const result=JSON.parse(await p.locator('#result').innerText());assert.equal(result.storage?.classification??result.classification,kind==='read-error'?'READ ERROR / STOP':kind.startsWith('canonical-')?'canonical-recovery-required':'legacy-active');assert(!(await p.locator('body').innerText()).includes('H14_PRIVATE_SENTINEL'));
   if(kind==='pristine')assert.deepEqual(await p.evaluate(()=>indexedDB.databases()),[]);
   results.push({profile:kind,result});
  }finally{await c.close()}}
 }finally{await browser.close()}
 fs.writeFileSync(dir+'/diagnostic-local-evidence.json',JSON.stringify({result:'PASS',at:new Date().toISOString(),ownerPartitionInspected:false,results},null,2));console.log(JSON.stringify({result:'PASS',profiles:results.map(r=>({profile:r.profile,attempts:r.ordinaryUpdateAttempts,restoreAttempts:r.restoreAttempts}))}));
}finally{await new Promise(r=>server.close(r))}
