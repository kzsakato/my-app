// Oracle: formal app-design V1.2 addenda; Issue #30 QA #6385055723.
// TOP/REGION mixed sort: Technical #6433073812 and QA #6433103067 / TEST_SPEC cbafbcea.
import { test, expect, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { canonicalFixture } from '../src/canonical/fixtures'
import { defaultDisplayPreferences } from '../src/canonical/displayPreferences'
import type { CanonicalAppData } from '../src/canonical/types'

const now = new Date('2026-10-24T12:00:00+09:00')
function fixture() {
  const d = structuredClone(canonicalFixture)
  d.sessions = []
  d.exercises = ['肩','胸','背中','腕','独自'].map((label, i) => ({ ...d.exercises[0], id: `ex-${i}`, name: ['オ肩','イ胸','ウ背','ア腕','カ独自'][i], classifications: [{ kind: 'bodyRegion' as const, label }] }))
  d.trainingItems = d.exercises.map((ex, i) => ({ ...d.trainingItems[0], id: `ti-${i}`, exerciseId: ex.id, displayName: ex.name }))
  d.trainingItems.push({ ...d.trainingItems[1], id: 'ti-chest-2', displayName: '別の胸TI' })
  d.menuEntries = d.trainingItems.map((ti, i) => ({ ...d.menuEntries[0], id: `entry-${i}`, trainingItemId: ti.id, recommendedDay: (i === 1 ? 0 : 5) as 0 | 5, order: 10 + i }))
  d.trainingItemSettingChanges = d.trainingItems.map((ti, i) => ({ ...canonicalFixture.trainingItemSettingChanges[0], id: `change-${i}`, trainingItemId: ti.id }))
  for (const [i, date] of ['2026-10-22','2026-10-21','2026-10-25'].entries()) d.sessions.push({ ...structuredClone(canonicalFixture.sessions[0]), id: `session-${i}`, date, performedAt: `${date}T09:00:00+09:00`, trainingItemId: `ti-${i + 1}`, menuEntryId: undefined, snapshot: { ...canonicalFixture.sessions[0].snapshot, exerciseId: `ex-${i + 1}`, trainingItemDisplayName: d.trainingItems[i+1].displayName, classifications: d.exercises[i+1].classifications } })
  return d
}
async function seed(page: Page, data = fixture()) {
  await page.clock.install({ time: now }); await page.clock.setFixedTime(now)
  await page.goto('/')
  await page.evaluate(async data => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('training-check-v1r11-candidate', 7); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
    const tx = db.transaction(['canonical','cutover'], 'readwrite')
    tx.objectStore('canonical').put(data, 'app'); tx.objectStore('cutover').put({ authoritative: true, establishedAt: '2026-10-24T00:00:00+09:00' }, 'state')
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error) }); db.close()
  }, data)
  await page.reload()
  await expect(page.getByRole('heading', { name: '今週の実施メニュー' })).toBeVisible()
  return data
}
async function read(page: Page): Promise<CanonicalAppData> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open('training-check-v1r11-candidate', 7); r.onsuccess = () => resolve(r.result) })
    const value = await new Promise<CanonicalAppData>(resolve => { const r = db.transaction('canonical').objectStore('canonical').get('app'); r.onsuccess = () => resolve(r.result) }); db.close(); return value
  })
}
async function settings(page: Page) { await page.getByRole('button', { name: '共通メニュー' }).click(); await page.getByRole('button', { name: '設定', exact: true }).click() }
async function top(page: Page) { await page.getByRole('button', { name: '共通メニュー' }).click(); await page.getByRole('button', { name: '実施メニュー', exact: true }).click() }
async function screenshot(page: Page, project: string, name: string) { const directory = process.env.V12_EVIDENCE_ROOT ?? 'evidence/issue30-v12'; mkdirSync(directory, { recursive: true }); await page.screenshot({ path: `${directory}/${project}-${name}.png`, fullPage: true }) }

test('display editor: approved controls, discard, explicit save/reload/readback and no non-target changes', async ({ page }, info) => {
  const d = await seed(page); await settings(page)
  const root = page.locator('main > button.row b')
  const text = await root.allTextContents()
  expect(text.indexOf('表示設定')).toBe(text.indexOf('週メニュー') + 1)
  expect(text.indexOf('分析')).toBe(text.indexOf('表示設定') + 1)
  await page.getByRole('button', { name: /^表示設定/ }).click()
  await expect(page.getByRole('tab')).toHaveCount(0)
  await expect(page.getByText('最後の比較条件')).toHaveCount(0)
  await expect(page.getByText('現在の設定例')).toHaveCount(0)
  const def = page.getByRole('region', { name: 'Default', exact: true })
  await def.getByRole('button', { name: '部位を上へ' }).click()
  await def.getByLabel('実施済先', { exact: true }).check()
  expect(await read(page)).toEqual(d)
  await page.getByRole('button', { name: '‹ 戻る', exact: true }).click()
  await page.getByRole('button', { name: /^表示設定/ }).click()
  await expect(def.getByLabel('未実施先', { exact: true })).toBeChecked()
  await def.getByRole('button', { name: '部位を上へ' }).click()
  await def.getByRole('button', { name: '部位を上へ' }).click()
  await def.getByLabel('実施済先', { exact: true }).check()
  await screenshot(page, info.project.name, 'display-editor')
  await page.getByRole('button', { name: '設定を保存', exact: true }).click()
  await expect(page.getByRole('heading', { name: '設定', exact: true })).toBeVisible()
  const saved = await read(page), { displayPreferences: prefs, ...facts } = saved
  expect(facts).toEqual(d)
  expect(prefs).toEqual({ ...defaultDisplayPreferences, defaultSort: { priority: ['bodyRegion','recommendedDay','completion'], completionDirection: 'completeFirst' } })
  await page.reload(); await settings(page); await page.getByRole('button', { name: /^表示設定/ }).click()
  await expect(def.locator('.sort-priority-row').first()).toContainText('部位')
  await expect(def.getByLabel('実施済先', { exact: true })).toBeChecked()
})

test('Extra AND exclusion N+1, all TIs per Exercise, future outside, Option reset and snapshot invariants', async ({ page }, info) => {
  const d = await seed(page)
  await page.getByRole('button', { name: '＋ 追加トレーニングを登録' }).click()
  const rows = page.locator('[data-training-item-id]')
  expect(await rows.locator('b').allTextContents()).toEqual(['胸：イ胸','胸：別の胸TI','背中：ウ背','腕：ア腕','肩：オ肩','独自：カ独自'])
  await expect(page.getByLabel('Optionソート')).not.toBeChecked()
  await page.getByLabel('除外', { exact: true }).selectOption('2')
  expect(await rows.locator('b').allTextContents()).toEqual(['背中：ウ背','腕：ア腕','肩：オ肩','独自：カ独自'])
  // V12-07 Owner FIX: retain details/operation and add existing fourteen-day history.
  await expect(rows.first()).toContainText('18 kg × 15 回 × 5 セット')
  await expect(page.getByText('追加分は実施総数に含めます。週メニューへの登録は変更しません。')).toBeVisible()
  await expect(page.locator('.item-history')).toHaveCount(4)
  await page.getByLabel('部位', { exact: true }).selectOption('背中')
  await expect(rows).toHaveCount(1)
  await page.getByLabel('除外', { exact: true }).selectOption('4')
  await expect(rows).toHaveCount(0)
  await page.getByLabel('部位', { exact: true }).selectOption('腕')
  await expect(rows).toHaveCount(1) // future Session must never exclude this Exercise
  await page.getByLabel('Optionソート').check()
  await screenshot(page, info.project.name, 'extra')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(await read(page)).toEqual(d)
  await top(page); await page.getByRole('button', { name: '＋ 追加トレーニングを登録' }).click()
  await expect(page.getByLabel('Optionソート')).not.toBeChecked()
  await expect(page.getByLabel('除外', { exact: true })).toHaveValue('0')
})

test('MENU one Option affects both projections but never order/model/save payload; EX/TI lists reset Option', async ({ page }) => {
  const d = await seed(page)
  d.displayPreferences = structuredClone(defaultDisplayPreferences)
  d.displayPreferences.optionSort.priority = ['bodyRegion','recommendedDay','completion']
  d.menuEntries[0].recommendedDay = 0
  d.menuEntries[1].recommendedDay = 5
  await seedWithoutClock(page, d)
  await settings(page); await page.getByRole('button', { name: /週メニュー.*実施項目と推奨曜日/ }).click()
  await page.getByRole('button', { name: /通常メニュー/ }).click()
  await expect(page.getByLabel('Optionソート')).toHaveCount(1)
  expect(await page.locator('[data-menu-entry-id]').evaluateAll(rows => rows.map(row => row.getAttribute('data-menu-entry-id')))).toEqual(['entry-0','entry-1','entry-5','entry-2','entry-3','entry-4'])
  await page.getByLabel('Optionソート').check()
  expect(await page.locator('[data-menu-entry-id]').evaluateAll(rows => rows.map(row => row.getAttribute('data-menu-entry-id')))).toEqual(['entry-1','entry-5','entry-2','entry-3','entry-0','entry-4'])
  await expect(page.getByText('推奨曜日順に表示')).toHaveCount(0)
  expect(await read(page)).toEqual(d)
  await page.getByRole('button', { name: '保存', exact: true }).click()
  expect((await read(page)).menuEntries).toEqual(d.menuEntries)
  await page.getByRole('button', { name: '‹ 戻る', exact: true }).click()
  await page.getByRole('button', { name: /^種目 / }).click()
  await page.getByLabel('Optionソート').check()
  await page.getByRole('button', { name: '‹ 戻る', exact: true }).click()
  await page.getByRole('button', { name: /^実施項目 / }).click()
  await expect(page.getByLabel('Optionソート')).not.toBeChecked()
})
async function seedWithoutClock(page: Page, data: CanonicalAppData) {
  await page.evaluate(async data => {
    const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open('training-check-v1r11-candidate', 7); r.onsuccess = () => resolve(r.result) })
    const tx = db.transaction('canonical','readwrite'); tx.objectStore('canonical').put(data,'app'); await new Promise<void>(resolve => { tx.oncomplete = () => resolve() }); db.close()
  }, data)
  await page.reload()
}

test('classification warning edits only the explicit Exercise; snapshot history survives', async ({ page }, info) => {
  const data = fixture(); data.exercises[0].classifications = []
  const d = await seed(page, data)
  await page.getByRole('button', { name: '＋ 追加トレーニングを登録' }).click()
  const row = page.locator('[data-training-item-id="ti-0"]')
  await expect(row.getByRole('alert')).toContainText('bodyRegion')
  await row.getByRole('button', { name: '編集', exact: true }).click()
  await expect(page.getByRole('heading', { name: '種目を編集' })).toBeVisible()
  await expect(page.getByRole('button', { name: '保存', exact: true })).toBeDisabled()
  await page.getByLabel('部位', { exact: true }).selectOption('肩')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  const saved = await read(page)
  expect(saved.sessions).toEqual(d.sessions)
  expect(saved.trainingItems).toEqual(d.trainingItems)
  expect(saved.exercises.slice(1)).toEqual(d.exercises.slice(1))
  expect(saved.exercises[0].classifications).toEqual([{ kind: 'bodyRegion', label: '肩' }])
  await screenshot(page, info.project.name, 'classification-repaired')
})

test('old Backup preview warns with effective values; cancel is no-op; explicit restore/export/reload keeps exact candidate', async ({ page }, info) => {
  const d = await seed(page); await settings(page); await page.getByRole('button', { name: /データ管理/ }).click()
  const payload = structuredClone(d); payload.profile.weight = 72
  const envelope = { format: 'training-check-backup', schemaVersion: 1, createdAt: now.toISOString(), payload }
  await page.getByLabel('正規バックアップを選択').setInputFiles({ name: 'old.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(envelope)) })
  await expect(page.getByText('入力値を確認してください。', { exact: false })).toHaveCount(3)
  await expect(page.locator('.preference-preview')).toContainText('胸 → 背中 → 腕 → 肩 → 下半身 → 体幹 → その他')
  const restore = page.getByRole('button', { name: '全データを置き換えて復元' })
  await expect(restore).toBeDisabled()
  await page.getByLabel('警告内容を確認しました').check()
  page.once('dialog', dialog => dialog.dismiss()); await restore.click()
  expect(await read(page)).toEqual(d)
  await screenshot(page, info.project.name, 'backup-preview')
  page.once('dialog', dialog => dialog.accept()); await restore.click()
  await expect(page.getByRole('status')).toContainText('読み戻し一致')
  const saved = await read(page)
  expect(saved).toEqual({ ...payload, displayPreferences: defaultDisplayPreferences })
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'バックアップを作成', exact: true }).click()
  const file = await download; const stream = await file.createReadStream(); const chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(Buffer.from(chunk))
  expect(JSON.parse(Buffer.concat(chunks).toString()).payload).toEqual(saved)
  await page.reload(); expect(await read(page)).toEqual(saved)
})

test('TOP weekday all ON/OFF preserves completed flag; approved +1pt status and unchanged run weight', async ({ page }, info) => {
  const d = await seed(page)
  await page.getByLabel('実施済も表示').check()
  await page.locator('.weekday-dropdown-trigger').click()
  await page.getByRole('button', { name: '全OFF', exact: true }).click()
  await expect(page.getByRole('group', { name: '推奨曜日を複数選択' }).getByRole('checkbox', { checked: true })).toHaveCount(0)
  await expect(page.getByLabel('実施済も表示')).toBeChecked()
  await page.getByRole('button', { name: '全ON', exact: true }).click()
  await expect(page.getByRole('group', { name: '推奨曜日を複数選択' }).getByRole('checkbox', { checked: true })).toHaveCount(7)
  await page.locator('.weekday-dropdown-trigger').click()
  const font = await page.locator('.item-status').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize))
  expect(font).toBeCloseTo(12 + 96/72, 3)
  await screenshot(page, info.project.name, 'top-partial')
  await page.locator('[data-menu-entry-id="entry-0"]').click()
  const weight = await page.locator('.run-weight .weight-controls b').evaluate(el => parseFloat(getComputedStyle(el).fontSize))
  expect(weight).toBeCloseTo((info.project.name === 'pc' ? 14 : 13) + 96/72, 3)
  expect(await read(page)).toEqual(d)
})

test('display save quota failure remains on draft, preserves storage and supports explicit retry', async ({ page }) => {
  const d = await seed(page); await settings(page); await page.getByRole('button', { name: /^表示設定/ }).click()
  await page.getByRole('region', { name: 'Default', exact: true }).getByLabel('実施済先', { exact: true }).check()
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put
    ;(window as unknown as { restorePut: () => void }).restorePut = () => { IDBObjectStore.prototype.put = original }
    IDBObjectStore.prototype.put = function(...args: Parameters<IDBObjectStore['put']>) { if (this.name === 'canonical') throw new DOMException('test quota failure', 'QuotaExceededError'); return original.apply(this,args) }
  })
  await page.getByRole('button', { name: '設定を保存', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('保存に失敗しました')
  await expect(page.getByRole('heading', { name: '表示設定', exact: true })).toBeVisible()
  expect(await read(page)).toEqual(d)
  await page.evaluate(() => (window as unknown as { restorePut: () => void }).restorePut())
  await page.getByRole('button', { name: '設定を保存', exact: true }).click()
  await expect(page.getByRole('heading', { name: '設定', exact: true })).toBeVisible()
  expect((await read(page)).displayPreferences!.defaultSort.completionDirection).toBe('completeFirst')
})

function connectionFixture() {
  const d = fixture()
  const session = (id: string, itemId: string, date: string, performedAt: string, order: number, entryId: string | undefined, region: string | undefined) => {
    const item = d.trainingItems.find(row => row.id === itemId)!, exercise = d.exercises.find(row => row.id === item.exerciseId)!
    return { ...structuredClone(canonicalFixture.sessions[0]), id, trainingItemId: itemId, menuEntryId: entryId, date, performedAt, performedOrder: order,
      snapshot: { ...canonicalFixture.sessions[0].snapshot, exerciseId: exercise.id, exerciseName: `記録種目-${id}`, trainingItemDisplayName: `記録-${id}`, classifications: region ? [{ kind: 'bodyRegion' as const, label: region }] : undefined } }
  }
  d.sessions = [
    session('actual-a','ti-1','2026-10-24','2026-10-24T03:00:00Z',0,'entry-1','履歴部位'),
    session('actual-b','ti-chest-2','2026-10-24','2026-10-24T03:00:00Z',1,'entry-5','胸'),
    session('extra-missing','ti-1','2026-10-23','2026-10-23T09:00:00+09:00',0,undefined,undefined),
    session('snapshot-only','ti-2','2026-10-24','2026-10-24T04:00:00Z',0,undefined,'過去部位'),
    session('previous-week','ti-0','2026-10-18','2026-10-18T09:00:00+09:00',0,undefined,'肩'),
    session('next-week','ti-4','2026-10-26','2026-10-26T09:00:00+09:00',0,undefined,'独自'),
  ]
  return d
}
const planned = (page: Page) => page.locator('[data-projection="planned"] [data-menu-entry-id]')
const actuals = (page: Page) => page.locator('[data-projection="actual"] [data-session-id]')
const entryIds = (page: Page) => planned(page).evaluateAll(rows => rows.map(row => row.getAttribute('data-menu-entry-id')))
const actualIds = (page: Page) => actuals(page).evaluateAll(rows => rows.map(row => row.getAttribute('data-session-id')))
async function allDays(page: Page) { await page.locator('.weekday-dropdown-trigger').click(); await page.getByRole('button', { name: '全ON', exact: true }).click(); await page.locator('.weekday-dropdown-trigger').click() }
async function openRegion(page: Page, name: string) {
  await page.getByRole('button', { name: '部位表示', exact: true }).click()
  await page.getByRole('button').filter({ has: page.locator('b', { hasText: new RegExp(`^${name}$`) }) }).click()
}

test('TOP two projections: completed Entries hidden with independent sort/filters; every Session and counts/load are preserved', async ({ page }, info) => {
  const d = await seed(page, connectionFixture()); await allDays(page)
  await expect(page.getByLabel('Optionソート')).not.toBeChecked()
  expect(await entryIds(page)).toEqual(['entry-3','entry-0','entry-4'])
  await expect(actuals(page)).toHaveCount(0)
  await expect(planned(page).filter({ hasText: '実施済' })).toHaveCount(0)
  await page.getByLabel('実施済も表示').check()
  expect(await actualIds(page)).toEqual(['extra-missing','actual-b','snapshot-only','actual-a'])
  await expect(page.locator('[data-session-id="actual-a"] b')).toHaveText('記録-actual-a')
  await expect(page.getByText('今週の実施総数')).toContainText('4/6')
  const loadText = await page.locator('.load-summary').innerText()
  await page.getByLabel('Optionソート').check()
  expect(await entryIds(page)).toEqual(['entry-3','entry-0','entry-4'])
  expect(await actualIds(page)).toEqual(['extra-missing','actual-b','snapshot-only','actual-a'])
  await page.getByLabel('実施済も表示').uncheck()
  await expect(actuals(page)).toHaveCount(0)
  await expect(planned(page)).toHaveCount(3)
  await expect(planned(page).filter({ hasText: '実施済' })).toHaveCount(0)
  await page.getByLabel('実施済も表示').check()
  await page.locator('.weekday-dropdown-trigger').click(); await page.getByRole('button', { name: '全OFF', exact: true }).click()
  await expect(planned(page)).toHaveCount(0); await expect(actuals(page)).toHaveCount(0)
  await expect(page.getByLabel('実施済も表示')).toBeChecked()
  await page.getByRole('group', { name: '推奨曜日を複数選択' }).getByLabel('月', { exact: true }).check()
  expect(await entryIds(page)).toEqual([]); await expect(actuals(page)).toHaveCount(0)
  await page.getByRole('group', { name: '推奨曜日を複数選択' }).getByLabel('土', { exact: true }).check()
  expect(await actualIds(page)).toEqual(['actual-b','snapshot-only','actual-a'])
  await page.locator('.weekday-dropdown-trigger').click(); await allDays(page)
  expect(await page.locator('.load-summary').innerText()).toBe(loadText)
  expect(await read(page)).toEqual(d)
  await screenshot(page, info.project.name, 'top-connected')
  await settings(page); await top(page); await expect(page.getByLabel('Optionソート')).not.toBeChecked()
  expect(await read(page)).toEqual(d)
})

test('REGION current planned vs snapshot actual, missing snapshot stays only in TOP; completed Entry hidden and actual opens specific Session', async ({ page }, info) => {
  const d = await seed(page, connectionFixture()); await allDays(page); await page.getByLabel('実施済も表示').check()
  expect(await actualIds(page)).toContain('extra-missing')
  await page.getByLabel('Optionソート').check(); await openRegion(page, '胸')
  await expect(page.getByLabel('Optionソート')).not.toBeChecked()
  expect(await entryIds(page)).toEqual([])
  await expect(planned(page).filter({ hasText: '実施済' })).toHaveCount(0)
  await expect(actuals(page)).toHaveCount(0)
  await page.getByLabel('実施済も表示').check(); expect(await actualIds(page)).toEqual(['actual-b'])
  await screenshot(page, info.project.name, 'region-connected')
  await page.locator('[data-session-id="actual-b"]').click()
  await expect(page.getByRole('heading', { name: '記録-actual-b', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '重量を1kg減らす' })).toBeDisabled()
  await top(page); await openRegion(page, '過去部位'); await page.getByLabel('実施済も表示').check()
  await expect(planned(page)).toHaveCount(0); expect(await actualIds(page)).toEqual(['snapshot-only'])
  await top(page); await openRegion(page, '履歴部位'); await page.getByLabel('実施済も表示').check()
  await expect(planned(page)).toHaveCount(0); expect(await actualIds(page)).toEqual(['actual-a'])
  await top(page); await openRegion(page, '背中'); await page.getByLabel('実施済も表示').check()
  expect(await entryIds(page)).toEqual([]); await expect(actuals(page)).toHaveCount(0)
  expect(await read(page)).toEqual(d)
})

test('specific repeated Session cancellation removes only selected ID and leaves Exercise completion via other actuals', async ({ page }) => {
  const d = await seed(page, connectionFixture()); await allDays(page); await page.getByLabel('実施済も表示').check()
  await page.locator('[data-session-id="actual-b"]').click()
  page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: '10/24の実行を取り消す', exact: true }).click()
  await expect(page.getByRole('heading', { name: '今週の実施メニュー' })).toBeVisible()
  const expected = { ...d, sessions: d.sessions.filter(row => row.id !== 'actual-b'), displayPreferences: defaultDisplayPreferences }
  expect(await read(page)).toEqual(expected)
  await expect(page.locator('[data-menu-entry-id="entry-1"]')).toHaveCount(0)
  await expect(page.locator('[data-menu-entry-id="entry-5"]')).toHaveCount(0)
  expect(await actualIds(page)).toEqual(['extra-missing','snapshot-only','actual-a'])
  await expect(page.getByText('今週の実施総数')).toContainText('3/6')
  await page.reload(); expect(await read(page)).toEqual(expected)
})

test('uncompleted Entry execution adds a new Session without replacing any existing actual or saved Entry order', async ({ page }) => {
  const d = await seed(page, connectionFixture()); await allDays(page)
  await page.locator('[data-menu-entry-id="entry-0"]').click()
  await page.getByRole('button', { name: '種目を完了', exact: true }).click()
  await expect(page.getByRole('heading', { name: '今週の実施メニュー' })).toBeVisible()
  const saved = await read(page)
  expect(saved.menuEntries).toEqual(d.menuEntries)
  expect(saved.trainingItems).toEqual(d.trainingItems)
  expect(saved.sessions.filter(row => d.sessions.some(old => old.id === row.id))).toEqual(d.sessions)
  expect(saved.sessions).toHaveLength(d.sessions.length + 1)
  expect(saved.sessions.at(-1)).toMatchObject({ menuEntryId: 'entry-0', trainingItemId: 'ti-0', date: '2026-10-24', snapshot: { exerciseId: 'ex-0', trainingItemDisplayName: 'オ肩' } })
  await expect(page.getByText('今週の実施総数')).toContainText('5/6')
  await page.reload(); expect(await read(page)).toEqual(saved)
})
