import {test,expect} from '@playwright/test'
import {canonicalFixture} from '../src/canonical/fixtures'
import {exerciseHistory} from '../src/canonical/history'
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs'
const dir='evidence/issue30-v12/final-01-07'
test('V12-07: existing row height preserved, fourteen days right aligned, data unchanged',async({page},info)=>{
 const now=new Date('2026-09-24T12:00:00+09:00');await page.clock.install({time:now});await page.goto('/')
 await page.evaluate(async data=>{const db=await new Promise<IDBDatabase>(ok=>{const r=indexedDB.open('training-check-v1r11-candidate',7);r.onsuccess=()=>ok(r.result)});await new Promise<void>(ok=>{const t=db.transaction(['canonical','cutover'],'readwrite');t.objectStore('canonical').put(data,'app');t.objectStore('cutover').put({authoritative:true,establishedAt:'2026-09-24T00:00:00+09:00'},'state');t.oncomplete=()=>ok()});db.close()},canonicalFixture)
 await page.reload();await page.getByRole('button',{name:'＋ 追加トレーニングを登録'}).click()
 const row=page.locator('[data-training-item-id="item-1"] > button'), before=await row.boundingBox();mkdirSync(dir,{recursive:true})
 if(process.env.CAPTURE_V12_07_BASELINE==='1'){writeFileSync(`${dir}/${info.project.name}-extra-before.json`,JSON.stringify({source:'473f546483d4f7c7271c12e32daa26fd4232b73e',rect:before},null,2));await page.screenshot({path:`${dir}/${info.project.name}-extra-before.png`,fullPage:true});return}
 const baseline=JSON.parse(readFileSync(`${dir}/${info.project.name}-extra-before.json`,'utf8'))
 expect(before!.height).toBe(baseline.rect.height)
 await expect(row.locator('.item-history')).toHaveText(exerciseHistory(canonicalFixture.sessions,'exercise-1',now,0))
 const geometry=await row.evaluate(el=>{const h=el.querySelector('.item-history')!,d=el.querySelector('.extra-item-details')!;return{row:el.getBoundingClientRect().toJSON(),history:h.getBoundingClientRect().toJSON(),details:d.getBoundingClientRect().toJSON(),fits:h.scrollWidth<=h.clientWidth,pageFits:document.documentElement.scrollWidth<=innerWidth}})
 expect(Math.abs(geometry.history.right-geometry.details.right)).toBeLessThan(1);expect(geometry.history.top).toBeGreaterThan(geometry.row.top);expect(geometry.fits&&geometry.pageFits).toBe(true)
 expect((await row.locator('.item-history').innerText()).replace(/[^●○]/g,'')).toHaveLength(14)
 const saved=await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(ok=>{const r=indexedDB.open('training-check-v1r11-candidate',7);r.onsuccess=()=>ok(r.result)});const data=await new Promise(ok=>{const r=db.transaction('canonical').objectStore('canonical').get('app');r.onsuccess=()=>ok(r.result)});db.close();return data});expect(saved).toEqual(canonicalFixture)
 writeFileSync(`${dir}/${info.project.name}-extra-after.json`,JSON.stringify({result:'PASS',baselineHeight:baseline.rect.height,geometry},null,2));await page.screenshot({path:`${dir}/${info.project.name}-extra-after.png`,fullPage:true})
 await row.click();await expect(page.getByRole('heading',{name:'ダンベルプレス',exact:true})).toBeVisible()
})
