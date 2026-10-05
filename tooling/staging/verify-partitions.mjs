import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from '@playwright/test';
const dir=path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
const origin=new URL(JSON.parse(fs.readFileSync(path.join(dir,'capability.local.json'))).url).origin;
async function inspect(page){
 await page.goto(origin+'/',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'共通メニュー'}).click();await page.getByRole('button',{name:'設定',exact:true}).click();
 const text=await page.locator('body').innerText();
 const state=await page.evaluate(async()=>{
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('training-check');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  const get=(store,key)=>new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store).get(key);r.onsuccess=()=>resolve(r.result??null);r.onerror=()=>reject(r.error)});
  const authority=await get('cutover','state'),data=await get('canonical','app');db.close();
  const receipt=JSON.parse(localStorage.getItem('v1r-staging-receipt')??'null');
  return {authority,canonicalPresent:!!data,receiptRun:receipt?.run??null,receiptAt:receipt?.at??null};
 });
 return {build:await page.getByLabel('ビルド識別子').innerText(),category:text.includes('カテゴリ'),trainer:text.includes('トレーナー連携'),...state};
}
const pc=await chromium.launchPersistentContext(path.join(dir,'.generated/browser-profile'),{headless:true});
const browser=await chromium.launch();
try{
 const prepared=await inspect(await pc.newPage());
 const fresh=await browser.newContext({...devices['Pixel 7']});
 const mobileEquivalentFresh=await inspect(await fresh.newPage());
 if(prepared.build!==mobileEquivalentFresh.build||!prepared.trainer||!mobileEquivalentFresh.category||mobileEquivalentFresh.authority!==null)throw Error('Partition reproduction failed');
 const cap=JSON.parse(fs.readFileSync(path.join(dir,'old-v1r-capability.local.json')));
 const r=await fetch(new URL(cap.url).origin+'/__staging/authorize',{method:'POST',headers:{Origin:new URL(cap.url).origin,Authorization:`Bearer ${cap.token}`}});
 if(r.status!==403)throw Error('Old run reopened');
 const result={result:'PASS',origin,preparedAutomationPartition:prepared,freshMobileEmulationPartition:mobileEquivalentFresh,oldCapabilityStatus:r.status,ownerAndroidInspected:false,interpretation:'Same accepted bundle, different local authority; revocation does not remove prepared data. This reproduces the symptom but does not identify the actual Owner device used for the earlier report.'};
 fs.writeFileSync(path.join(dir,'.generated/partition-investigation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await pc.close();await browser.close();}
