import {chromium} from '@playwright/test'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const dir='evidence/issue30-v12/weekday-compact';mkdirSync(dir,{recursive:true});
const origin='https://my-app-staging-v1r.kzsakato-lab.workers.dev',b=await chromium.launch(),results=[]
try{for(const width of [1280,360]){
 const c=await b.newContext({viewport:{width,height:900},locale:'ja-JP',timezoneId:'Asia/Tokyo'}),p=await c.newPage();p.setDefaultTimeout(15000)
 assert.equal((await p.goto(origin+'/')).status(),200);await p.getByRole('heading',{name:'今週の実施メニュー'}).waitFor()
 const meta=await p.evaluate(async()=>await(await fetch('/candidate-build.json')).json());assert.equal(meta.sourceSHA,process.env.EXPECTED_SOURCE_SHA)
 await p.locator('.weekday-dropdown-trigger').click()
 const facts=await p.locator('.weekday-dropdown-panel').evaluate(el=>{
  const labels=[...el.querySelectorAll(':scope > label')].map(e=>e.getBoundingClientRect().toJSON()),buttons=[...el.querySelectorAll('.weekday-actions button')].map(e=>({y:e.getBoundingClientRect().top,font:parseFloat(getComputedStyle(e).fontSize),parentFont:parseFloat(getComputedStyle(e.parentElement).fontSize),nowrap:getComputedStyle(e).whiteSpace==='nowrap',fits:e.scrollWidth<=e.clientWidth}))
  return{height:el.getBoundingClientRect().height,labels,actionsLast:el.lastElementChild.className==='weekday-actions',lastDayBottom:Math.max(...labels.map(r=>r.bottom)),buttons}
 })
 assert(facts.actionsLast);assert(facts.height<=2*facts.labels[0].height+24);if(width===360){assert.equal(facts.labels[5].top,facts.labels[6].top);assert(facts.buttons[0].y>=facts.labels[6].top&&facts.buttons[0].y<facts.labels[6].bottom);}assert(Math.abs(facts.buttons[0].y-facts.buttons[1].y)<1)
 for(const x of facts.buttons){assert(Math.abs(x.font-(x.parentFont-96/72))<.02);assert(x.nowrap&&x.fits)}
 await p.screenshot({path:`evidence/issue30-v12/weekday-compact/remote-${width}-weekday.png`,fullPage:true});results.push({width,sourceSHA:meta.sourceSHA,result:'PASS',facts});await c.close()
}}finally{await b.close();mkdirSync('evidence/issue30-v12/weekday-compact',{recursive:true});writeFileSync('evidence/issue30-v12/weekday-compact/remote-weekday.json',JSON.stringify({androidMeasured:false,results},null,2)+'\n')}
console.log(JSON.stringify(results))
