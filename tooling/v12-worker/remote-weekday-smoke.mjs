import {chromium} from '@playwright/test'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const origin='https://my-app-staging-v1r.kzsakato-lab.workers.dev',b=await chromium.launch(),results=[]
try{for(const width of [1280,360]){
 const c=await b.newContext({viewport:{width,height:900},locale:'ja-JP',timezoneId:'Asia/Tokyo'}),p=await c.newPage();p.setDefaultTimeout(15000)
 assert.equal((await p.goto(origin+'/')).status(),200);await p.getByRole('heading',{name:'今週の実施メニュー'}).waitFor()
 const meta=await p.evaluate(async()=>await(await fetch('/candidate-build.json')).json());assert(meta.sourceSHA.startsWith('71390af'))
 await p.locator('.weekday-dropdown-trigger').click()
 const facts=await p.locator('.weekday-dropdown-panel').evaluate(el=>{
  const labels=[...el.querySelectorAll(':scope > label')].map(e=>e.getBoundingClientRect().bottom),buttons=[...el.querySelectorAll('.weekday-actions button')].map(e=>({y:e.getBoundingClientRect().top,font:parseFloat(getComputedStyle(e).fontSize),parentFont:parseFloat(getComputedStyle(e.parentElement).fontSize),nowrap:getComputedStyle(e).whiteSpace==='nowrap',fits:e.scrollWidth<=e.clientWidth}))
  return{actionsLast:el.lastElementChild.className==='weekday-actions',lastDayBottom:Math.max(...labels),buttons}
 })
 assert(facts.actionsLast);assert(facts.buttons[0].y>=facts.lastDayBottom);assert(Math.abs(facts.buttons[0].y-facts.buttons[1].y)<1)
 for(const x of facts.buttons){assert(Math.abs(x.font-(x.parentFont-96/72))<.02);assert(x.nowrap&&x.fits)}
 await p.screenshot({path:`evidence/issue30-v12/owner-fixes/remote-${width}-weekday.png`,fullPage:true});results.push({width,sourceSHA:meta.sourceSHA,result:'PASS',facts});await c.close()
}}finally{await b.close();mkdirSync('evidence/issue30-v12/owner-fixes',{recursive:true});writeFileSync('evidence/issue30-v12/owner-fixes/remote-weekday.json',JSON.stringify({androidMeasured:false,results},null,2)+'\n')}
console.log(JSON.stringify(results))
