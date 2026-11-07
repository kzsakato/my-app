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
for (const operation of ['Restore', 'Proposal'] as const) {
  for (const abortThrows of [false, true]) {
    test(`V13 fault matrix: ${operation} / abort ${abortThrows ? 'throws' : 'returns'}`, async ({ page }, info) => {
      await preview(page)
      if (operation === 'Proposal') {
        await page.getByRole('button', { name: '復元する' }).click()
        await settings(page)
        await page.getByRole('button', { name: /^トレーナー連携/ }).click()
      }
      const before = await readApp(page)
      await page.evaluate(throws => {
        const put = IDBObjectStore.prototype.put
        const abort = IDBTransaction.prototype.abort
        const injected = { canonicalPutSucceeded: false, markerPutFault: false, nativeAbortReturned: false, nativeAbortEvent: false, callerSawAbortThrow: false }
        Object.defineProperty(window, '__abortEvidence', { value: injected })
        let target: IDBTransaction | undefined
        IDBObjectStore.prototype.put = function (value, key) {
          if (this.name === 'canonical' && key === 'app') {
            const request = put.call(this, value, key)
            target = this.transaction
            target.addEventListener('abort', () => { injected.nativeAbortEvent = true }, { once: true })
            request.addEventListener('success', () => { injected.canonicalPutSucceeded = true })
            return request
          }
          if (this.transaction === target && this.name === 'cutover' && value?.v13Pending) {
            IDBObjectStore.prototype.put = put
            injected.markerPutFault = true
            throw new DOMException('Synthetic failure after canonical put', 'QuotaExceededError')
          }
          return put.call(this, value, key)
        }
        IDBTransaction.prototype.abort = function () {
          if (this !== target) return abort.call(this)
          IDBTransaction.prototype.abort = abort
          abort.call(this)
          injected.nativeAbortReturned = true
          if (throws) {
            // Keep test storage safe while hiding the native abort acknowledgement from the app.
            injected.callerSawAbortThrow = true
            throw new DOMException('Synthetic uncertain abort acknowledgement', 'InvalidStateError')
          }
        }
      }, abortThrows)

      if (operation === 'Restore') {
        await page.getByRole('button', { name: '復元する' }).click()
        await expect(page.getByRole('status')).toContainText('Synthetic failure after canonical put')
        await expect(page.getByRole('heading', { name: '今週の実施メニュー' })).toHaveCount(0)
      } else {
        await page.getByLabel('提案ファイルを選ぶ').setInputFiles(proposalPath)
        await expect(page.getByRole('button', { name: '診断情報を保存' })).toBeVisible()
        await expect(page.getByText('初回寄与率を登録しました。', { exact: true })).toHaveCount(0)
      }
      const held = page.getByText('保存結果を確認できません。再実行せず、診断情報を保存してください。', { exact: true })
      const picker = page.getByLabel(operation === 'Restore' ? '正規バックアップを選択' : '提案ファイルを選ぶ')
      const expectedStatus = abortThrows ? 'UNKNOWN_HELD' : 'REJECTED_ZERO_MUTATION'
      if (abortThrows) {
        await expect(held).toBeVisible()
        if (operation === 'Restore') await expect(picker).toHaveCount(0)
        else await expect(picker).toBeDisabled()
      } else {
        await expect(held).toHaveCount(0)
        await expect(picker).toBeEnabled()
      }
      let diagnostic: unknown
      if (operation === 'Proposal' || abortThrows) {
        const downloaded = page.waitForEvent('download')
        await page.getByRole('button', { name: '診断情報を保存' }).click()
        diagnostic = JSON.parse(readFileSync((await (await downloaded).path())!, 'utf8'))
        expect(diagnostic).toMatchObject({ code: expectedStatus })
      }
      const injected = await page.evaluate(() => Reflect.get(window, '__abortEvidence'))
      expect(injected).toEqual({
        canonicalPutSucceeded: true, markerPutFault: true, nativeAbortReturned: true, nativeAbortEvent: true, callerSawAbortThrow: abortThrows,
      })
      const after = await readApp(page)
      expect(after).toEqual(before)
      await info.attach('abort-branch', {
        contentType: 'application/json',
        body: JSON.stringify({ operation, expectedStatus, injected, before, after, diagnostic }, null, 2),
      })
    })
  }
}

test('PR-02/03: isolated v2 chooser and rejection matrix leave canonical and cutover unchanged', async ({ page }, info) => {
  await preview(page)
  await page.getByRole('button', { name: '復元する' }).click()
  await expect(page.getByRole('heading', { name: '今週の実施メニュー' })).toBeVisible()
  const openTrainer = async () => {
    await settings(page)
    await page.getByRole('button', { name: /^トレーナー連携/ }).click()
    await expect(page.getByLabel('提案ファイルを選ぶ')).toBeEnabled()
  }
  await openTrainer()
  const input = page.getByLabel('提案ファイルを選ぶ')
  const initial = await readApp(page)
  const chooserEvent = page.waitForEvent('filechooser')
  await input.click()
  const chooser = await chooserEvent
  await chooser.setFiles([])
  expect(await readApp(page)).toEqual(initial)
  await expect(page.getByRole('button', { name: 'この内容を取り込む' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '診断情報を保存' })).toHaveCount(0)

  const seed = JSON.parse(readFileSync(proposalPath, 'utf8'))
  const upload = (raw: string) => input.setInputFiles({ name: 'proposal.json', mimeType: 'application/json', buffer: Buffer.from(raw) })
  await upload(JSON.stringify({ ...seed, operations: [seed.operations[2]] }))
  await expect(page.getByText('初回寄与率を登録しました。', { exact: true })).toBeVisible()
  const before = await readApp(page)
  expect(before[0]).toMatchObject({ trainerDataRevision: 1, appliedProposalIds: [seed.proposalId] })
  expect(before[1]).toEqual(initial[1])
  const [a, b, existing] = seed.operations
  const valid = { ...seed, proposalId: 'negative-fixture', baseRevision: 1, operations: [a, b] }
  const withOperation = (operation: object) => ({ ...valid, operations: [a, operation] })
  const ratesWithoutCore = { ...b.rates }
  delete ratesWithoutCore.core
  const variants = [
    ['raw-duplicate-key', JSON.stringify(valid).replace('"version":2', '"version":2,"version":2')],
    ['unsupported-version', JSON.stringify({ ...valid, version: 3 })],
    ['missing-rate', JSON.stringify(withOperation({ ...b, rates: ratesWithoutCore }))],
    ['fractional-rate', JSON.stringify(withOperation({ ...b, rates: { ...b.rates, back: 49.5, lowerBody: 50.5 } }))],
    ['non-five-step', JSON.stringify(withOperation({ ...b, rates: { ...b.rates, back: 49, lowerBody: 51 } }))],
    ['wrong-total', JSON.stringify(withOperation({ ...b, rates: { ...b.rates, back: 45 } }))],
    ['all-zero-rates', JSON.stringify(withOperation({ ...b, rates: { chest: 0, back: 0, arms: 0, shoulders: 0, lowerBody: 0, core: 0 } }))],
    ['duplicate-target', JSON.stringify(withOperation(a))],
    ['existing-valid', JSON.stringify(withOperation(existing))],
    ['orphan-target', JSON.stringify(withOperation({ ...b, exerciseId: 'absent-exercise' }))],
    ['unsupported-operation', JSON.stringify(withOperation({ ...b, type: 'replaceContribution' }))],
    ['reused-proposal-id', JSON.stringify({ ...valid, proposalId: seed.proposalId })],
    ['stale-revision', JSON.stringify({ ...valid, baseRevision: 0 })],
  ]
  for (const [variant, raw] of variants) {
    await test.step(variant, async () => {
      await page.reload()
      await openTrainer()
      await upload(raw)
      await expect(page.getByRole('button', { name: '診断情報を保存' })).toBeVisible()
      await expect(page.getByText('初回寄与率を登録しました。', { exact: true })).toHaveCount(0)
      await expect(input).toBeEnabled()
      const after = await readApp(page)
      expect(after).toEqual(before)
      const downloadEvent = page.waitForEvent('download')
      await page.getByRole('button', { name: '診断情報を保存' }).click()
      const download = await downloadEvent
      const diagnostic = JSON.parse(readFileSync((await download.path())!, 'utf8'))
      expect(diagnostic.code).not.toBe('UNKNOWN_HELD')
      await info.attach(variant, { contentType: 'application/json', body: JSON.stringify({ raw, diagnostic, before, after }) })
    })
  }
})

for (const activeMenu of [false, true]) {
  test(`CTX-01: Context v2 bytes match isolated canonical, activeMenuId ${activeMenu ? 'present' : 'absent'}`, async ({ page }, info) => {
    await page.clock.setFixedTime(new Date('2026-11-06T12:00:00+09:00'))
    const fixture = structuredClone(backup)
    const source = fixture.payload
    source.exercises.find((row: { id: string }) => row.id === 'ex-Z').lifecycle = 'archived'
    source.menus = [{ id: 'context-menu', name: 'Context fixture menu', lifecycle: 'active', managementMode: 'MAN' }]
    source.menuEntries = [{ id: 'context-entry', menuId: 'context-menu', trainingItemId: 'ti-A', lifecycle: 'active', order: 0 }]
    if (activeMenu) source.activeMenuId = 'context-menu'
    const anchor = source.sessions[0]
    for (const [id, date] of [['before-window', '2026-07-29'], ['first-day', '2026-07-30'], ['last-day', '2026-11-06'], ['after-window', '2026-11-07']]) {
      source.sessions.push({ ...anchor, id, date, performedAt: `${date}T00:00:00+09:00` })
    }
    await page.goto('/v13-test/')
    await page.getByLabel('正規バックアップを選択').setInputFiles({
      name: 'context-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)),
    })
    await page.getByRole('button', { name: '復元する' }).click()
    await expect(page.getByRole('heading', { name: '今週の実施メニュー' })).toBeVisible()
    const before = await readApp(page)
    expect(before[0]).toEqual(source)
    await settings(page)
    await page.getByRole('button', { name: /^トレーナー連携/ }).click()
    const downloadEvent = page.waitForEvent('download')
    await page.getByRole('button', { name: 'トレーナー用ファイルを作る' }).click()
    const download = await downloadEvent
    const bytes = readFileSync((await download.path())!)
    const result = JSON.parse(bytes.toString('utf8'))
    expect(result).toMatchObject({ format: 'training-project.trainer-context', version: 2, fromDate: '2026-07-30', toDate: '2026-11-06' })
    const context = result.trainingContext
    const identity = (rows: { id: string; lifecycle: string }[]) => rows.map(({ id, lifecycle }) => ({ id, lifecycle }))
    expect(identity(context.exercises)).toEqual(identity(source.exercises))
    expect(identity(context.trainingItems)).toEqual(identity(source.trainingItems))
    expect(Object.hasOwn(context, 'activeMenuId')).toBe(activeMenu)
    expect(context.activeMenuId).toBe(source.activeMenuId)
    expect(context.menus).toEqual([{ id: 'context-menu', name: 'Context fixture menu', authority: 'MAN' }])
    expect(context.menuEntries).toEqual([{ id: 'context-entry', menuId: 'context-menu', trainingItemId: 'ti-A', order: 0, authority: 'MAN' }])
    expect(result.history.map(({ id, date }: { id: string; date: string }) => ({ id, date }))).toEqual(
      source.sessions.filter(({ id }: { id: string }) => id !== 'before-window' && id !== 'after-window').map(({ id, date }: { id: string; date: string }) => ({ id, date })),
    )
    expect(context.contributionStates).toEqual(source.exercises.map(({ id }: { id: string }) => ({ exerciseId: id, state: 'NO_ENTRY' })))
    expect(await readApp(page)).toEqual(before)
    await info.attach('context-v2-export', { body: bytes, contentType: 'application/json' })
  })
}

for (const variant of ['broken-canonical', 'orphan-item', 'all-zero-existing-rates'] as const) {
  test(`CTX-02: ${variant} refuses Context export without writes`, async ({ page }, info) => {
    await preview(page)
    await page.getByRole('button', { name: '復元する' }).click()
    await expect(page.getByRole('heading', { name: '今週の実施メニュー' })).toBeVisible()
    await settings(page)
    await page.getByRole('button', { name: /^トレーナー連携/ }).click()
    const exportButton = page.getByRole('button', { name: 'トレーナー用ファイルを作る' })
    await expect(exportButton).toBeEnabled()
    const source = structuredClone(backup.payload)
    if (variant === 'broken-canonical') source.schemaVersion = 99
    if (variant === 'orphan-item') source.trainingItems[0].exerciseId = 'absent-exercise'
    if (variant === 'all-zero-existing-rates') source.contributions.byExerciseId['ex-A'] = {
      revision: 1, rates: { chest: 0, back: 0, arms: 0, shoulders: 0, lowerBody: 0, core: 0 },
    }
    await page.evaluate(async value => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('training-check-v13-test', 7)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('canonical', 'readwrite')
          tx.oncomplete = () => resolve()
          tx.onabort = () => reject(tx.error)
          tx.objectStore('canonical').put(value, 'app')
        })
      } finally { db.close() }
    }, source)
    const before = await readApp(page)
    expect(before[0]).toEqual(source)
    const downloads: string[] = []
    page.on('download', download => downloads.push(download.suggestedFilename()))
    await exportButton.click()
    await expect(page.getByRole('status').filter({ hasText: 'トレーナー用ファイル作成失敗' })).toBeVisible()
    expect(downloads).toEqual([])
    expect(await readApp(page)).toEqual(before)
    const diagnosticEvent = page.waitForEvent('download')
    await page.getByRole('button', { name: '診断情報を保存' }).click()
    const diagnostic = await diagnosticEvent
    const bytes = readFileSync((await diagnostic.path())!)
    expect(JSON.parse(bytes.toString('utf8'))).toMatchObject({ stage: 'export', code: 'CONTEXT_VALIDATION_OR_DOWNLOAD_FAILED' })
    expect(downloads).toEqual(['trainer-diagnostic.json'])
    await info.attach(variant, { body: JSON.stringify({ before, after: await readApp(page), downloads }), contentType: 'application/json' })
    await info.attach('export-diagnostic', { body: bytes, contentType: 'application/json' })
  })
}
