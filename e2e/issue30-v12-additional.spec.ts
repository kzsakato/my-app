// Acceptance oracle: training-project@d48ad156 release/V1.2/04_テスト/TEST_SPEC.md
// QA #6393564113: tests only unless a confirmed mismatch is reported first.
import { test, expect, type Page, type TestInfo } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { canonicalFixture } from '../src/canonical/fixtures'
import type { CanonicalAppData } from '../src/canonical/types'

const directory = 'evidence/issue30-v12/qa-additional'
const now = new Date('2026-10-24T12:00:00+09:00')
// Literal expected values from formal 05 §7.1 / 05_JSON §3.1, not the implementation normalizer.
const defaults = {
  defaultSort: { priority: ['recommendedDay','completion','bodyRegion'], completionDirection: 'incompleteFirst' },
  optionSort: { priority: ['completion','recommendedDay','bodyRegion'], completionDirection: 'incompleteFirst' },
  bodyRegionOrder: ['胸','背中','腕','肩','下半身','体幹','その他'],
}
const custom = {
  defaultSort: { priority: ['bodyRegion','recommendedDay','completion'], completionDirection: 'completeFirst' },
  optionSort: { priority: ['bodyRegion','completion','recommendedDay'], completionDirection: 'completeFirst' },
  bodyRegionOrder: ['独自','肩','胸'],
}
function fixture(): CanonicalAppData {
  const d = structuredClone(canonicalFixture)
  d.exercises.push({ ...d.exercises[0], id: 'ex-2', name: '未実施の背中種目', classifications: [{ kind: 'bodyRegion', label: '背中' }] })
  d.trainingItems.push({ ...d.trainingItems[0], id: 'ti-2', exerciseId: 'ex-2', displayName: '未実施の背中項目' })
  d.menuEntries.push({ ...d.menuEntries[0], id: 'entry-2', trainingItemId: 'ti-2', order: 1, recommendedDay: 5 })
  d.menuEntries[0].recommendedDay = 5
  d.sessions[0] = { ...d.sessions[0], date: '2026-10-24', performedAt: '2026-10-24T09:00:00+09:00', snapshot: { ...d.sessions[0].snapshot, classifications: [{ kind: 'bodyRegion', label: '過去部位' }] } }
  d.trainingItemSettingChanges.push({ ...d.trainingItemSettingChanges[0], id: 'change-2', trainingItemId: 'ti-2' })
  return d
}
async function seed(page: Page, data = fixture()) {
  await page.clock.install({ time: now }); await page.clock.setFixedTime(now); await page.goto('/')
  await page.evaluate(async data => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('training-check-v1r11-candidate',7); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
    const tx = db.transaction(['canonical','cutover'],'readwrite')
    tx.objectStore('canonical').put(data,'app'); tx.objectStore('cutover').put({ authoritative: true, establishedAt: '2026-10-24T00:00:00+09:00' },'state')
    await new Promise<void>((resolve,reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error) }); db.close()
  }, data)
  await page.reload(); await expect(page.getByRole('heading', { name: '今週の実施メニュー' })).toBeVisible()
  return data
}
async function stores(page: Page): Promise<Record<string, Array<{ key: IDBValidKey; value: unknown }>>> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open('training-check-v1r11-candidate',7); r.onsuccess = () => resolve(r.result) })
    const names = Array.from(db.objectStoreNames), tx = db.transaction(names,'readonly'), result: Record<string, Array<{ key: IDBValidKey; value: unknown }>> = {}
    await Promise.all(names.map(async name => {
      const store = tx.objectStore(name)
      const [keys, values] = await Promise.all([new Promise<IDBValidKey[]>(resolve => { const r = store.getAllKeys(); r.onsuccess = () => resolve(r.result) }), new Promise<unknown[]>(resolve => { const r = store.getAll(); r.onsuccess = () => resolve(r.result) })])
      result[name] = keys.map((key,i) => ({ key, value: values[i] }))
    }))
    db.close(); return result
  })
}
const saved = async (page: Page) => (await stores(page)).canonical.find(row => row.key === 'app')!.value as CanonicalAppData
async function settings(page: Page) { await page.getByRole('button', { name: '共通メニュー' }).click(); await page.getByRole('button', { name: '設定', exact: true }).click() }
async function top(page: Page) { await page.getByRole('button', { name: '共通メニュー' }).click(); await page.getByRole('button', { name: '実施メニュー', exact: true }).click() }
async function backup(page: Page) { await settings(page); await page.getByRole('button', { name: /データ管理/ }).click() }
async function input(page: Page, value: unknown, raw = false) { await page.getByLabel('正規バックアップを選択').setInputFiles({ name:'fixture.json', mimeType:'application/json', buffer:Buffer.from(raw ? String(value) : JSON.stringify(value)) }) }
const envelope = (payload: unknown) => ({ format:'training-check-backup', schemaVersion:1, createdAt:now.toISOString(), payload })
function record(info: TestInfo, name: string, value: unknown) { mkdirSync(directory,{ recursive:true }); writeFileSync(`${directory}/${info.project.name}-${name}.json`,JSON.stringify(value,null,2)+'\n') }
async function inspect(page: Page, info: TestInfo, name: string) {
  // Rendered text and the accessibility tree are separate oracles; internal category IDs are irrelevant.
  expect(await page.locator('body').innerText()).not.toContain('カテゴリ')
  const aria = await page.locator('body').ariaSnapshot(); expect(aria).not.toContain('カテゴリ')
  const geometry = await page.evaluate(() => {
    const visible = (el: Element) => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width>0 && r.height>0 && s.visibility !== 'hidden' && s.display !== 'none' }
    const outside = Array.from(document.querySelectorAll('button,input,select,textarea')).filter(visible).flatMap(el => {
      const r=el.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth+1 ? [{ tag:el.tagName, text:el.textContent, rect:r.toJSON() }] : []
    })
    const clipped = Array.from(document.querySelectorAll('b,small,.item-status')).filter(visible).flatMap(el => {
      const node=el as HTMLElement; return node.scrollWidth > node.clientWidth+1 && getComputedStyle(el).overflowX !== 'visible' ? [{ text:el.textContent, width:node.clientWidth, contentWidth:node.scrollWidth }] : []
    })
    const overlaps = Array.from(document.querySelectorAll('.item-title-line')).flatMap(el => {
      const name=el.querySelector('b'), status=el.querySelector('.item-status'); if(!name||!status)return []
      const a=name.getBoundingClientRect(), b=status.getBoundingClientRect(); return a.right>b.left+1 ? [{ name:name.textContent, status:status.textContent }] : []
    })
    return { viewport:innerWidth, document:document.documentElement.scrollWidth, outside, clipped, overlaps }
  })
  record(info,`${name}-geometry`,geometry); record(info,`${name}-aria`,aria)
  expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)
  expect(geometry.outside).toEqual([]); expect(geometry.clipped).toEqual([]); expect(geometry.overlaps).toEqual([])
  await page.screenshot({ path:`${directory}/${info.project.name}-${name}.png`,fullPage:true })
}
async function summary(page: Page, expected: typeof custom) {
  const labels: Record<string,string> = { recommendedDay:'推奨曜日',completion:'実施状況',bodyRegion:'部位' }
  for(const key of ['defaultSort','optionSort'] as const) {
    const section=page.locator('.preference-preview > div').filter({has:page.locator('dt',{hasText:key==='defaultSort'?'Default':'Option'})})
    await expect(section.locator('dd')).toHaveText(expected[key].priority.map(key=>labels[key]).join(' → ')+' / '+(expected[key].completionDirection==='incompleteFirst'?'未実施先':'実施済先'))
  }
  await expect(page.locator('.preference-preview > div').filter({has:page.locator('dt',{hasText:'部位'})}).locator('dd')).toHaveText(expected.bodyRegionOrder.join(' → '))
}

test('Q09 invalid JSON/envelope/core never applies or writes any IndexedDB store', async ({page},info) => {
  const d=await seed(page), before=await stores(page); await backup(page)
  const invalids: Array<[string,unknown,boolean?]> = [
    ['invalid-json','{',true], ['invalid-format',{...envelope(d),format:'not-backup'}],
    ['unsupported-version',{...envelope(d),schemaVersion:2}],
    ['zero-sets',envelope({...d,trainingItems:d.trainingItems.map((row,i)=>i?row:{...row,sets:0})})],
    ['dangling-ti',envelope({...d,menuEntries:d.menuEntries.map((row,i)=>i?row:{...row,trainingItemId:'missing'})})],
    ['blank-classification',envelope({...d,exercises:d.exercises.map((row,i)=>i?row:{...row,classifications:[{kind:'bodyRegion',label:'   '}]})})],
  ]
  for(const [name,value,raw] of invalids) {
    await input(page,value,raw); await expect(page.getByRole('heading',{name:'復元できません',exact:true})).toBeVisible()
    await expect(page.getByRole('button',{name:'全データを置き換えて復元'})).toHaveCount(0)
    expect(await stores(page)).toEqual(before); await inspect(page,info,`restore-${name}`)
  }
  record(info,'restore-invalid-nonmutation',{before,after:await stores(page),cases:invalids.map(row=>row[0])})
})

for(const bad of ['defaultSort','optionSort','bodyRegionOrder'] as const) test(`Q09 invalid ${bad}: independent valid settings survive, effective preview, acknowledgement/cancel/apply/readback`,async({page},info)=>{
  const d=await seed(page), before=await stores(page); await backup(page)
  const prefs: Record<string,unknown>=structuredClone(custom)
  prefs[bad]=bad==='defaultSort'?{priority:['completion','completion','bodyRegion'],completionDirection:'completeFirst'}:bad==='optionSort'?{priority:['bodyRegion','completion','recommendedDay'],completionDirection:'invalid'}:['胸','胸']
  const expected={...structuredClone(custom),[bad]:structuredClone(defaults[bad])}
  const payload={...d,profile:{...d.profile,weight:72},displayPreferences:prefs}
  await input(page,envelope(payload)); await summary(page,expected)
  await expect(page.locator('.meta li').filter({hasText:`displayPreferences.${bad}`})).toHaveCount(1)
  const restore=page.getByRole('button',{name:'全データを置き換えて復元'})
  await expect(restore).toBeDisabled(); expect(await stores(page)).toEqual(before)
  await page.getByLabel('警告内容を確認しました').check()
  page.once('dialog',dialog=>dialog.dismiss()); await restore.click(); expect(await stores(page)).toEqual(before)
  await inspect(page,info,`restore-fallback-${bad}`)
  page.once('dialog',dialog=>dialog.accept()); await restore.click(); await expect(page.getByRole('status')).toContainText('読み戻し一致')
  expect(await saved(page)).toEqual({...payload,displayPreferences:expected})
  const after=await stores(page); for(const name of Object.keys(before).filter(name=>name!=='canonical'))expect(after[name]).toEqual(before[name])
  await page.reload(); expect(await saved(page)).toEqual({...payload,displayPreferences:expected})
  record(info,`fallback-${bad}-readback`,{before,after:await stores(page),expected})
})

test('Q09 Restore quota failure: no success/no mutation, retained preview and explicit retry',async({page},info)=>{
  const d=await seed(page), before=await stores(page); await backup(page)
  const payload={...d,profile:{...d.profile,weight:74},displayPreferences:defaults}
  await input(page,envelope(payload))
  await page.evaluate(()=>{
    const original=IDBObjectStore.prototype.put
    ;(window as unknown as {restorePut:()=>void}).restorePut=()=>{IDBObjectStore.prototype.put=original}
    IDBObjectStore.prototype.put=function(...args:Parameters<IDBObjectStore['put']>){if(this.name==='canonical')throw new DOMException('fixture quota','QuotaExceededError');return original.apply(this,args)}
  })
  page.once('dialog',dialog=>dialog.accept()); await page.getByRole('button',{name:'全データを置き換えて復元'}).click()
  await expect(page.getByRole('status')).toContainText('復元の成功を確認できません')
  expect(await stores(page)).toEqual(before); await inspect(page,info,'restore-quota-failure')
  await page.evaluate(()=>(window as unknown as {restorePut:()=>void}).restorePut())
  page.once('dialog',dialog=>dialog.accept()); await page.getByRole('button',{name:'全データを置き換えて復元'}).click()
  await expect(page.getByRole('status')).toContainText('読み戻し一致'); expect(await saved(page)).toEqual(payload)
  await page.reload(); expect(await saved(page)).toEqual(payload)
  record(info,'restore-quota-readback',{before,after:await stores(page),expected:payload})
})

for(const shape of ['missing','multiple','invalid-trim'] as const)test(`Q10 classification ${shape}: no first/Other assignment, warning/edit repair and historical facts unchanged`,async({page},info)=>{
  const data=fixture()
  data.exercises[0].classifications=shape==='missing'?[]:shape==='multiple'?[{kind:'bodyRegion',label:'胸'},{kind:'bodyRegion',label:'背中'}]:[{kind:'bodyRegion',label:' 胸'}]
  const d=await seed(page,data); await page.getByRole('button',{name:'＋ 追加トレーニングを登録'}).click()
  const row=page.locator('[data-training-item-id="item-1"]')
  await expect(row.getByRole('alert')).toBeVisible(); await expect(row.locator('b')).toHaveText('：ダンベルプレス')
  await expect(page.getByRole('combobox',{name:'部位',exact:true}).locator('option')).toHaveText(['部位：すべて','背中'])
  await inspect(page,info,`classification-${shape}-warning`)
  await row.getByRole('button',{name:'編集',exact:true}).click(); await expect(page.getByRole('heading',{name:'種目を編集'})).toBeVisible()
  await expect(page.getByRole('combobox',{name:'部位',exact:true})).toHaveValue('unset')
  await expect(page.getByRole('button',{name:'保存',exact:true})).toBeDisabled()
  await inspect(page,info,`classification-${shape}-edit`)
  await page.getByRole('combobox',{name:'部位',exact:true}).selectOption('肩'); await page.getByRole('button',{name:'保存',exact:true}).click()
  const expected={...d,exercises:d.exercises.map((row,i)=>i?row:{...row,classifications:[{kind:'bodyRegion',label:'肩'}]}),displayPreferences:defaults}
  expect(await saved(page)).toEqual(expected)
  await top(page); await page.getByRole('button',{name:'＋ 追加トレーニングを登録'}).click()
  await expect(row.locator('b')).toHaveText('肩：ダンベルプレス'); await expect(row.getByRole('alert')).toHaveCount(0)
  await inspect(page,info,`classification-${shape}-repaired`)
  await page.reload(); expect(await saved(page)).toEqual(expected)
  record(info,`classification-${shape}-readback`,{before:d,after:await saved(page),expected})
})

test('Q14/Q15/Q16 target screen visible/accessible wording, geometry and CSS, including warning/edit routes',async({page},info)=>{
  const d=await seed(page)
  const statusSize=async()=>parseFloat(await page.locator('.item-status').first().evaluate(el=>getComputedStyle(el).fontSize))
  const topFont=await statusSize(); expect(topFont).toBeCloseTo(12+96/72,3); await inspect(page,info,'TOP')
  await page.getByRole('button',{name:'部位表示',exact:true}).click(); await page.getByRole('button').filter({has:page.locator('b',{hasText:/^胸$/})}).click()
  const regionFont=await statusSize(); expect(regionFont).toBeCloseTo(12+96/72,3); await inspect(page,info,'REGION')
  await page.locator('[data-menu-entry-id="entry-1"]').click()
  const runFont=parseFloat(await page.locator('.run-weight .weight-controls b').evaluate(el=>getComputedStyle(el).fontSize))
  expect(runFont).toBeCloseTo((info.project.name==='pc'?14:13)+96/72,3); await inspect(page,info,'RUN')
  await top(page); await page.getByRole('button',{name:'＋ 追加トレーニングを登録'}).click()
  await expect(page.getByRole('combobox',{name:'部位',exact:true})).toBeVisible(); await inspect(page,info,'EXTRA-LIST')
  await settings(page); await page.getByRole('button',{name:/^設定履歴 /}).click()
  await expect(page.getByRole('combobox',{name:/^部位/})).toBeVisible(); await inspect(page,info,'HISTORY-SELECT')
  await page.getByRole('combobox',{name:/^実施項目/}).selectOption('item-1'); await page.getByRole('button',{name:'設定履歴を見る',exact:true}).click(); await inspect(page,info,'HISTORY')
  await settings(page); await page.getByRole('button',{name:/^種目 /}).click()
  await expect(page.getByRole('combobox',{name:'部位',exact:true})).toBeVisible(); await inspect(page,info,'EX-LIST')
  await settings(page); await page.getByRole('button',{name:/^実施項目 /}).click()
  await expect(page.getByRole('combobox',{name:'部位',exact:true})).toBeVisible(); await inspect(page,info,'TI-LIST')
  await settings(page); await page.getByRole('button',{name:/^分析 /}).click()
  const mode=page.getByRole('combobox',{name:/^表示/}); await expect(mode.locator('option')).toHaveText(['全体','部位別','部位詳細'])
  await mode.selectOption('category'); await inspect(page,info,'ANALYSIS-region')
  await mode.selectOption('detail'); await expect(page.getByRole('combobox',{name:/^部位/})).toBeVisible(); await inspect(page,info,'ANALYSIS-detail')
  await settings(page); await page.getByRole('button',{name:/^週メニュー /}).click(); await page.getByRole('button',{name:'＋ 週メニューを登録',exact:true}).click()
  await expect(page.getByRole('combobox',{name:'追加候補の部位',exact:true})).toBeVisible(); await inspect(page,info,'MENU-NEW')
  await settings(page); await page.getByRole('button',{name:/^週メニュー /}).click(); await page.getByRole('button',{name:/通常メニュー/}).click()
  await expect(page.getByRole('combobox',{name:'追加候補の部位',exact:true})).toBeVisible(); await inspect(page,info,'MENU-EDIT')
  expect(await saved(page)).toEqual(d); record(info,'target-screen-css-nonmutation',{topFont,regionFont,runFont,before:d,after:await saved(page)})
})

test('Q10/Q15 ambiguous classification across current-Exercise UI routes never picks the first label',async({page},info)=>{
  const data=fixture(); data.exercises[0].classifications=[{kind:'bodyRegion',label:'胸'},{kind:'bodyRegion',label:'腕'}]
  const d=await seed(page,data)
  const entry=page.locator('[data-menu-entry-id="entry-1"]')
  await expect(entry.locator('small').first()).not.toContainText('胸'); await expect(entry.locator('..').getByRole('alert')).toBeVisible()
  await inspect(page,info,'ambiguous-TOP')
  await page.getByRole('button',{name:'部位表示',exact:true}).click()
  await expect(page.getByRole('button').filter({has:page.locator('b',{hasText:/^(胸|腕|その他)$/})})).toHaveCount(0)
  await inspect(page,info,'ambiguous-TOP-regions')
  await settings(page); await page.getByRole('button',{name:/^種目 /}).click()
  await expect(page.getByRole('alert')).toBeVisible(); await expect(page.getByRole('combobox',{name:'部位',exact:true}).locator('option')).toHaveText(['部位：すべて','背中'])
  await inspect(page,info,'ambiguous-EX-LIST')
  await settings(page); await page.getByRole('button',{name:/^実施項目 /}).click()
  await expect(page.getByRole('alert')).toBeVisible(); await inspect(page,info,'ambiguous-TI-LIST')
  await settings(page); await page.getByRole('button',{name:/^設定履歴 /}).click()
  await page.getByRole('combobox',{name:/^実施項目/}).selectOption('item-1'); await expect(page.getByRole('alert')).toBeVisible(); await inspect(page,info,'ambiguous-HISTORY-SELECT')
  await settings(page); await page.getByRole('button',{name:/^週メニュー /}).click(); await page.getByRole('button',{name:'＋ 週メニューを登録',exact:true}).click()
  await expect(page.locator('[data-candidate-item-id="item-1"]').getByRole('alert')).toBeVisible(); await inspect(page,info,'ambiguous-MENU-NEW')
  await settings(page); await page.getByRole('button',{name:/^週メニュー /}).click(); await page.getByRole('button',{name:/通常メニュー/}).click()
  await expect(entry.locator('b')).toHaveText('：ダンベルプレス'); await expect(entry.getByRole('alert')).toBeVisible(); await inspect(page,info,'ambiguous-MENU-EDIT')
  await entry.getByRole('button',{name:'編集',exact:true}).click(); await expect(page.getByRole('combobox',{name:'部位',exact:true})).toHaveValue('unset')
  await expect(page.getByRole('button',{name:'保存',exact:true})).toBeDisabled(); await inspect(page,info,'ambiguous-MENU-edit-route')
  expect(await saved(page)).toEqual(d)
})

test('Q08 independent Default/Option editing persists both; discard and failed save preserve previous effective definitions',async({page},info)=>{
  const data=fixture(); data.displayPreferences=structuredClone(custom) as CanonicalAppData['displayPreferences']
  const d=await seed(page,data), before=await stores(page)
  await settings(page); await page.getByRole('button',{name:/^表示設定/}).click()
  const def=page.getByRole('region',{name:'Default',exact:true}), opt=page.getByRole('region',{name:'Option',exact:true})
  await def.getByRole('button',{name:'推奨曜日を上へ'}).click(); await def.getByLabel('未実施先',{exact:true}).check()
  await opt.getByRole('button',{name:'実施状況を上へ'}).click()
  await expect(def.locator('.sort-priority-row').first()).toContainText('推奨曜日')
  await expect(opt.locator('.sort-priority-row').first()).toContainText('実施状況')
  await expect(def.getByLabel('未実施先',{exact:true})).toBeChecked(); await expect(opt.getByLabel('実施済先',{exact:true})).toBeChecked()
  expect(await stores(page)).toEqual(before); await inspect(page,info,'DISPLAY-independent-drafts')
  await page.getByRole('button',{name:'設定を保存',exact:true}).click(); await expect(page.getByRole('heading',{name:'設定',exact:true})).toBeVisible()
  const prefs={defaultSort:{priority:['recommendedDay','bodyRegion','completion'],completionDirection:'incompleteFirst'},optionSort:{priority:['completion','bodyRegion','recommendedDay'],completionDirection:'completeFirst'},bodyRegionOrder:custom.bodyRegionOrder}
  const first={...d,displayPreferences:prefs}; expect(await saved(page)).toEqual(first)
  await page.reload(); await settings(page); await page.getByRole('button',{name:/^表示設定/}).click()
  await expect(def.locator('.sort-priority-row').first()).toContainText('推奨曜日'); await expect(opt.locator('.sort-priority-row').first()).toContainText('実施状況')
  await expect(opt.getByLabel('実施済先',{exact:true})).toBeChecked()
  await opt.getByRole('button',{name:'部位を上へ'}).click(); await page.getByRole('button',{name:'‹ 戻る',exact:true}).click()
  await page.getByRole('button',{name:/^表示設定/}).click(); await expect(opt.locator('.sort-priority-row').first()).toContainText('実施状況')
  expect(await saved(page)).toEqual(first)
  await opt.getByLabel('未実施先',{exact:true}).check()
  await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;(window as unknown as {restorePut:()=>void}).restorePut=()=>{IDBObjectStore.prototype.put=original};IDBObjectStore.prototype.put=function(...args:Parameters<IDBObjectStore['put']>){if(this.name==='canonical')throw new DOMException('fixture quota','QuotaExceededError');return original.apply(this,args)}})
  await page.getByRole('button',{name:'設定を保存',exact:true}).click(); await expect(page.getByRole('alert')).toContainText('保存に失敗しました')
  expect(await saved(page)).toEqual(first); await expect(opt.getByLabel('未実施先',{exact:true})).toBeChecked(); await inspect(page,info,'DISPLAY-save-failure')
  await page.evaluate(()=>(window as unknown as {restorePut:()=>void}).restorePut())
  await page.getByRole('button',{name:'設定を保存',exact:true}).click(); await expect(page.getByRole('heading',{name:'設定',exact:true})).toBeVisible()
  const expected={...first,displayPreferences:{...prefs,optionSort:{...prefs.optionSort,completionDirection:'incompleteFirst'}}}
  expect(await saved(page)).toEqual(expected)
  const after=await stores(page); for(const name of Object.keys(before).filter(name=>name!=='canonical'))expect(after[name]).toEqual(before[name])
  record(info,'display-independent-readback',{before,first,after,expected})
})
