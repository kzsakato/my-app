import {isDeepStrictEqual} from 'node:util';import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {chromium} from '@playwright/test';
const dir='tooling/staging/.generated',origin='https://my-app-staging.kzsakato-lab.workers.dev';
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

const phase=process.argv[2];const context=await chromium.launchPersistentContext(dir+'/browser-profile',{headless:true});
const mutations=[],swCalls=[],requests=[];
await context.exposeBinding('__h14Write',(_,kind,operation)=>{(kind==='sw'?swCalls:mutations).push(operation)});
await context.addInitScript(()=>{
 for(const key of ['put','add','delete','clear']){const old=IDBObjectStore.prototype[key];IDBObjectStore.prototype[key]=function(...args){window.__h14Write('idb',this.name+':'+key);return old.apply(this,args)}}
 for(const key of ['setItem','removeItem','clear']){const old=Storage.prototype[key];Storage.prototype[key]=function(...args){window.__h14Write('storage',key);return old.apply(this,args)}}
 const original=ServiceWorkerContainer.prototype.register;ServiceWorkerContainer.prototype.register=function(...args){window.__h14Write('sw','register');return original.apply(this,args)};
 for(const key of ['update','unregister']){const old=ServiceWorkerRegistration.prototype[key];ServiceWorkerRegistration.prototype[key]=function(...args){window.__h14Write('sw',key);return old.apply(this,args)}}
});context.on('request',r=>requests.push({url:r.url(),method:r.method()}));
try{
 const p=await context.newPage();await p.goto(origin+'/',{waitUntil:'networkidle'});
 if(phase==='before'){
  const before=await snapshot(p);fs.writeFileSync(dir+'/h14-remote-before.local.json',JSON.stringify(before));
  const summary={at:new Date().toISOString(),origin,storageSHA256:hash(before),sw:await swState(p),ownerPartitionInspected:false};
  fs.writeFileSync(dir+'/h14-remote-before-summary.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
 }else{
  const saved=JSON.parse(fs.readFileSync(dir+'/h14-remote-before.local.json'));const before=await snapshot(p);assert.equal(hash(before),hash(saved),'Pre-deploy serialized storage hash changed');
  let result;
  for(let attempt=1;attempt<=12;attempt++){
   await p.goto(origin+'/',{waitUntil:'networkidle'});await p.waitForTimeout(10000);
   const swBefore=await swState(p);mutations.length=0;swCalls.length=0;requests.length=0;
   await p.goto(origin+'/__staging/diagnose.html',{waitUntil:'networkidle'});
   if(await p.locator('#result').count()!==1)continue;
   await p.waitForFunction(()=>document.querySelector('#result')?.textContent?.startsWith('{'));
   const diagnosis=JSON.parse(await p.locator('#result').innerText());assert.equal(diagnosis.storage.classification,'canonical-ready');assert(isDeepStrictEqual(await snapshot(p),before),'Diagnostic changed storage including undefined fields');assert.deepEqual(await swState(p),swBefore);
   assert.deepEqual(mutations,[]);assert.deepEqual(swCalls,[]);assert(requests.every(r=>r.method==='GET'&&r.url===origin+'/__staging/diagnose.html'));
   result={result:'PASS',at:new Date().toISOString(),ordinaryAttempts:attempt,origin,storageSHA256:hash(before),storageUnchanged:true,swAndCacheUnchangedDuringDiagnosis:true,mutations,swCalls,requests,diagnosis,ownerPartitionInspected:false};
   await p.screenshot({path:dir+'/h14-diagnostic.png',fullPage:true});break;
  }
  assert(result,'STOP: bounded ordinary update did not reach diagnostic');
  fs.writeFileSync(dir+'/h14-remote-evidence.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }
}finally{await context.close()}
