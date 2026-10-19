// Executes QA's Issue #28 TEST_SPEC; does not replace QA's acceptance criteria.
import { test, expect, type Page, type TestInfo } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { canonicalFixture } from '../src/canonical/fixtures'
import { createCanonicalSession } from '../src/canonical/runtime'
import { validateCanonical } from '../src/canonical/validate'
import type { CanonicalAppData } from '../src/canonical/types'

const before = process.env.ISSUE28_BEFORE === '1'
const evidence = `evidence/issue28/${before ? 'before' : 'after'}`
const now = new Date('2026-10-20T12:00:00+09:00')
function fixture(): CanonicalAppData {
  const d = structuredClone(canonicalFixture)
  d.exercises[0].classifications = [{ kind: 'bodyRegion', label: '背中' }]
  d.trainingItems[0].displayName = 'プルダウン'
  d.trainingItems[0].managementMode = 'TRAINER'
  d.trainingItems[0].seat = '標準1'
  d.trainingItems[0].standardMemo = '標準メモ'
  d.trainingItemSettingChanges[0].snapshot = { weight: 18, reps: 15, sets: 5, seat: '標準1', standardMemo: '標準メモ' }
  d.exercises.push({ ...d.exercises[0], id: 'ex-other', name: '別種目' })
  d.trainingItems.push({ ...d.trainingItems[0], id: 'ti-other', managementMode: 'MAN', exerciseId: 'ex-other', displayName: 'とても長い未実施の種目名・背中のトレーニング表示確認' })
  d.trainingItemSettingChanges.push({ ...d.trainingItemSettingChanges[0], id: 'change-other', trainingItemId: 'ti-other' })
  d.menuEntries = Array.from({ length: 6 }, (_, i) => ({ ...d.menuEntries[0], id: `entry-${i}`, trainingItemId: i < 2 ? 'item-1' : 'ti-other', recommendedDay: i % 2 as 0 | 1, order: i }))
  d.sessions = [createCanonicalSession({ id: 'mon-normal', item: d.trainingItems[0], exercise: d.exercises[0], date: '2026-10-19', performedAt: '2026-10-19T00:30:00+09:00', performedOrder: 0, menuEntryId: 'entry-1', weight: 42.25, reps: 8, sets: 3, seat: '実績3', memo: '実績メモ', bodyWeight: 66 })]
  expect(validateCanonical(d).errors).toEqual([])
  return d
}
async function seed(page: Page, d: CanonicalAppData) {
  await page.clock.install({ time: now }); await page.clock.setFixedTime(now)
  await page.goto('/')
  await page.getByRole('heading', { name: '今週の実施メニュー' }).waitFor()
  await page.evaluate(async data => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('training-check-v1r11-candidate', 7); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
    const tx = db.transaction(['canonical', 'cutover'], 'readwrite')
    tx.objectStore('canonical').put(data, 'app'); tx.objectStore('cutover').put({ authoritative: true, establishedAt: '2026-10-19T00:00:00+09:00' }, 'state')
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error) }); db.close()
  }, d)
  await page.reload()
  await page.getByRole('heading', { name: '今週の実施メニュー' }).waitFor()
}
async function read(page: Page): Promise<CanonicalAppData> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open('training-check-v1r11-candidate', 7); r.onsuccess = () => resolve(r.result) })
    const data = await new Promise<CanonicalAppData>(resolve => { const r = db.transaction('canonical').objectStore('canonical').get('app'); r.onsuccess = () => resolve(r.result) }); db.close(); return data
  })
}
async function top(page: Page) {
  await page.getByRole('button', { name: '共通メニュー' }).click()
  await page.getByRole('button', { name: '実施メニュー', exact: true }).click()
}
async function days(page: Page, values: string[]) {
  await page.getByRole('button', { name: '推奨曜日', exact: true }).click()
  await page.locator('.weekday-dropdown-trigger').click()
  for (const day of ['月', '火', '水', '木', '金', '土', '日']) await page.getByRole('group', { name: '推奨曜日を複数選択' }).getByLabel(day, { exact: true }).setChecked(values.includes(day))
  await page.locator('.weekday-dropdown-trigger').click()
  await page.getByLabel('実施済も表示').check()
}
function save(info: TestInfo, name: string, value: unknown) {
  mkdirSync(evidence, { recursive: true })
  writeFileSync(`${evidence}/${info.project.name}-${name}.json`, JSON.stringify(value, null, 2))
}
test('2-1/2-3/2-4/3-1..5/4-1 before-after UI and persistent standard-setting evidence', async ({ page }, info) => {
  const d = fixture(); await seed(page, d)
  await days(page, ['月', '火'])
  const row = page.locator('[data-session-id="mon-normal"]')
  const status = await row.locator('.item-status').evaluate(el => ({ font: getComputedStyle(el).fontSize, rect: el.getBoundingClientRect().toJSON() }))
  const title = await row.locator('b').boundingBox()
  const weekly = await page.getByText('今週の実施総数').innerText()
  await page.screenshot({ path: `${evidence}/${info.project.name}-top.png`, fullPage: true }).catch(async () => { mkdirSync(evidence, { recursive: true }); await page.screenshot({ path: `${evidence}/${info.project.name}-top.png`, fullPage: true }) })
  await page.getByRole('button', { name: '部位表示', exact: true }).click()
  const region = page.getByRole('button').filter({ has: page.locator('b', { hasText: '背中' }) })
  const regionText = await region.innerText()
  if (!before) { expect(weekly).toContain('1/6'); expect(regionText).toContain('1/6'); expect(parseFloat(status.font)).toBeGreaterThanOrEqual(12); expect(status.rect.y).toBeGreaterThanOrEqual(title!.y); expect(status.rect.y + status.rect.height).toBeLessThanOrEqual(title!.y + title!.height); expect(title!.x + title!.width).toBeLessThanOrEqual(status.rect.x) }
  await region.click(); await page.getByLabel('実施済も表示').check()
  await expect(page.locator('[data-session-id]')).toHaveCount(1)
  await page.locator('[data-menu-entry-id="entry-2"]').click()
  const weight = await page.locator('.weight-controls b').evaluate(el => ({ text: el.textContent, font: getComputedStyle(el).fontSize, rect: el.getBoundingClientRect().toJSON(), overflow: el.scrollWidth > el.clientWidth }))
  const seat = await page.getByLabel('シート位置', { exact: true }).boundingBox()
  const seatLabel = await page.locator('.seat-inline').boundingBox()
  const inputsBefore = await page.locator('.run-weight,.run-slot-grid,.history-link,.run-meta,.seat-inline,textarea,.save-setting:not(.danger)').count()
  await page.screenshot({ path: `${evidence}/${info.project.name}-run-pending.png`, fullPage: true })
  if (!before) {
    const oldFont = info.project.name === 'desktop' ? 14 : 13
    expect(parseFloat(weight.font)).toBeCloseTo(oldFont + 4 / 3, 2)
    expect(weight.overflow).toBe(false)
    expect(Math.abs(seat!.x + seat!.width - seatLabel!.x - seatLabel!.width)).toBeLessThan(1)
    await expect(page.getByText(/週メニュー:/)).toHaveCount(0)
    await page.getByLabel('シート位置', { exact: true }).fill('未実施4')
    page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'この設定を登録', exact: true }).click()
    await expect.poll(async () => (await read(page)).trainingItems[1].seat).toBe('未実施4')
    expect((await read(page)).sessions).toEqual(d.sessions)
    await expect(page.getByText('標準設定を保存しました。', { exact: true })).toHaveCount(0)
  }
  await top(page); await days(page, ['月', '火']); await page.locator('[data-session-id="mon-normal"]').click()
  await page.screenshot({ path: `${evidence}/${info.project.name}-run-completed.png`, fullPage: true })
  const buttonCount = await page.getByRole('button', { name: 'この設定を登録', exact: true }).count()
  save(info, 'ui', { baseline: '943aa2aa', weekly, regionText, status, title, weight, seat, seatLabel, inputsBefore, completedStandardButtonCount: buttonCount })
  if (before) return
  expect(buttonCount).toBe(1)
  expect(await page.locator('.run-weight,.run-slot-grid,.history-link,.run-meta,.seat-inline,textarea,.save-setting:not(.danger)').count()).toBe(inputsBefore)
  for (const button of await page.locator('.weight-controls button,.run-slot button').all()) await expect(button).toBeDisabled()
  await expect(page.getByLabel('シート位置', { exact: true })).toBeDisabled()
  await expect(page.locator('textarea')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'この設定を登録', exact: true })).toBeEnabled()
  await expect(page.getByText('この版ではトレーナー管理に戻せません。')).toHaveCount(0)
  const prior = await read(page)
  page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'この設定を登録', exact: true }).click()
  await expect.poll(async () => (await read(page)).trainingItems[0].weight).toBe(42.25)
  const stored = await read(page)
  expect(stored.sessions).toEqual(prior.sessions)
  expect(stored.menuEntries).toEqual(prior.menuEntries)
  expect(stored.trainingItems[0]).toMatchObject({ weight: 42.25, reps: 8, sets: 3, seat: '実績3', standardMemo: '標準メモ', managementMode: 'TRAINER' })
  expect(stored.trainingItemSettingChanges).toHaveLength(prior.trainingItemSettingChanges.length + 1)
  expect(stored.trainingItemSettingChanges.at(-1)).toMatchObject({ trainingItemId: 'item-1', isInitial: false, snapshot: { weight: 42.25, reps: 8, sets: 3, seat: '実績3', standardMemo: '標準メモ' } })
  await expect(page.getByText('標準設定を保存しました。', { exact: true })).toHaveCount(0)
  await page.reload(); expect(await read(page)).toEqual(stored)
  save(info, 'standard-readback', { before: prior, after: stored, sessionsUnchanged: JSON.stringify(prior.sessions) === JSON.stringify(stored.sessions) })
})

test('2-3/2-4/2-5 repeated Exercise, Extra, historical region and local day/week boundaries', async ({ page }, info) => {
  test.skip(before, 'after-change regression from QA fixture matrix')
  const d = fixture(), first = d.sessions[0]
  d.sessions.push(
    { ...structuredClone(first), id: 'mon-extra', menuEntryId: undefined, performedOrder: 1 },
    { ...structuredClone(first), id: 'tue', date: '2026-10-20', performedAt: '2026-10-20T00:05:00+09:00' },
    { ...structuredClone(first), id: 'previous-week', date: '2026-10-18', performedAt: '2026-10-18T23:59:00+09:00' },
    { ...structuredClone(first), id: 'next-week', date: '2026-10-26', performedAt: '2026-10-26T00:00:00+09:00' },
    { ...structuredClone(first), id: 'tue-extra-other', trainingItemId: 'ti-other', menuEntryId: undefined, date: '2026-10-20', performedAt: '2026-10-20T12:00:00+09:00', snapshot: { ...first.snapshot, exerciseId: 'ex-other', classifications: [{ kind: 'bodyRegion', label: '胸' }] } },
  )
  expect(validateCanonical(d).errors).toEqual([])
  await seed(page, d)
  await expect(page.getByText('今日の実施総数')).toContainText('2/2')
  await expect(page.getByText('今週の実施総数')).toContainText('4/6')
  await days(page, ['月']); await expect(page.locator('[data-session-id]')).toHaveCount(2)
  expect(await page.locator('[data-session-id]').evaluateAll(rows => rows.map(row => row.getAttribute('data-session-id')))).toEqual(['mon-extra', 'mon-normal'])
  await days(page, ['火']); await expect(page.locator('[data-session-id]')).toHaveCount(2)
  expect(await page.locator('[data-session-id]').evaluateAll(rows => rows.map(row => row.getAttribute('data-session-id')))).toEqual(['tue-extra-other', 'tue'])
  await days(page, []); await expect(page.locator('[data-session-id]')).toHaveCount(0)
  await page.getByRole('button', { name: '部位表示', exact: true }).click()
  await expect(page.getByRole('button').filter({ has: page.locator('b', { hasText: '背中' }) })).toContainText('3/6')
  await page.getByRole('button').filter({ has: page.locator('b', { hasText: '背中' }) }).click(); await page.getByLabel('実施済も表示').check()
  await expect(page.locator('[data-session-id]')).toHaveCount(3)
  expect(await read(page)).toEqual(d)
  save(info, 'counts', { today: '2/2', week: '4/6', back: '3/6', monday: ['mon-extra','mon-normal'], tuesday: ['tue-extra-other','tue'], unchanged: true })
})

test('0 Sessions and non-Monday week start preserve planned filters and denominators', async ({ page }, info) => {
  test.skip(before, 'after-change regression from QA fixture matrix')
  const d = fixture(); d.weekStartsOn = 6
  d.sessions = [{ ...d.sessions[0], id: 'sunday-extra', menuEntryId: undefined, date: '2026-10-18', performedAt: '2026-10-18T23:59:00+09:00' }]
  await seed(page, d); await expect(page.getByText('今週の実施総数')).toContainText('1/6')
  await days(page, ['日']); await expect(page.locator('[data-session-id]')).toHaveCount(1)
  await expect(page.locator('[data-menu-entry-id]')).toHaveCount(0)
  // Another page in the same isolated test context; no production/Owner partition involved.
  d.sessions = []
  const zero = await page.context().newPage(); await seed(zero, d)
  await expect(zero.getByText('今日の実施総数')).toContainText('0/2')
  await expect(zero.getByText('今週の実施総数')).toContainText('0/6')
  await days(zero, ['月']); await expect(zero.locator('[data-menu-entry-id]')).toHaveCount(3)
  await expect(zero.locator('[data-session-id]')).toHaveCount(0)
  expect(await read(zero)).toEqual(d)
  save(info, 'week-zero', { sundayStartWeeklyCount: 1, zeroWeekly: '0/6', mondayPlanned: 3 })
})

test('narrow long title and three-digit decimal weight remain visible', async ({ page }, info) => {
  test.skip(before, 'after-change edge coverage')
  const d = fixture()
  d.trainingItems[1].weight = 125.25
  await seed(page, d); await days(page, ['月', '火'])
  const row = page.locator('[data-menu-entry-id="entry-2"]')
  const title = await row.locator('b').boundingBox()
  const status = await row.locator('.item-status').boundingBox()
  expect(title!.x + title!.width).toBeLessThanOrEqual(status!.x)
  await row.click()
  const weight = await page.locator('.weight-controls b').evaluate(el => ({ text: el.textContent, width: el.clientWidth, scrollWidth: el.scrollWidth }))
  expect(weight.text).toBe('125.25 kg')
  expect(weight.scrollWidth).toBeLessThanOrEqual(weight.width)
  await page.screenshot({ path: `${evidence}/${info.project.name}-large-weight.png`, fullPage: true })
  save(info, 'large-weight', weight)
})
