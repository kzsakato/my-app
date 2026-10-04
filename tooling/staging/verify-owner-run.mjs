import fs from 'node:fs';
import crypto from 'node:crypto';
import { chromium } from '@playwright/test';
const read=name=>JSON.parse(fs.readFileSync(new URL(name,import.meta.url)));
const cap=read('./capability.local.json'),old=read('./automation-capability.local.json');
const origin=new URL(cap.url).origin;
const assert=(v,m)=>{if(!v)throw Error(m)};
const auth=token=>fetch(origin+'/__staging/authorize',{method:'POST',headers:{Origin:origin,Authorization:`Bearer ${token}`}});
assert((await auth(old.token)).status===403,'old automation token still active');
assert((await auth(cap.token)).status===200,'owner gate');
const manifest=await(await fetch(origin+'/manifest.webmanifest')).json();
assert(new URL(manifest.start_url,origin+'/manifest.webmanifest').origin===origin,'manifest start');
for(const [name,digest]of Object.entries(read('./.generated/provenance.json').hashes)){
 const r=await fetch(origin+'/'+name);assert(r.ok&&crypto.createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex')===digest,'artifact '+name);
}
const browser=await chromium.launch();
try{
 const context=await browser.newContext();const a=await context.newPage(),b=await context.newPage();let ready,release;
 const held=new Promise(r=>ready=r),continueRun=new Promise(r=>release=r);
 let first=true;
 await a.route('**/__staging/authorize',async route=>{if(first){first=false;ready();await continueRun;}const response=await route.fetch();await route.fulfill({response});});
 await a.goto(cap.url);await held;
 await b.goto(cap.url);await b.getByText('STOP',{exact:true}).waitFor();release();await a.getByText('PREPARED',{exact:true}).waitFor();
 await a.goto(cap.url);await a.getByText('PREPARED',{exact:true}).waitFor();
 assert((await context.serviceWorkers()).length===0,'prep SW');
 await a.goto(origin+'/',{waitUntil:'networkidle'});await a.getByRole('button',{name:'共通メニュー'}).click();await a.getByRole('button',{name:'設定',exact:true}).click();
 const settings=await a.locator('body').innerText();assert(settings.includes('トレーナー連携')&&!settings.includes('カテゴリ')&&settings.includes('Build 2026-10-04 / 687716d1'),'canonical runtime');
 await a.getByRole('button',{name:/プロフィール/}).click();assert(await a.getByLabel('週開始曜日').inputValue()==='0','Monday');
 const result={result:'PASS',run:cap.run,expires:cap.expires,origin,checks:['old-automation-capability-403','owner-gate-valid','all-eight-production-hashes','manifest-same-origin','concurrent-tab-STOP','first-tab-PREPARED','duplicate-PREPARED','preparation-no-SW','ordinary-canonical-Build-Trainer-no-Category','week-start-Monday'],ownerDeviceTested:false};
 fs.writeFileSync(new URL('./.generated/owner-run-evidence.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
