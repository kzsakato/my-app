import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {chromium} from '@playwright/test';
const dir='tooling/staging/.generated',origin='https://my-app-staging.kzsakato-lab.workers.dev';const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
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


const manifest=JSON.parse(fs.readFileSync('evidence/h-20261006-09/build-manifest.json'));for(const file of manifest.files){const r=await fetch(origin+'/'+file.path);assert(r.ok);assert.equal(crypto.createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex'),file.sha256)}
assert.equal((await fetch(origin+'/__staging/diagnose.html')).status,403);
const c=await chromium.launchPersistentContext(dir+'/browser-profile',{headless:true});
try{
 const p=await c.newPage();const baseline=JSON.parse(fs.readFileSync(dir+'/h14-remote-before.local.json'));let attempts=0,restored=false;
 for(attempts=1;attempts<=12;attempts++){
  await p.goto(origin+'/',{waitUntil:'networkidle'});await p.waitForTimeout(10000);
  assert.equal(hash(await snapshot(p)),hash(baseline));
  const response=await p.goto(origin+'/__staging/diagnose.html',{waitUntil:'networkidle'});
  if(response.status()===200&&(await response.text()).includes('assets/index-ddSmqDMp.js')&&await p.locator('#result').count()===0){restored=true;break;}
 }
 assert(restored,'Accepted navigation fallback not restored');
 await p.goto(origin+'/',{waitUntil:'networkidle'});assert.equal(hash(await snapshot(p)),hash(baseline));
 const result={result:'PASS',at:new Date().toISOString(),origin,ordinaryCycles:attempts,acceptedAllEightHashes:true,diagnosticHTTP:403,acceptedSWFallbackRestored:true,storageSHA256:hash(baseline),storageUnchanged:true,ownerPartitionInspected:false,sw:await swState(p)};
 fs.writeFileSync('tooling/staging/evidence/h14-temporary-diagnostic/restoration.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await c.close()}
