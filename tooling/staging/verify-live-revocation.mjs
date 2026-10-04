import fs from 'node:fs';
import { chromium } from '@playwright/test';
const cap=JSON.parse(fs.readFileSync(new URL('./capability.local.json',import.meta.url)));
const browser=await chromium.launch();
try{
 const context=await browser.newContext();const page=await context.newPage();
 const releaseFile=new URL('./.generated/release-revocation-check',import.meta.url);fs.rmSync(releaseFile,{force:true});
 let ready;const held=new Promise(r=>ready=r);
 await page.route('**/__staging/authorize',async route=>{ready();const deadline=Date.now()+180000;while(!fs.existsSync(releaseFile)){if(Date.now()>deadline)throw Error('release timeout');await new Promise(r=>setTimeout(r,200));}console.log('RELEASED');const response=await route.fetch();console.log('GATE_RESPONSE',response.status());await route.fulfill({response});});
 await page.goto(cap.url);await held;console.log('CLIENT_HELD_BEFORE_WRITE: deploy closed configuration, then create .generated/release-revocation-check');
 try { await page.getByText('STOP',{exact:true}).waitFor({timeout:90000}); } catch(error) { console.log('PAGE_STATE',await page.locator('body').innerText(),await page.evaluate(()=>localStorage.getItem('v1r-staging-receipt')));throw error; }
 const receipt=await page.evaluate(()=>localStorage.getItem('v1r-staging-receipt'));
 if(receipt!==null)throw Error('Revoked loaded tool wrote preparation journal');
 const result={result:'PASS',proof:'already-loaded initializer rechecks real revoked server before first mutation',receipt};
 fs.writeFileSync(new URL('./.generated/live-revocation-evidence.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
