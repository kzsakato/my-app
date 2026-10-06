import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from '@playwright/test';
const dir=path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
const cap=JSON.parse(fs.readFileSync(path.join(dir,'capability.local.json'),'utf8'));
const origin=new URL(cap.url).origin;
const assert=(v,m)=>{if(!v)throw Error(m)};
const phase=process.argv[2]??'prepare';
if(phase==='prepare' && cap.run.includes('owner')) throw Error('Owner preparation capability must not initialize an automation partition');
const evidence={phase,origin,run:cap.run,checks:[]};
const record=(name)=>evidence.checks.push(name);
const canonical=page=>page.evaluate(async()=>{
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('training-check');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
 const get=(store,key)=>new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store).get(key);r.onsuccess=()=>resolve(r.result??null);r.onerror=()=>reject(r.error)});
 const result={authority:await get('cutover','state'),data:await get('canonical','app'),baseline:await get('baseline','pre-migration-legacy-source'),receipt:JSON.parse(localStorage.getItem('v1r-staging-receipt')??'null')};db.close();return result;
});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const headers={Origin:origin,Authorization:`Bearer ${cap.token}`};
for(const [file,digest] of Object.entries(JSON.parse(fs.readFileSync(path.join(dir,'.generated/provenance.json'))).hashes)){
 const r=await fetch(origin+'/'+file);assert(r.ok&&hash(Buffer.from(await r.arrayBuffer()))===digest,'Asset '+file);
}record('all-eight-accepted-assets-byte-identical');
assert((await fetch(origin+'/__staging/initializer')).status===403,'ungated bundle');
assert((await fetch(origin+'/__staging/authorize',{method:'POST',headers:{Origin:origin}})).status===403,'ungated API');record('unauthorized-tool-and-mutation-denied');
for(const p of ['/src/data.ts','/.git/config','/.env','/AI_BRIEF.md','/assets/missing.js','/assets/'])assert((await fetch(origin+p)).status===404,'exposure '+p);
record('source-secrets-project-and-missing-assets-not-public');
if(phase==='revoked'){
 assert((await fetch(origin+'/__staging/authorize',{method:'POST',headers})).status===403,'revocation');
 assert((await fetch(origin+'/__staging/initializer',{method:'POST',headers})).status===403,'bundle revocation');record('old-capability-revoked-on-real-server');
}
const profile=path.join(dir,'.generated/browser-profile');
let context=await chromium.launchPersistentContext(profile,{headless:true});
try{
 let page=await context.newPage();const requests=[];const errors=[];
 context.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
 if(phase==='prepare'){
  await page.goto(cap.url);await page.getByText('PREPARED',{exact:true}).waitFor({timeout:30000});
  const before=await canonical(page);assert(before.authority.authoritative&&before.receipt.phase==='complete','authority/receipt');
  assert(before.data.sessions.length===0&&before.data.exercises.length===3&&before.data.trainingItems.length===3&&before.data.menus.length===1&&before.data.menuEntries.length===3,'fixture counts');
  assert(before.data.weekStartsOn===0&&before.data.profile.weight===66,'Profile/week');
  assert(before.data.activeMenuId===before.data.menus[0].id,'active menu');
  assert(before.data.menuEntries.every(e=>before.data.trainingItems.some(i=>i.id===e.trainingItemId)),'references');
  assert((await context.serviceWorkers()).length===0,'preparation must not register SW');record('real-browser-preparation-full-readback-no-SW');
  await page.goto(cap.url);await page.getByText('PREPARED',{exact:true}).waitFor();assert(JSON.stringify(await canonical(page))===JSON.stringify(before),'duplicate mutation');record('duplicate-identical-dataset-and-receipt');
  fs.writeFileSync(path.join(dir,'.generated/prepared-readback.json'),JSON.stringify(before,null,2));
 }
 await page.goto(origin+'/',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
 await page.getByRole('button',{name:'共通メニュー'}).click();await page.getByRole('button',{name:'設定',exact:true}).click();
 const body=await page.locator('body').innerText();
 assert(body.includes('トレーナー連携')&&!body.includes('カテゴリ'),'canonical settings');
 assert(body.includes('Build 2026-10-06 / 118ff493'),'Build');
 evidence.settings=body;
 await page.getByRole('button',{name:/プロフィール/}).click();
 assert(await page.getByLabel('週開始曜日').inputValue()==='0','Monday control');
 record('ordinary-week-start-control-initial-Monday');
 evidence.sw=await page.evaluate(async()=>({controller:navigator.serviceWorker.controller.scriptURL,registrations:(await navigator.serviceWorker.getRegistrations()).map(r=>({scope:r.scope,state:r.active?.state}))}));
 assert(evidence.sw.controller===origin+'/sw.js'&&evidence.sw.registrations.every(r=>r.scope===origin+'/'),'SW origin');
 await page.screenshot({path:path.join(dir,`.generated/${phase}-settings.png`),fullPage:true});
 const before=fs.readFileSync(path.join(dir,'.generated/prepared-readback.json'),'utf8');
 assert(JSON.stringify(await canonical(page))===JSON.stringify(JSON.parse(before)),'ordinary same prepared data');
 record('ordinary-production-canonical-settings-build-scope-same-data');
 await page.reload({waitUntil:'networkidle'});
 assert(JSON.stringify(await canonical(page))===JSON.stringify(JSON.parse(before)),'reload');
 assert(await page.getByRole('combobox',{name:'週メニュー'}).inputValue()===JSON.parse(before).data.activeMenuId,'usable menu selector');
 record('reload-active-menu-and-full-data-durable');
 assert(requests.every(u=>u.startsWith('blob:')||new URL(u).origin===origin),'foreign request');assert(errors.length===0,'browser error '+errors);
 await context.close();
 context=await chromium.launchPersistentContext(profile,{headless:true});page=await context.newPage();
 await page.goto(origin+'/',{waitUntil:'networkidle'});
 assert(JSON.stringify(await canonical(page))===JSON.stringify(JSON.parse(before)),'browser restart');record('browser-process-restart-same-dataset');
}finally{await context.close();}
if(phase==='prepare'){
 const b=await chromium.launch();try{
  const c=await b.newContext();let page=await c.newPage();let calls=0;let interruptedResolve;const interrupted=new Promise(r=>interruptedResolve=r);
  await c.route('**/__staging/authorize',async route=>{if(++calls===5){interruptedResolve();return;}await route.continue();});
  await page.goto(cap.url);await Promise.race([interrupted,new Promise((_,r)=>setTimeout(()=>r(Error('interruption checkpoint')),15000))]);
  await page.close();await c.unrouteAll({behavior:'ignoreErrors'});page=await c.newPage();await page.goto(cap.url);await page.getByText('STOP',{exact:true}).waitFor();
  const partial=await canonical(page);assert(partial.receipt.phase==='started'&&partial.data.exercises.length===0,'interrupted state');record('actual-tab-close-after-cutover-reopens-STOP-no-bootstrap');
  const d=await b.newContext();const network=await d.newPage();await network.route('**/__staging/authorize',r=>r.abort());await network.goto(cap.url);await network.getByText('STOP',{exact:true}).waitFor();record('network-loss-STOP');
 }finally{await b.close();}
}
evidence.result='PASS';fs.writeFileSync(path.join(dir,`.generated/${phase}-evidence.json`),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
