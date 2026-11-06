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
    const separateBuckets = period === 'week' || period === 'month'
    const series = (previous: number, current: number) => separateBuckets
      ? [...Array(10).fill(0), previous, current]
      : [...Array(11).fill(0), previous + current]
    const expected = {
      pt: series(36, 530),
      '胸': series(0.5, 1),
      '背中': series(0, 2),
      '腕': series(0, 0),
      '肩': series(0.5, 1),
      '下半身': series(0, 2),
      '体幹': series(0, 0),
    }
    expect(plot).toEqual(expected)
    await expect(page.getByText('未配賦 3', { exact: true })).toBeVisible()
    const screenshot = period + '-360.png'
    await page.screenshot({ path: info.outputPath(screenshot), fullPage: true })
    evidence.push({ period, viewport: page.viewportSize(), screenshot, expected, plot })
  }
  await info.attach('AN-G06-periods', { contentType: 'application/json', body: JSON.stringify(evidence, null, 2) })
})
test('PR-05/06: confirmed pre-commit abort changes nothing; committed read-back fault stays held', async ({ page }, info) => {
  await preview(page)
  await page.getByRole('button', { name: '復元する' }).click()
  await settings(page)
  await page.getByRole('button', { name: /^トレーナー連携/ }).click()
  const before = await readApp(page)
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'canonical' && args[1] === 'app') {
        IDBObjectStore.prototype.put = put
        throw new DOMException('Synthetic pre-commit Proposal fault', 'QuotaExceededError')
      }
      return put.apply(this, args)
    }
  })
  await page.getByLabel('提案ファイルを選ぶ').setInputFiles(proposalPath)
  await expect(page.getByRole('button', { name: '診断情報を保存' })).toBeVisible()
  await expect(page.getByLabel('提案ファイルを選ぶ')).toBeEnabled()
  const afterAbort = await readApp(page)
  expect(afterAbort).toEqual(before)
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put
    const get = IDBObjectStore.prototype.get
    let armed = false
    IDBObjectStore.prototype.put = function (value, key) {
      if (this.name === 'cutover' && value?.v13Pending) armed = true
      return put.call(this, value, key)
    }
    IDBObjectStore.prototype.get = function (key) {
      if (armed && this.name === 'cutover' && this.transaction.mode === 'readonly') {
        IDBObjectStore.prototype.get = get
        IDBObjectStore.prototype.put = put
        throw new DOMException('Synthetic post-commit Proposal read-back fault', 'UnknownError')
      }
      return get.call(this, key)
    }
  })
  await page.getByLabel('提案ファイルを選ぶ').setInputFiles(proposalPath)
  const held = page.getByText('保存結果を確認できません。再実行せず、診断情報を保存してください。', { exact: true })
  await expect(held).toBeVisible()
  await expect(page.getByText('初回寄与率を登録しました。', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('提案ファイルを選ぶ')).toBeDisabled()
  const committed = await readApp(page)
  const expected = structuredClone(backup.payload)
  const proposal = JSON.parse(readFileSync(proposalPath, 'utf8'))
  expected.trainerDataRevision = 1
  expected.appliedProposalIds.push(proposal.proposalId)
  for (const operation of proposal.operations) expected.contributions.byExerciseId[operation.exerciseId] = { rates: operation.rates, revision: 1 }
  expect(committed[0]).toEqual(expected)
  expect(committed[1]).toMatchObject({ v13Pending: expect.any(String) })
  await page.reload()
  await expect(held).toBeVisible()
  expect(await readApp(page)).toEqual(committed)
  await info.attach('PR-05-06-fault-readbacks', {
    contentType: 'application/json',
    body: JSON.stringify({ before, afterAbort, committed }, null, 2),
  })
})
test('PR-06: failed marker-clear read aborts the clear and keeps the durable hold', async ({ page }, info) => {
  await preview(page)
  await page.getByRole('button', { name: '復元する' }).click()
  await settings(page)
  await page.getByRole('button', { name: /^トレーナー連携/ }).click()
  const before = await readApp(page)
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put
    const get = IDBObjectStore.prototype.get
    let marked = false
    let clearing = false
    IDBObjectStore.prototype.put = function (value, key) {
      if (this.name === 'cutover' && value?.v13Pending) marked = true
      if (this.name === 'cutover' && marked && value?.v13InitialRestore && !value.v13Pending) clearing = true
      return put.call(this, value, key)
    }
    IDBObjectStore.prototype.get = function (key) {
      if (clearing && this.name === 'cutover') {
        IDBObjectStore.prototype.get = get
        IDBObjectStore.prototype.put = put
        throw new DOMException('Synthetic marker-clear verification fault', 'UnknownError')
      }
      return get.call(this, key)
    }
  })
  await page.getByLabel('提案ファイルを選ぶ').setInputFiles(proposalPath)
  const held = page.getByText('保存結果を確認できません。再実行せず、診断情報を保存してください。', { exact: true })
  await expect(held).toBeVisible()
  await expect(page.getByText('初回寄与率を登録しました。', { exact: true })).toHaveCount(0)
  const persisted = await readApp(page)
  const proposal = JSON.parse(readFileSync(proposalPath, 'utf8'))
  const expected = structuredClone(backup.payload)
  expected.trainerDataRevision = 1
  expected.appliedProposalIds.push(proposal.proposalId)
  for (const operation of proposal.operations) expected.contributions.byExerciseId[operation.exerciseId] = { rates: operation.rates, revision: 1 }
  expect(persisted[0]).toEqual(expected)
  expect(persisted[1]).toEqual({ ...(before[1] as object), v13Pending: expect.any(String) })
  await page.reload()
  await expect(held).toBeVisible()
  expect(await readApp(page)).toEqual(persisted)
  await info.attach('marker-clear-fault', { contentType: 'application/json', body: JSON.stringify({ before, persisted }, null, 2) })
})
test('MIG-01: synthetic fixed-V1.2 export survives the one-time external upgrade and restore', async ({ page, context }, info) => {
  // Captured by the H12 test on the fixed V1.2 source, using a synthetic seed.
  const { exported: source } = JSON.parse(readFileSync(
    'evidence/issue35-v13/qa-followup/h12-base-snapshots.json', 'utf8',
  ))
  expect(source.format).toBe('training-check-backup')
  expect(source.schemaVersion).toBe(1)
  expect(source.payload.schemaVersion).toBe(1)
  expect(source.payload).not.toHaveProperty('trainerDataRevision')
  expect(source.payload).not.toHaveProperty('contributions')
  const upgraded = {
    ...source,
    schemaVersion: 2,
    payload: {
      ...source.payload,
      trainerDataRevision: 0,
      contributions: { version: 1, byExerciseId: {} },
    },
  }
  const input = { name: 'synthetic-upgraded-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(upgraded)) }
  const second = await context.newPage()
  for (const tab of [page, second]) {
    await tab.goto('/v13-test/')
    await tab.getByLabel('正規バックアップを選択').setInputFiles(input)
    await expect(tab.getByRole('heading', { name: '復元内容の確認' })).toBeVisible()
  }
  await page.getByRole('button', { name: '復元する' }).click()
  await expect(page.getByRole('heading', { name: '今週の実施メニュー' })).toBeVisible()
  const restored = await readApp(page)
  expect(restored[0]).toEqual(upgraded.payload)
  const { trainerDataRevision, contributions, ...preserved } = restored[0] as typeof upgraded.payload
  expect(preserved).toEqual(source.payload)
  expect(trainerDataRevision).toBe(0)
  expect(contributions).toEqual({ version: 1, byExerciseId: {} })
  await second.getByRole('button', { name: '復元する' }).click()
  await expect(second.getByRole('status')).toContainText('V13_TARGET_ALREADY_USED')
  const afterSecond = await readApp(second)
  expect(afterSecond).toEqual(restored)
  await info.attach('MIG-01-synthetic-upgrade', {
    contentType: 'application/json', body: JSON.stringify({ source, upgraded, restored, afterSecond }, null, 2),
  })
})
