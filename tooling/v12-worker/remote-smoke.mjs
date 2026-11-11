import { chromium } from '@playwright/test'
import {readFileSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const origin='https://my-app-staging-v1r.kzsakato-lab.workers.dev'
const inventory=JSON.parse(readFileSync('evidence/issue30-v12/worker/artifact.json','utf8'))
const browser=await chromium.launch(),context=await browser.newContext({locale:'ja-JP',timezoneId:'Asia/Tokyo'}),page=await context.newPage();context.setDefaultTimeout(15000)
const result={atUTC:new Date().toISOString(),origin,sourceSHA:inventory.sourceSHA,pcChromium:await browser.version(),androidMeasured:false,ownerProfileUsed:false}
try{
 const response=await page.goto(origin+'/');assert.equal(response.status(),200)
 await page.getByRole('heading',{name:'今週の実施メニュー'}).waitFor()
 await page.evaluate(()=>Promise.race([navigator.serviceWorker.ready,new Promise((_,no)=>setTimeout(()=>no(Error('SW timeout')),15000))]))
 await page.reload();await page.getByRole('heading',{name:'今週の実施メニュー'}).waitFor()
 const facts=await page.evaluate(async()=>{
   const name='training-check-v12-local-man',db=await new Promise((ok,no)=>{const r=indexedDB.open(name,7);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})
   const tx=db.transaction(['canonical','cutover'],'readonly'),read=r=>new Promise(ok=>{r.onsuccess=()=>ok(r.result)})
   const data=await read(tx.objectStore('canonical').get('app')),authority=await read(tx.objectStore('cutover').get('state'));db.close()
   return{secure:isSecureContext,dbs:await indexedDB.databases(),authority:authority.authoritative,menu:data.menus[0].name,counts:{exercises:data.exercises.length,sessions:data.sessions.length},date:data.sessions[0].date,controller:navigator.serviceWorker.controller?.scriptURL,scopes:(await navigator.serviceWorker.getRegistrations()).map(r=>r.scope),caches:await caches.keys(),canonical:JSON.stringify(data)}
 })
 assert.equal(facts.secure,true);assert.equal(facts.authority,true);assert.equal(facts.menu,'MANダミーメニュー');assert.equal(facts.controller,origin+'/sw.js');assert.deepEqual(facts.dbs.map(x=>x.name),['training-check-v12-local-man'])
 await page.screenshot({path:'evidence/issue30-v12/worker/remote-pc.png',fullPage:true})
 await page.getByRole('button',{name:'共通メニュー'}).click();await page.getByRole('button',{name:'設定',exact:true}).click()
 assert((await page.locator('body').innerText()).includes(inventory.sourceSHA.slice(0,8)))
 await page.screenshot({path:'evidence/issue30-v12/worker/remote-settings.png',fullPage:true})
 const canonical=facts.canonical;delete facts.canonical;result.facts=facts
 await page.close();const again=await context.newPage();await again.goto(origin+'/');await again.getByRole('heading',{name:'今週の実施メニュー'}).waitFor()
 const readback=await again.evaluate(async()=>{const db=await new Promise(ok=>{const r=indexedDB.open('training-check-v12-local-man',7);r.onsuccess=()=>ok(r.result)});const v=await new Promise(ok=>{const r=db.transaction('canonical').objectStore('canonical').get('app');r.onsuccess=()=>ok(r.result)});db.close();return JSON.stringify(v)})
 assert.equal(readback,canonical);result.newTabReadbackUnchanged=true
 await again.setViewportSize({width:360,height:800});await again.screenshot({path:'evidence/issue30-v12/worker/remote-360.png',fullPage:true})
 assert.equal(await again.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
 result.result='PASS_PC_REMOTE_ONLY'
}catch(e){result.result='FAIL';result.error=String(e);process.exitCode=1}
finally{await context.close();await browser.close();writeFileSync('evidence/issue30-v12/worker/remote-smoke.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2))}
