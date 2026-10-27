import {test,expect} from '@playwright/test'
import {canonicalFixture} from '../src/canonical/fixtures'
import {mkdirSync,writeFileSync} from 'node:fs'
test('V12-04: actions after weekdays, minus 1pt, one line; filter semantics unchanged',async({page},info)=>{
 await page.goto('/')
 await page.evaluate(async data=>{const db=await new Promise<IDBDatabase>(ok=>{const r=indexedDB.open('training-check-v1r11-candidate',7);r.onsuccess=()=>ok(r.result)});await new Promise<void>(ok=>{const tx=db.transaction(['canonical','cutover'],'readwrite');tx.objectStore('canonical').put(data,'app');tx.objectStore('cutover').put({authoritative:true,establishedAt:'2026-10-27T00:00:00+09:00'},'state');tx.oncomplete=()=>ok()});db.close()},canonicalFixture)
 await page.reload();await page.getByLabel('実施済も表示').check();await page.locator('.weekday-dropdown-trigger').click()
 const group=page.getByRole('group',{name:'推奨曜日を複数選択'})
 const geometry=await group.evaluate(el=>{
   const labels=[...el.querySelectorAll(':scope > label')].map(e=>e.getBoundingClientRect().toJSON()),buttons=[...el.querySelectorAll('.weekday-actions button')].map(e=>({rect:e.getBoundingClientRect().toJSON(),fontSize:getComputedStyle(e).fontSize,parentFont:getComputedStyle(e.parentElement!).fontSize,whiteSpace:getComputedStyle(e).whiteSpace,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth}))
   return{actionsLast:el.lastElementChild?.className==='weekday-actions',labels,buttons}
 })
 expect(geometry.actionsLast).toBe(true);expect(geometry.labels).toHaveLength(7)
 const [on,off]=geometry.buttons
 expect(on.rect.top).toBeGreaterThanOrEqual(Math.max(...geometry.labels.map(r=>r.bottom)))
 expect(Math.abs(on.rect.top-off.rect.top)).toBeLessThan(1)
 for(const b of geometry.buttons){expect(Math.abs(parseFloat(b.fontSize)-(parseFloat(b.parentFont)-96/72))).toBeLessThan(.02);expect(b.whiteSpace).toBe('nowrap');expect(b.scrollWidth).toBeLessThanOrEqual(b.clientWidth)}
 await group.getByRole('button',{name:'全ON',exact:true}).click();await expect(group.getByRole('checkbox',{checked:true})).toHaveCount(7);await expect(page.getByLabel('実施済も表示')).toBeChecked()
 await group.getByRole('button',{name:'全OFF',exact:true}).click();await expect(group.getByRole('checkbox',{checked:true})).toHaveCount(0);await expect(page.getByLabel('実施済も表示')).toBeChecked()
 const dir='evidence/issue30-v12/owner-fixes';mkdirSync(dir,{recursive:true});writeFileSync(`${dir}/${info.project.name}-weekday.json`,JSON.stringify(geometry,null,2)+'\n');await page.screenshot({path:`${dir}/${info.project.name}-weekday.png`,fullPage:true})
})
