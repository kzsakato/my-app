// Public validation: fixed authorized Worker, fresh profiles, synthetic QA fixtures only.
import {chromium} from '@playwright/test'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import assert from 'node:assert/strict'
const dir='evidence/issue30-v12/mixed-sort-release',origin='https://my-app-staging-v1r.kzsakato-lab.workers.dev',dbName='training-check-v12-local-man',results=[]
const priorities=[['completion','recommendedDay','bodyRegion'],['recommendedDay','completion','bodyRegion'],['recommendedDay','bodyRegion','completion']]
const orders=[[['E-A','E-B','S-A','S-B'],['S-A','S-B','E-A','E-B']],[['E-A','S-A','E-B','S-B'],['S-A','E-A','S-B','E-B']],[['E-A','S-A','S-B','E-B'],['E-A','S-A','S-B','E-B']]]
mkdirSync(dir,{recursive:true});const b=await chromium.launch()
try{for(const width of [1280,360]){
 const c=await b.newContext({viewport:{width,height:900},locale:'ja-JP',timezoneId:'Asia/Tokyo'}),p=await c.newPage();p.setDefaultTimeout(15000);await p.clock.install({time:new Date('2026-09-24T12:00:00+09:00')});assert.equal((await p.goto(origin+'/')).status(),200);await p.getByRole('heading',{name:'今週の実施メニュー'}).waitFor();const meta=await p.evaluate(async()=>await(await fetch('/candidate-build.json')).json());assert.equal(meta.sourceSHA,process.env.EXPECTED_SOURCE_SHA)
 const facts=[]
 async function seed(d){await p.evaluate(async({d,dbName})=>{const db=await new Promise(ok=>{const r=indexedDB.open(dbName,7);r.onsuccess=()=>ok(r.result)});await new Promise(ok=>{const t=db.transaction('canonical','readwrite');t.objectStore('canonical').put(d,'app');t.oncomplete=()=>ok()});db.close()},{d,dbName});await p.reload();await p.locator('.weekday-dropdown-trigger').click();await p.getByRole('button',{name:'全ON',exact:true}).click();await p.locator('.weekday-dropdown-trigger').click();await p.getByLabel('実施済も表示').check()}
 async function ids(){return p.locator('[data-projection="mixed"] [data-menu-entry-id],[data-projection="mixed"] [data-session-id]').evaluateAll(es=>es.map(e=>e.getAttribute('data-menu-entry-id')??e.getAttribute('data-session-id')))}
 async function read(){return p.evaluate(async dbName=>{const db=await new Promise(ok=>{const r=indexedDB.open(dbName,7);r.onsuccess=()=>ok(r.result)});const d=await new Promise(ok=>{const r=db.transaction('canonical').objectStore('canonical').get('app');r.onsuccess=()=>ok(r.result)});db.close();return d},dbName)}
 for(const mode of ['Default','Option'])for(const [priorityIndex,priority]of priorities.entries())for(const [i,direction]of ['incompleteFirst','completeFirst'].entries()){
  const d=JSON.parse(readFileSync(`${dir}/fixture-A.json`,'utf8'));d.displayPreferences[mode==='Default'?'defaultSort':'optionSort']={priority,completionDirection:direction};await seed(d);if(mode==='Option')await p.getByLabel('Optionソート').check();const actual=await ids();assert.deepEqual(actual,orders[priorityIndex][i]);assert.deepEqual(await read(),d);facts.push({fixture:'A',mode,priority,direction,expected:orders[priorityIndex][i],actual,result:'PASS'});await p.screenshot({path:`${dir}/remote-${width}-A-${mode}-${priorityIndex+1}-${direction}.png`,fullPage:true})
 }
 for(const fixture of ['B','C'])for(const mode of ['Default','Option'])for(const direction of ['incompleteFirst','completeFirst']){
  const d=JSON.parse(readFileSync(`${dir}/fixture-${fixture}.json`,'utf8'));d.displayPreferences[mode==='Default'?'defaultSort':'optionSort']={priority:priorities[2],completionDirection:direction};await seed(d);if(mode==='Option')await p.getByLabel('Optionソート').check();const expected=fixture==='B'?(direction==='incompleteFirst'?['E-10','E-20','S-10','S-20']:['S-10','S-20','E-10','E-20']):['E-A','S-X','S-M'];const actual=await ids();assert.deepEqual(actual,expected)
  const regionFacts=[]
  for(const[name,order]of fixture==='B'?[['胸',expected]]:[['胸',['E-A','E-N']],['前腕',['S-X']]]){
   await p.getByRole('button',{name:'共通メニュー'}).click();await p.getByRole('button',{name:'実施メニュー',exact:true}).click();await p.getByRole('button',{name:'部位表示',exact:true}).click();await p.getByRole('button').filter({has:p.locator('b',{hasText:new RegExp(`^${name}$`)})}).click();await p.getByLabel('実施済も表示').check();if(mode==='Option')await p.getByLabel('Optionソート').check();const regionIDs=await ids();assert.deepEqual(regionIDs,order);regionFacts.push({name,expected:order,actual:regionIDs})
  }
  assert.deepEqual(await read(),d);facts.push({fixture,mode,direction,expected,actual,regionFacts,result:'PASS'});await p.screenshot({path:`${dir}/remote-${width}-${fixture}-${mode}-${direction}.png`,fullPage:true})
 }
 results.push({width,sourceSHA:meta.sourceSHA,androidMeasured:false,ownerDataUsed:false,canonicalSwitchingUnchanged:true,facts,result:'PASS'});await c.close()
}}finally{await b.close();writeFileSync(`${dir}/remote-results.json`,JSON.stringify({authority:'QA #6435758117 / TEST_SPEC bad82b1',results},null,2)+'\n')}
console.log(JSON.stringify(results.map(r=>({width:r.width,cases:r.facts.length,result:r.result}))))
