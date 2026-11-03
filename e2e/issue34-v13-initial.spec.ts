// QA/contract oracle: #34 #6605006790. No real browser/profile/Owner data.
import { test, expect, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { canonicalFixture } from '../src/canonical/fixtures'
import type { CanonicalAppData } from '../src/canonical/types'
const root = 'evidence/issue34-v13-initial'
const rates = { chest: 50, back: 25, arms: 15, shoulders: 5, lowerBody: 5, core: 0 }
const proposal = { format: 'training-project.trainer-proposal', version: 2, proposalId: 'p-1', baseRevision: 0, operations: [{ type: 'setInitialContribution', exerciseId: 'exercise-1', expectedState: 'NO_ENTRY', rates, reason: 'テスト専用理由' }] }
function fixture(v13 = false): CanonicalAppData {
  const d = structuredClone(canonicalFixture)
  if (v13) { d.trainerDataRevision = 0; d.contributions = { version: 1, byExerciseId: {} } }
  return d
}
async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('training-check', 7); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
    const stores = Array.from(db.objectStoreNames), tx = db.transaction(stores, 'readonly'), result: Record<string, unknown> = {}
    await Promise.all(stores.map(async name => { result[name] = await new Promise(resolve => { const r = tx.objectStore(name).getAll(); r.onsuccess = () => resolve(r.result) }) }))
    db.close(); return result
  })
}
async function seed(page: Page, d = fixture(), pending = false) {
  await page.clock.install({ time: new Date('2026-09-24T12:00:00+09:00') })
  await page.goto('/')
  await page.evaluate(async ({ d, pending }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('training-check', 7); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
    const tx = db.transaction(['canonical', 'cutover', 'state', 'baseline', 'recovery'], 'readwrite')
    tx.objectStore('canonical').put(d, 'app')
    tx.objectStore('cutover').put({ authoritative: true, establishedAt: '2026-10-01T00:00:00+09:00', ...(pending ? { trainerPendingProposalId: 'held-p' } : {}) }, 'state')
    for (const name of ['state', 'baseline', 'recovery']) tx.objectStore(name).put({ sentinel: name }, 'protected')
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error) }); db.close()
  }, { d, pending })
  await page.reload()
}
async function open(page: Page, name: string) {
  await page.getByRole('button', { name: '共通メニュー' }).click()
  await page.getByRole('button', { name: '設定', exact: true }).click()
  await page.getByRole('button', { name: new RegExp(`^${name} `) }).click()
}
test('F01/F02/F03/F05: unknown legacy provenance rejects Export/v2 without migration or file', async ({ page }, info) => {
  await seed(page)
  const before = await snapshot(page), downloads: string[] = []
  page.on('download', d => downloads.push(d.suggestedFilename()))
  await open(page, 'トレーナー連携')
  await page.getByRole('button', { name: 'トレーナー用ファイルを作る' }).click()
  await expect(page.getByText('トレーナー用ファイル作成失敗。診断情報を保存してください。')).toBeVisible()
  await page.getByLabel('提案ファイルを選ぶ').setInputFiles({ name: 'p.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(proposal)) })
  await expect(page.getByRole('button', { name: '承認', exact: true })).toHaveCount(0)
  expect(downloads).toEqual([]); expect(await snapshot(page)).toEqual(before)
  await page.reload(); expect(await snapshot(page)).toEqual(before)
  mkdirSync(root, { recursive: true }); writeFileSync(`${root}/${info.project.name}-zero-mutation.json`, JSON.stringify({ before, after: await snapshot(page) }, null, 2))
})
test('F04/F07: single v2 preview Cancel and safe apply refusal leave every store unchanged', async ({ page }) => {
  await seed(page, fixture(true)); const before = await snapshot(page)
  await open(page, 'トレーナー連携')
  const file = { name: 'p.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(proposal)) }
  await page.getByLabel('提案ファイルを選ぶ').setInputFiles(file)
  await expect(page.getByRole('heading', { name: 'トレーナー提案の確認' })).toBeVisible()
  await page.getByRole('button', { name: '取消', exact: true }).click()
  expect(await snapshot(page)).toEqual(before)
  await page.getByLabel('提案ファイルを選ぶ').setInputFiles(file)
  await page.getByRole('button', { name: '承認', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'トレーナー提案の確認' })).toHaveCount(0)
  expect(await snapshot(page)).toEqual(before)
})
test('F08: unresolved existing marker stays HELD across restart, no blind retry or Export', async ({ page }) => {
  await seed(page, fixture(), true); const before = await snapshot(page)
  for (let n = 0; n < 2; n++) {
    await open(page, 'トレーナー連携')
    await expect(page.getByLabel('提案ファイルを選ぶ')).toBeDisabled()
    await expect(page.getByRole('button', { name: 'トレーナー用ファイルを作る' })).toBeDisabled()
    expect(await snapshot(page)).toEqual(before); await page.reload()
  }
})
test('F09: coefficients cannot enter through old Backup Restore', async ({ page }) => {
  await seed(page); const before = await snapshot(page)
  await open(page, 'データ管理')
  await page.getByLabel('正規バックアップを選択').setInputFiles({ name: 'v13.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'training-check-backup', schemaVersion: 1, createdAt: '2026-11-03T00:00:00Z', payload: fixture(true) })) })
  await expect(page.getByRole('heading', { name: '復元できません' })).toBeVisible()
  expect(await snapshot(page)).toEqual(before)
})
test('F07: existing v1 strict preview and normal apply retain Sessions and stable IDs', async ({ page }) => {
  await seed(page); const before = await snapshot(page)
  const v1 = { format: 'training-project.trainer-proposal', version: 1, proposalId: 'old-v1-p', baseRevision: 'owner-reference', masterSuggestions: { exercises: [{ candidateId: 'new-e', name: '新種目', bodyRegion: '胸', measureType: 'reps', usesWeight: true, weightMode: 'total', selfWeightRatio: 0, secondsLoadRatio: 0 }], trainingItems: [] }, trainingItemChanges: [], menuProposals: [], washRequests: [] }
  await open(page, 'トレーナー連携')
  await page.getByLabel('提案ファイルを選ぶ').setInputFiles({ name: 'v1.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(v1)) })
  await expect(page.getByRole('heading', { name: '取り込む内容' })).toBeVisible()
  page.once('dialog', d => d.accept())
  await page.getByRole('button', { name: 'この内容を取り込む', exact: true }).click()
  await expect(page.getByText('トレーナーからの提案を取り込みました。')).toBeVisible()
  const after = await snapshot(page)
  const a = (after.canonical as CanonicalAppData[])[0], b = (before.canonical as CanonicalAppData[])[0]
  expect(a.sessions).toEqual(b.sessions); expect(a.trainingItems).toEqual(b.trainingItems)
  expect(a.exercises).toHaveLength(b.exercises.length + 1)
  expect(a.exercises.slice(0, b.exercises.length)).toEqual(b.exercises)
  expect(a.appliedProposalIds).toEqual(['old-v1-p'])
  expect(a.contributions).toBeUndefined()
  expect(after.cutover).toEqual(before.cutover)
  for (const key of ['state', 'baseline', 'recovery']) expect(after[key]).toEqual(before[key])
  await page.reload(); expect(await snapshot(page)).toEqual(after)
})
test('F11: unproven missing master is UNAVAILABLE, never U or ZERO', async ({ page }, info) => {
  test.fixme(true, 'BLOCKED: AN-10 period window/default/bucket oracle is not fixed; new analysis UI is not connected')
  await seed(page); const before = await snapshot(page)
  await open(page, '分析')
  await expect(page.getByRole('heading', { name: 'トレーニング分析' })).toBeVisible()
  await expect(page.getByText('部位別分析を表示できません')).toBeVisible()
  await expect(page.getByText('この期間の実績はありません')).toHaveCount(0)
  await expect(page.getByText(/未配賦：/)).toHaveCount(0)
  await page.screenshot({ path: `${root}/${info.project.name}-unavailable.png`, fullPage: true })
  expect(await snapshot(page)).toEqual(before)
})
test('F11: D-only percentage band, U outside, independent legends, 360px and unchanged facts', async ({ page }, info) => {
  test.fixme(true, 'BLOCKED: AN-10 period window/default/bucket oracle is not fixed; new analysis UI is not connected')
  const d = fixture(true)
  d.contributions!.byExerciseId['exercise-1'] = { rates, revision: 1 }
  d.exercises.push({ ...structuredClone(d.exercises[0]), id: 'unassigned', name: '未設定種目' })
  d.trainingItems.push({ ...structuredClone(d.trainingItems[0]), id: 'u-item', exerciseId: 'unassigned' })
  d.trainingItemSettingChanges.push({ ...structuredClone(d.trainingItemSettingChanges[0]), id: 'u-change', trainingItemId: 'u-item' })
  d.sessions[0].sets = 4
  d.sessions.push({ ...structuredClone(d.sessions[0]), id: 'u-session', trainingItemId: 'u-item', menuEntryId: undefined, performedOrder: 1, sets: 2, snapshot: { ...d.sessions[0].snapshot, exerciseId: 'unassigned', exerciseName: '未設定種目' } })
  await seed(page, d); const before = await snapshot(page)
  await open(page, '分析')
  await expect(page.getByText('未配賦：2セット')).toBeVisible()
  await expect(page.getByText('胸 50%', { exact: true })).toBeVisible()
  await expect(page.getByText('胸：2セット相当', { exact: true })).toBeVisible()
  await page.getByRole('checkbox', { name: '胸', exact: true }).uncheck()
  await expect(page.getByRole('checkbox', { name: '胸', exact: true })).not.toBeChecked()
  await page.getByRole('combobox', { name: '部位', exact: true }).selectOption('1')
  await expect(page.getByText('ダンベルプレス：1セット相当')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: `${root}/${info.project.name}-analysis.png`, fullPage: true })
  expect(await snapshot(page)).toEqual(before)
})
