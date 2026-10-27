import {test,expect} from '@playwright/test'
import {canonicalFixture,canonicalBackupFixture} from '../src/canonical/fixtures'
import {mkdirSync,writeFileSync} from 'node:fs'
test('V12-01 investigation: normal Restore, planned completion preserved, actual IDs unique in TOP and REGION',async({page},info)=>{
 await page.clock.install({time:new Date('2026-09-24T12:00:00+09:00')})
 await page.goto('/')
 await page.evaluate(async data=>{const db=await new Promise<IDBDatabase>(ok=>{const r=indexedDB.open('training-check-v1r11-candidate',7);r.onsuccess=()=>ok(r.result)});await new Promise<void>(ok=>{const t=db.transaction(['canonical','cutover'],'readwrite');t.objectStore('canonical').put(data,'app');t.objectStore('cutover').put({authoritative:true,establishedAt:'2026-09-24T00:00:00+09:00'},'state');t.oncomplete=()=>ok()});db.close()},canonicalFixture)
 await page.reload();await page.getByRole('button',{name:'共通メニュー'}).click();await page.getByRole('button',{name:'設定',exact:true}).click();await page.getByRole('button',{name:/データ管理/}).click()
 const backup=structuredClone(canonicalBackupFixture)
 backup.payload.menuEntries.push({...backup.payload.menuEntries[0],id:'entry-2',order:1,recommendedDay:4})
 backup.payload.sessions.push({...structuredClone(backup.payload.sessions[0]),id:'session-2',performedAt:'2026-09-24T10:00:00+09:00'})
 await page.getByLabel('正規バックアップを選択').setInputFiles({name:'synthetic-normal-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))})
 if(await page.getByLabel('警告内容を確認しました').count())await page.getByLabel('警告内容を確認しました').check()
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'全データを置き換えて復元',exact:true}).click();await expect(page.getByRole('status')).toContainText('読み戻し一致')
 const read=()=>page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(ok=>{const r=indexedDB.open('training-check-v1r11-candidate',7);r.onsuccess=()=>ok(r.result)});const v=await new Promise(ok=>{const r=db.transaction('canonical').objectStore('canonical').get('app');r.onsuccess=()=>ok(r.result)});db.close();return v})
 const before=await read()
 await page.getByRole('button',{name:'共通メニュー'}).click();await page.getByRole('button',{name:'実施メニュー',exact:true}).click()
 await page.locator('.weekday-dropdown-trigger').click();await page.getByRole('button',{name:'全ON',exact:true}).click();await page.locator('.weekday-dropdown-trigger').click()
 const dir='evidence/issue30-v12/owner-fixes';mkdirSync(dir,{recursive:true})
 const facts=[]
 for(const screen of ['TOP','REGION']){
  if(screen==='REGION'){await page.getByRole('button',{name:'部位表示',exact:true}).click();await page.getByRole('button').filter({has:page.locator('b',{hasText:/^胸$/})}).click()}
  const toggle=page.getByLabel('実施済も表示')
  await toggle.uncheck();await expect(page.locator('[data-menu-entry-id]')).toHaveCount(2);await expect(page.locator('[data-session-id]')).toHaveCount(0)
  await expect(page.locator('[data-menu-entry-id] .item-status').first()).toContainText('実施済')
  await page.screenshot({path:`${dir}/${info.project.name}-${screen}-OFF.png`,fullPage:true})
  await toggle.check();const ids=await page.locator('[data-session-id]').evaluateAll(els=>els.map(el=>el.getAttribute('data-session-id')))
  expect(ids).toEqual(['session-2','session-1']);expect(new Set(ids).size).toBe(2);await expect(page.locator('[data-menu-entry-id]')).toHaveCount(2)
  await toggle.uncheck();await expect(page.locator('[data-session-id]')).toHaveCount(0);await toggle.check();await expect(page.locator('[data-session-id]')).toHaveCount(2)
  await page.screenshot({path:`${dir}/${info.project.name}-${screen}-ON.png`,fullPage:true})
  expect(await read()).toEqual(before);facts.push({screen,off:{planned:2,actual:0},on:{planned:2,actualIDs:ids},dataUnchanged:true})
 }
 writeFileSync(`${dir}/${info.project.name}-projection.json`,JSON.stringify({ownerDataUsed:false,result:'REPORTED_SESSION_DUPLICATION_NOT_REPRODUCED',facts},null,2)+'\n')
})
