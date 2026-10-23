import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const root=path.resolve('release/b45c6ded-production/product');
const out=path.resolve('evidence/issue28-production');
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(!pathname.startsWith('/my-app/')){res.writeHead(404);return res.end();}
  const f=path.resolve(root,pathname.slice(8)||'index.html');
  if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);return res.end();}
  const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json'};
  res.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});res.end(fs.readFileSync(f));
});
await new Promise(r=>server.listen(4189,'127.0.0.1',r));
const browser=await chromium.launch();
const context=await browser.newContext({viewport:{width:390,height:844},locale:'ja-JP',timezoneId:'Asia/Tokyo'});
const page=await context.newPage();page.setDefaultTimeout(15000);
const errors=[],badResponses=[];page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)badResponses.push([r.url(),r.status()]);});
page.on('dialog',d=>d.accept());
const settings=async()=>{await page.getByRole('button',{name:'共通メニュー',exact:true}).click();await page.getByRole('button',{name:'設定',exact:true}).click();};
const read=()=>page.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('training-check');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const v=await new Promise((resolve,reject)=>{const r=db.transaction('canonical').objectStore('canonical').get('app');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});db.close();return v;});
const fixture={schemaVersion:1,weekStartsOn:0,activeMenuId:'smoke-menu',profile:{weight:66},exercises:[{id:'smoke-ex',lifecycle:'active',name:'合成テスト種目',measureType:'reps',usesWeight:true,weightMode:'total',classifications:[{kind:'bodyRegion',label:'胸'}]}],trainingItems:[{id:'smoke-ti',managementMode:'MAN',lifecycle:'active',exerciseId:'smoke-ex',displayName:'合成テスト種目',weight:20,reps:10,sets:3}],menus:[{id:'smoke-menu',managementMode:'MAN',lifecycle:'active',name:'合成テストメニュー'}],menuEntries:[{id:'smoke-entry',lifecycle:'active',menuId:'smoke-menu',trainingItemId:'smoke-ti',recommendedDay:4,order:0}],sessions:[],trainingItemSettingChanges:[{id:'smoke-initial',trainingItemId:'smoke-ti',changedAt:'2026-10-23T00:00:00Z',isInitial:true,snapshot:{weight:20,reps:10,sets:3}}]};
try {
  await page.goto('http://127.0.0.1:4189/my-app/');
  await settings();
  assert.equal(await page.getByLabel('ビルド識別子').innerText(),'Build 2026-10-23 / b45c6ded');
  await page.getByRole('button',{name:/^データ管理/}).click();
  await page.getByRole('button',{name:'正規データへの切替を準備',exact:true}).click();
  await page.getByRole('button',{name:'切替準備を確認',exact:true}).click();
  await page.getByLabel('表示したProfile候補を採用する').check();
  await page.getByLabel('切替後は正規データが正本であり、旧データへ自動復帰しないことを確認した').check();
  await page.getByRole('button',{name:'正規データへ切替',exact:true}).click();
  await settings();await page.getByRole('button',{name:/^データ管理/}).click();
  await page.getByLabel('正規バックアップを選択').setInputFiles({name:'synthetic-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'training-check-backup',schemaVersion:1,createdAt:'2026-10-23T00:00:00Z',payload:fixture}))});
  await page.getByRole('button',{name:'全データを置き換えて復元',exact:true}).click();
  await page.getByRole('status').filter({hasText:'復元しました。保存後の読み戻し一致を確認しました。'}).waitFor();
  assert.deepEqual(await read(),fixture);
  await settings();await page.getByRole('button',{name:/^プロフィール/}).click();
  await page.getByLabel('体重（kg）').fill('67');await page.getByRole('button',{name:'保存',exact:true}).click();
  await page.reload();await settings();await page.getByRole('button',{name:/^プロフィール/}).click();
  assert.equal(await page.getByLabel('体重（kg）').inputValue(),'67');assert.equal((await read()).profile.weight,67);
  await settings();await page.getByRole('button',{name:/^データ管理/}).click();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'バックアップを作成',exact:true}).click();
  assert.equal(JSON.parse(fs.readFileSync(await (await download).path(),'utf8')).payload.profile.weight,67);
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();
  const environment=await page.evaluate(async()=>({origin:location.origin,secure:isSecureContext,databases:await indexedDB.databases(),controller:navigator.serviceWorker.controller?.scriptURL,scopes:(await navigator.serviceWorker.getRegistrations()).map(r=>r.scope)}));
  assert(environment.databases.some(d=>d.name==='training-check'&&d.version===7));assert(!environment.databases.some(d=>d.name.includes('candidate')));assert.equal(environment.controller,'http://127.0.0.1:4189/my-app/sw.js');assert.deepEqual(environment.scopes,['http://127.0.0.1:4189/my-app/']);
  await context.setOffline(true);await page.reload();await settings();await page.getByRole('button',{name:/^プロフィール/}).click();assert.equal(await page.getByLabel('体重（kg）').inputValue(),'67');await context.setOffline(false);
  assert.deepEqual(errors,[]);assert.deepEqual(badResponses,[]);
  await page.screenshot({path:path.join(out,'profile-after-reload.png'),fullPage:true});
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:'PASS',checkedAt:new Date().toISOString(),browser:browser.version(),environment,checks:['fresh startup under /my-app/','build identifier','explicit canonical preparation through UI','synthetic full restore + exact DB readback','profile UI save + reload + DB readback','backup export','SW scope/controller','offline reload persistence'],errors,badResponses,limitations:'Isolated loopback Chromium only; not real Pages HTTPS or Owner Brave/Chrome. No real data accessed.'},null,2)+'\n');
  console.log('PASS: limited Production artifact smoke');
} catch(e){await page.screenshot({path:path.join(out,'failure.png'),fullPage:true});console.log(await page.locator('body').innerText());throw e;}
finally{await context.close();await browser.close();server.close();}
