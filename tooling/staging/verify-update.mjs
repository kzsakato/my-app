// H-20261005-08: existing automation partition only; no initializer or storage writes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from '@playwright/test';
const dir=path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
const origin='https://my-app-staging.kzsakato-lab.workers.dev';
const accepted=JSON.parse(fs.readFileSync(path.join(dir,'../../evidence/h-20261005-06/build-manifest.json')));
const asset=accepted.files.find(file=>file.path.startsWith('assets/')&&file.path.endsWith('.js')).path;
const expected=JSON.parse(fs.readFileSync(path.join(dir,'.generated/prepared-readback.json')));
const assert=(value,message)=>{if(!value)throw Error(message)};
const context=await chromium.launchPersistentContext(path.join(dir,'.generated/browser-profile'),{headless:true});
const writes=[],requests=[];
await context.exposeBinding('__h08Write',(_,store,operation)=>writes.push({store,operation}));
await context.addInitScript(()=>{
 for(const name of ['put','add','delete','clear']){
  const original=IDBObjectStore.prototype[name];
  IDBObjectStore.prototype[name]=function(...args){window.__h08Write(this.name,name);return original.apply(this,args)};
 }
});
context.on('request',request=>requests.push(request.url()));
const state=page=>page.evaluate(async()=>{
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('training-check');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
 const get=(store,key)=>new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store).get(key);r.onsuccess=()=>resolve(r.result??null);r.onerror=()=>reject(r.error)});
 const value={authority:await get('cutover','state'),data:await get('canonical','app'),baseline:await get('baseline','pre-migration-legacy-source'),receipt:JSON.parse(localStorage.getItem('v1r-staging-receipt')??'null')};db.close();return value;
});
try{
 const page=await context.newPage();
 await page.goto(origin+'/',{waitUntil:'networkidle'});
 const before=await state(page);
 assert(JSON.stringify(before)===JSON.stringify(expected),'pre-update prepared state mismatch');
 const firstAssets=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>r.name).filter(name=>name.includes('/assets/')&&name.endsWith('.js')));
 // Let the accepted registerSW script install/activate the server SW normally.
 // A cached old document may remain visible until one ordinary reload.
 await page.waitForFunction(async asset=>(await (await fetch('/index.html')).text()).includes(asset),asset,{timeout:30000});
 await page.reload({waitUntil:'networkidle'});
 await page.getByRole('button',{name:'共通メニュー'}).click();
 await page.getByRole('button',{name:'設定',exact:true}).click();
 const settings=await page.locator('body').innerText();
 assert(settings.includes(accepted.identifier)&&settings.includes('トレーナー連携')&&!settings.includes('カテゴリ'),'updated canonical discriminators');
 await page.screenshot({path:path.join(dir,'.generated/h08-settings.png'),fullPage:true});
 assert(JSON.stringify(await state(page))===JSON.stringify(before),'update changed prepared data');
 const sw=await page.evaluate(async()=>({controller:navigator.serviceWorker.controller?.scriptURL,registrations:(await navigator.serviceWorker.getRegistrations()).map(r=>({scope:r.scope,state:r.active?.state}))}));
 assert(sw.controller===origin+'/sw.js'&&sw.registrations.every(r=>r.scope===origin+'/'),'SW scope');
 const sessionHash=crypto.createHash('sha256').update(JSON.stringify(before)).digest('hex');
 assert(writes.length===0,'Product startup wrote IndexedDB');
 assert(!requests.some(url=>url.includes('/__staging/')),'ordinary runtime contacted preparation tool');
 const result={result:'PASS',at:new Date().toISOString(),origin,product:accepted.productCommit,build:accepted.identifier,firstAssets,ordinaryReloads:1,settings,sw,indexedDBWrites:writes,preparationRequests:[],beforeAfterPreparedStateSHA256:sessionHash,receiptRun:before.receipt.run,ownerAndroidInspected:false,checks:['same-persistent-automation-partition','normal-SW-registration-and-one-ordinary-reload','full-canonical-baseline-authority-receipt-unchanged','zero-IndexedDB-writes','no-preparation-request','new-Build-canonical-discriminators']};
 fs.writeFileSync(path.join(dir,'.generated/update-evidence.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await context.close();}
