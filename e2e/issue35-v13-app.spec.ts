import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

const backupPath = 'evidence/issue35-v13/synthetic-initial-backup.json'
const proposalPath = 'evidence/issue35-v13/synthetic-initial-proposal.json'
const backup = JSON.parse(readFileSync(backupPath, 'utf8'))

async function readApp(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('training-check-v13-test', 7)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      const transaction = db.transaction(['canonical', 'cutover'])
      const read = (store: string, key: string) => new Promise((resolve, reject) => {
        const request = transaction.objectStore(store).get(key)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      return await Promise.all([read('canonical', 'app'), read('cutover', 'state')])
    } finally { db.close() }
  })
}

async function preview(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-06T12:00:00+09:00'))
  await page.goto('/v13-test/')
  await page.getByLabel('正規バックアップを選択').setInputFiles(backupPath)
  await expect(page.getByRole('heading', { name: '復元内容の確認' })).toBeVisible()
}

async function settings(page: Page) {
  await page.getByRole('button', { name: '共通メニュー' }).click()
  await page.getByRole('button', { name: '設定', exact: true }).click()
}

test('MIG-01: initial restore wins, stale second preview cannot replace canonical', async ({ page, context }, info) => {
  await preview(page)
  const second = await context.newPage()
  await preview(second)
  expect(await readApp(page)).toEqual([undefined, undefined])
  await page.getByRole('button', { name: '復元する' }).click()
  await expect(page.getByRole('heading', { name: '今週の実施メニュー' })).toBeVisible()
  const restored = await readApp(page)
  expect(restored[0]).toEqual(backup.payload)
  expect(restored[1]).toMatchObject({ authoritative: true, v13InitialRestore: expect.any(String) })
  expect(restored[1]).not.toHaveProperty('v13Pending')
  await second.getByRole('button', { name: '復元する' }).click()
  await expect(second.getByRole('status')).toContainText('V13_TARGET_ALREADY_USED')
  const rejected = await readApp(second)
  expect(rejected).toEqual(restored)
  await info.attach('MIG-01-independent-readbacks', {
    contentType: 'application/json',
    body: JSON.stringify({ restored, afterSecondRestoreRejection: rejected }, null, 2),
  })
  await second.reload()
  for (const tab of [page, second]) {
    await settings(tab)
    await tab.getByRole('button', { name: /^トレーナー連携/ }).click()
  }
  await page.getByLabel('提案ファイルを選ぶ').setInputFiles(proposalPath)
  await expect(page.getByText('初回寄与率を登録しました。', { exact: true })).toBeVisible()
  const applied = await readApp(page)
  const accepted = JSON.parse(readFileSync(proposalPath, 'utf8'))
  const expectedApplied = structuredClone(backup.payload)
  expectedApplied.trainerDataRevision = 1
  expectedApplied.appliedProposalIds.push(accepted.proposalId)
  for (const operation of accepted.operations) {
    expectedApplied.contributions.byExerciseId[operation.exerciseId] = { rates: operation.rates, revision: 1 }
  }
  expect(applied).toEqual([expectedApplied, restored[1]])
  const stale = {
    ...accepted, proposalId: 'synthetic-second-tab-stale',
    operations: [{ ...accepted.operations[0], exerciseId: 'ex-C' }],
  }
  await second.getByLabel('提案ファイルを選ぶ').setInputFiles({
    name: 'stale.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(stale)),
  })
  await expect(second.getByRole('button', { name: '診断情報を保存' })).toBeVisible()
  await expect(second.getByText('初回寄与率を登録しました。', { exact: true })).toHaveCount(0)
  const afterStale = await readApp(second)
  expect(afterStale).toEqual(applied)
  await info.attach('PR-04-stale-second-tab', {
    contentType: 'application/json',
    body: JSON.stringify({ stale, applied, afterStale }, null, 2),
  })

})

test('AN-G06: real-build plot and PNG for each selectable period', async ({ page }, info) => {
  await preview(page)
  await page.getByRole('button', { name: '復元する' }).click()
  await settings(page)
  await page.getByRole('button', { name: /^トレーナー連携/ }).click()
  await page.getByLabel('提案ファイルを選ぶ').setInputFiles(proposalPath)
  await expect(page.getByText('初回寄与率を登録しました。', { exact: true })).toBeVisible()
  await settings(page)
  await page.getByRole('button', { name: /^分析/ }).click()
  const periods = ['week', 'month', 'quarter', 'half', 'year']
  const evidence = []
  for (const period of periods) {
    await page.getByRole('combobox', { name: '期間' }).selectOption(period)
    const plot = await page.locator('svg polyline').evaluateAll(lines =>
      Object.fromEntries(lines.map(line => [line.getAttribute('data-series'), JSON.parse(line.getAttribute('data-values')!)])),
    )
    const expected = period === 'week' || period === 'month' ? [...Array(10).fill(0), 36, 530] : [...Array(11).fill(0), 566]
    expect(plot.pt).toEqual(expected)
    expect(Object.keys(plot)).toHaveLength(7)
    expect(plot['胸'].reduce((sum: number, value: number) => sum + value, 0)).toBe(1.5)
    expect(plot['背中'].reduce((sum: number, value: number) => sum + value, 0)).toBe(2)
    await expect(page.getByText('未配賦 3', { exact: true })).toBeVisible()
    const screenshot = period + '-360.png'
    await page.screenshot({ path: info.outputPath(screenshot), fullPage: true })
    evidence.push({ period, viewport: page.viewportSize(), screenshot, expectedPT: expected, plot })
  }
  await info.attach('AN-G06-periods', { contentType: 'application/json', body: JSON.stringify(evidence, null, 2) })
})
