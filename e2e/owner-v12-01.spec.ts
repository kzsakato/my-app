import {test,expect} from '@playwright/test'
import {canonicalFixture,canonicalBackupFixture} from '../src/canonical/fixtures'
import {mkdirSync,writeFileSync} from 'node:fs'
test('V12-01 799df27: normal Restore, completed planned rows hidden, actual IDs unique in TOP and REGION',async({page},info)=>{
 await page.clock.install({time:new Date('2026-09-24T12:00:00+09:00')})
 await page.goto('/')
 await page.evaluate(async data=>{const db=await new Promise<IDBDatabase>(ok=>{const r=indexedDB.open('training-check-v1r11-candidate',7);r.onsuccess=()=>ok(r.result)});await new Promise<void>(ok=>{const t=db.transaction(['canonical','cutover'],'readwrite');t.objectStore('canonical').put(data,'app');t.objectStore('cutover').put({authoritative:true,establishedAt:'2026-09-24T00:00:00+09:00'},'state');t.oncomplete=()=>ok()});db.close()},canonicalFixture)
 await page.reload();await page.getByRole('button',{name:'共通メニュー'}).click();await page.getByRole('button',{name:'設定',exact:true}).click();await page.getByRole('button',{name:/データ管理/}).click()
 const backup=structuredClone(canonicalBackupFixture)
 backup.payload.menuEntries.push({...backup.payload.menuEntries[0],id:'entry-2',order:1,recommendedDay:4})
 backup.payload.sessions.push({...structuredClone(backup.payload.sessions[0]),id:'session-2',performedAt:'2026-09-24T10:00:00+09:00'})
 await page.getByLabel('正規バックアップを選択').setInputFiles({name:'synthetic-normal-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))})
 await expect(page.getByLabel('警告内容を確認しました')).toBeVisible();await page.getByLabel('警告内容を確認しました').check()
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'全データを置き換えて復元',exact:true}).click();await expect(page.getByRole('status')).toContainText('読み戻し一致')
 const read=()=>page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(ok=>{const r=indexedDB.open('training-check-v1r11-candidate',7);r.onsuccess=()=>ok(r.result)});const v=await new Promise(ok=>{const r=db.transaction('canonical').objectStore('canonical').get('app');r.onsuccess=()=>ok(r.result)});db.close();return v})
 const before=await read()
 await page.getByRole('button',{name:'共通メニュー'}).click();await page.getByRole('button',{name:'実施メニュー',exact:true}).click()
 await page.locator('.weekday-dropdown-trigger').click();await page.getByRole('button',{name:'全ON',exact:true}).click();await page.locator('.weekday-dropdown-trigger').click()
 const dir='evidence/issue30-v12/final-01-07';mkdirSync(dir,{recursive:true})
 const facts=[]
 for(const screen of ['TOP','REGION']){
  if(screen==='REGION'){await page.getByRole('button',{name:'部位表示',exact:true}).click();await page.getByRole('button').filter({has:page.locator('b',{hasText:/^胸$/})}).click()}
  const toggle=page.getByLabel('実施済も表示')
  await toggle.uncheck();await expect(page.locator('[data-menu-entry-id]')).toHaveCount(0);await expect(page.locator('[data-session-id]')).toHaveCount(0)
  await page.screenshot({path:`${dir}/${info.project.name}-${screen}-OFF.png`,fullPage:true})
  await toggle.check();const ids=await page.locator('[data-session-id]').evaluateAll(els=>els.map(el=>el.getAttribute('data-session-id')))
  expect(ids).toEqual(['session-2','session-1']);expect(new Set(ids).size).toBe(2);await expect(page.locator('[data-menu-entry-id]')).toHaveCount(0)
  await toggle.uncheck();await expect(page.locator('[data-session-id]')).toHaveCount(0);await toggle.check();await expect(page.locator('[data-session-id]')).toHaveCount(2)
  await page.screenshot({path:`${dir}/${info.project.name}-${screen}-ON.png`,fullPage:true})
  expect(await read()).toEqual(before);facts.push({screen,off:{planned:0,actual:0},on:{planned:0,actualIDs:ids},dataUnchanged:true})
 }
 writeFileSync(`${dir}/${info.project.name}-projection.json`,JSON.stringify({ownerDataUsed:false,result:'PASS_NEW_799DF27_ORACLE',facts},null,2)+'\n')
})
// Owner screenshot topology, synthetic data only; oracle: design 799df27.
test('V12-01: eight completed entries OFF zero ON eight, Option independent; last cancellation restores planned entry',async({page},info)=>{
 await page.clock.install({time:new Date('2026-09-24T12:00:00+09:00')});await page.goto('/')
 const d=structuredClone(canonicalFixture)
 d.exercises=Array.from({length:8},(_,i)=>({...d.exercises[0],id:`ex-${i}`,name:`検証種目${i}`}))
 d.trainingItems=d.exercises.map((e,i)=>({...canonicalFixture.trainingItems[0],id:`ti-${i}`,exerciseId:e.id,displayName:e.name}))
 d.menuEntries=d.trainingItems.map((t,i)=>({...canonicalFixture.menuEntries[0],id:`entry-${i}`,trainingItemId:t.id,order:i}))
 d.trainingItemSettingChanges=d.trainingItems.map((t,i)=>({...canonicalFixture.trainingItemSettingChanges[0],id:`change-${i}`,trainingItemId:t.id}))
 d.sessions=d.trainingItems.map((t,i)=>({...structuredClone(canonicalFixture.sessions[0]),id:`session-${i}`,trainingItemId:t.id,menuEntryId:`entry-${i}`,performedOrder:i,snapshot:{...canonicalFixture.sessions[0].snapshot,exerciseId:t.exerciseId,exerciseName:t.displayName,trainingItemDisplayName:t.displayName}}))
 await page.evaluate(async data=>{const db=await new Promise<IDBDatabase>(ok=>{const r=indexedDB.open('training-check-v1r11-candidate',7);r.onsuccess=()=>ok(r.result)});await new Promise<void>(ok=>{const t=db.transaction(['canonical','cutover'],'readwrite');t.objectStore('canonical').put(data,'app');t.objectStore('cutover').put({authoritative:true,establishedAt:'2026-09-24T00:00:00+09:00'},'state');t.oncomplete=()=>ok()});db.close()},d);await page.reload()
 const read=()=>page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(ok=>{const r=indexedDB.open('training-check-v1r11-candidate',7);r.onsuccess=()=>ok(r.result)});const v=await new Promise(ok=>{const r=db.transaction('canonical').objectStore('canonical').get('app');r.onsuccess=()=>ok(r.result)});db.close();return v})
 await page.locator('.weekday-dropdown-trigger').click();await page.getByRole('button',{name:'全ON',exact:true}).click();await page.locator('.weekday-dropdown-trigger').click()
 const dir='evidence/issue30-v12/final-01-07';mkdirSync(dir,{recursive:true})
 for(const screen of ['TOP','REGION']){
  if(screen==='REGION'){await page.getByRole('button',{name:'部位表示',exact:true}).click();await page.getByRole('button').filter({has:page.locator('b',{hasText:/^胸$/})}).click()}
  const toggle=page.getByLabel('実施済も表示');await toggle.uncheck();await expect(page.locator('[data-menu-entry-id]')).toHaveCount(0);await expect(page.locator('[data-session-id]')).toHaveCount(0)
  await page.screenshot({path:`${dir}/${info.project.name}-${screen}-eight-OFF.png`,fullPage:true})
  await toggle.check();await expect(page.locator('[data-menu-entry-id]')).toHaveCount(0);await expect(page.locator('[data-session-id]')).toHaveCount(8)
  const ids=await page.locator('[data-session-id]').evaluateAll(els=>els.map(e=>e.getAttribute('data-session-id')));expect(new Set(ids).size).toBe(8)
  await page.getByLabel('Optionソート').check();await expect(toggle).toBeChecked();await expect(page.locator('[data-session-id]')).toHaveCount(8)
  expect(await read()).toEqual(d);await page.screenshot({path:`${dir}/${info.project.name}-${screen}-eight-ON.png`,fullPage:true})
 }
 await page.locator('[data-session-id="session-0"]').click();page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'9/24の実行を取り消す',exact:true}).click()
 await expect(page.locator('[data-menu-entry-id="entry-0"]')).toBeVisible()
 const saved=await read() as typeof d
 expect(saved.sessions).toEqual(d.sessions.filter(s=>s.id!=='session-0'));expect(saved.menuEntries).toEqual(d.menuEntries);expect(saved.trainingItems).toEqual(d.trainingItems)
 await page.reload();expect(await read()).toEqual(saved)
 writeFileSync(`${dir}/${info.project.name}-eight-result.json`,JSON.stringify({result:'PASS',off:{planned:0,actual:0},on:{planned:0,actual:8},lastSessionCancellationRestoresEntry:true,canonicalSwitchingUnchanged:true,ownerDataUsed:false},null,2))
})
