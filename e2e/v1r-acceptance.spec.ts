import { expect, test, type Page } from '@playwright/test'
import { defaultDisplayPreferences } from '../src/canonical/displayPreferences'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { canonicalData, seedCanonicalAndReload, readCanonicalState, readStoredState } from './helpers/state'

// Acceptance authority: Step5 Freeze / Step3 Pairing / DATA_SPEC §10.8–10.9.
const instant = new Date('2026-10-03T12:00:00+09:00')
async function settings(page: Page) { await page.getByRole('button', { name: '共通メニュー' }).click(); await page.getByRole('button', { name: '設定', exact: true }).click() }
async function top(page: Page) { await page.getByRole('button', { name: '共通メニュー' }).click(); await page.getByRole('button', { name: '実施メニュー', exact: true }).click() }
async function open(page: Page, name: string) { await settings(page); await page.getByRole('button', { name: new RegExp(`^${name} `) }).click() }
async function run(page: Page) {
  await focusedChest(page)
  await page.locator('[data-menu-entry-id="canonical-entry-a"]').click()
}
function session(id: string, date: string, order = 0, weight = 27) {
  return { id, trainingItemId: 'canonical-item', date, performedAt: `${date}T12:00:00+09:00`, performedOrder: order, weight, reps: 8, sets: 2, seat: 'actual-seat', snapshot: { exerciseId: 'canonical-exercise', exerciseName: '記録時の名称', trainingItemDisplayName: '正規テストプレス', measureType: 'reps', weightMode: 'total', classifications: [{ kind: 'bodyRegion', label: '胸' }] } }
}
async function injectWriteFailure(page: Page) {
  await page.evaluate(() => { const put = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (...args) { if (this.name === 'canonical') { IDBObjectStore.prototype.put = put; throw new Error('injected persistence failure') } return put.apply(this, args) } })
}

// H-20261004-03: independent fixed-date oracle; do not call product history helpers.
const focusedDates = ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03']
async function assertFocusedMarkers(page: Page, completedDates: string[]) {
  const expected = Object.fromEntries(focusedDates.map(date => [date, completedDates.includes(date) ? '●' : '○']))
  await expect.poll(async () => {
    const markers = (await page.locator('.item-history').first().innerText()).replaceAll('｜', '')
    expect(markers).toHaveLength(14)
    return Object.fromEntries(focusedDates.map((date, index) => [date, markers[index]]))
  }, { message: 'H-03: each fixed calendar date must have its own expected 14-day marker' }).toEqual(expected)
}
function canonicalWriteFixture() {
  const fixture = canonicalData()
  return {
    ...fixture,
    trainingItems: (fixture.trainingItems as object[]).map(item => ({ ...item, managementMode: 'MAN' })),
    menus: (fixture.menus as object[]).map(menu => ({ ...menu, managementMode: 'MAN' })),
    displayPreferences: structuredClone(defaultDisplayPreferences),
    appliedProposalIds: [],
  }
}
async function focusedChest(page: Page) {
  await page.getByRole('button', { name: '部位表示', exact: true }).click()
  await page.getByRole('button').filter({ has: page.locator('b').getByText('胸', { exact: true }) }).click()
}
async function focusedActuals(page: Page) {
  await page.getByRole('button', { name: '推奨曜日', exact: true }).click()
  await page.getByLabel('実施済も表示').check()
  await page.getByRole('button', { name: /^曜日指定:/ }).click()
  for (const day of ['月', '火', '水', '木', '金', '土', '日']) await page.getByRole('checkbox', { name: day, exact: true }).check()
  await page.getByRole('button', { name: /^曜日指定:/ }).click()
}

for (const scenario of [
  { name: '1 same-day multiple Sessions retain marker until last cancellation', targets: [session('same-day-first', '2026-10-02', 0), session('same-day-last', '2026-10-02', 1)] },
  { name: '2 single Session cancellation clears its date marker', targets: [session('single-target', '2026-10-02')] },
  { name: '3 past-first consecutive cancellations change only the target date', targets: [session('Monday-target', '2026-09-28'), session('Wednesday-target', '2026-09-30'), session('Friday-target', '2026-10-02')] },
]) {
  test(`H-03 focused ${scenario.name}`, async ({ page }, info) => {
    await page.clock.install({ time: instant }); await page.clock.setFixedTime(instant)
    const untouched = session('non-target-outside-window', '2026-09-10')
    const targets = scenario.targets.map(value => ({ ...value, snapshot: { ...value.snapshot, trainingItemDisplayName: `取消対象-${value.id}` } }))
    const data = { ...canonicalWriteFixture(), sessions: [untouched, ...targets] }
    await seedCanonicalAndReload(page, data)
    const legacy = await readStoredState(page)
    await focusedActuals(page)
    let remaining = [...data.sessions]
    await assertFocusedMarkers(page, scenario.targets.map(value => value.date))
    const stages: unknown[] = [{ remaining, markers: await page.locator('.item-history').first().innerText() }]
    for (const target of targets) {
      // Actual rows carry their own Session identity; cancel oldest dates first.
      const row = page.locator(`[data-session-id="${target.id}"]`)
      await expect(row).toContainText(`追加実施　${target.date}`)
      await expect(row.locator('b')).toHaveText(target.snapshot.trainingItemDisplayName)
      await row.click()
      await expect(page.getByRole('heading', { name: target.snapshot.trainingItemDisplayName, exact: true })).toBeVisible()
      await expect(page.getByText(`今週実施済み（${target.date}）`, { exact: true })).toBeVisible()
      page.once('dialog', dialog => dialog.accept())
      await page.getByRole('button', { name: `${Number(target.date.slice(5, 7))}/${Number(target.date.slice(8))}の実行を取り消す` }).click()
      remaining = remaining.filter(value => value.id !== target.id)
      const expected = { ...data, sessions: remaining }
      await expect.poll(() => readCanonicalState(page)).toEqual(expected)
      await expect(page.getByRole('heading', { name: '今週の実施メニュー' })).toBeVisible()
      await assertFocusedMarkers(page, remaining.map(value => value.date))
      expect(await readStoredState(page)).toEqual(legacy)
      stages.push({ cancelledId: target.id, remaining: await readCanonicalState(page), markers: await page.locator('.item-history').first().innerText() })
      await page.reload()
      expect(await readCanonicalState(page)).toEqual(expected)
      await focusedActuals(page)
      await assertFocusedMarkers(page, remaining.map(value => value.date))
    }
    await info.attach('H-03-marker-cancellation-stages', { body: JSON.stringify(stages, null, 2), contentType: 'application/json' })
  })
}

test('H-03 focused 4/5 + H06 A5: UI Extra completion has own actual and visible completed Exercise', async ({ page }, info) => {
  await page.clock.install({ time: instant }); await page.clock.setFixedTime(instant)
  const previous = session('previous-before-extra', '2026-09-26', 0, 27)
  const data = { ...canonicalWriteFixture(), sessions: [previous] }
  await seedCanonicalAndReload(page, data)
  const legacy = await readStoredState(page)
  await focusedChest(page)
  await assertFocusedMarkers(page, ['2026-09-26'])
  await top(page)
  await page.getByRole('button', { name: '＋ 追加トレーニングを登録' }).click()
  await page.getByRole('button', { name: /正規テストプレス/ }).click()
  await expect(page.getByRole('region', { name: '前回実績' })).toHaveCount(0)
  await page.getByRole('button', { name: '重量を1kg増やす' }).click()
  await page.getByRole('button', { name: '回数を増やす' }).click()
  await page.getByLabel('シート位置').fill('H03-extra-seat')
  await page.getByRole('button', { name: '種目を完了' }).click()
  await expect(page.getByRole('heading', { name: '今週の実施メニュー' })).toBeVisible()
  const saved = await readCanonicalState(page)
  const added = saved.sessions as ReturnType<typeof session>[]
  expect(added).toHaveLength(2)
  expect(added[0]).toEqual(previous)
  expect(added[1]).toMatchObject({ id: expect.any(String), date: '2026-10-03', performedAt: instant.toISOString(), performedOrder: 0, weight: 21, reps: 11, sets: 3, seat: 'H03-extra-seat' })
  expect(added[1].id).not.toBe(previous.id)
  expect((added[1] as typeof added[number] & { menuEntryId?: string }).menuEntryId).toBeUndefined()
  expect({ ...saved, sessions: data.sessions }).toEqual(data)
  await page.getByRole('button', { name: '推奨曜日', exact: true }).click()
  const actualRow = page.locator(`[data-session-id="${added[1].id}"]`)
  await expect(actualRow).toHaveCount(0)
  await page.getByLabel('実施済も表示').check()
  await expect(actualRow).toHaveCount(1)
  await expect(actualRow).toContainText('正規テストプレス')
  await expect(actualRow).toContainText('追加実施　2026-10-03')
  await assertFocusedMarkers(page, ['2026-09-26', '2026-10-03'])
  await focusedChest(page)
  await expect(actualRow).toHaveCount(0)
  await page.getByLabel('実施済も表示').check()
  // H09: Extra owns one row; planned Entries do not borrow its actual.
  await expect(actualRow).toHaveCount(1)
  await expect(page.locator('[data-menu-entry-id]')).toHaveCount(0)
  await assertFocusedMarkers(page, ['2026-09-26', '2026-10-03'])
  await top(page)
  await page.getByRole('button', { name: '＋ 追加トレーニングを登録' }).click()
  await page.getByRole('button', { name: /正規テストプレス/ }).click()
  // H06 A5 supersedes the incomplete-Run panel, not the Session/order contract.
  await expect(page.getByRole('region', { name: '前回実績' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /の実行を取り消す/ })).toHaveCount(0)
  await top(page)
  await page.getByRole('button', { name: '推奨曜日', exact: true }).click()
  await page.getByLabel('実施済も表示').check()
  await actualRow.click()
  await expect(page.getByText('今週実施済み（2026-10-03）', { exact: true })).toBeVisible()
  await expect(page.getByText('21.00 kg', { exact: true })).toBeVisible()
  await expect(page.locator('.run-slot').filter({ hasText: '回数' }).locator('b')).toHaveText('11 回')
  await expect(page.locator('.run-slot').filter({ hasText: '実施セット数' }).locator('b')).toHaveText('3')
  await expect(page.getByLabel('シート位置')).toHaveValue('H03-extra-seat')
  await expect(page.getByText('27.00 kg', { exact: true })).toHaveCount(0)
  expect(await readCanonicalState(page)).toEqual(saved)
  expect(await readStoredState(page)).toEqual(legacy)
  await page.reload()
  expect(await readCanonicalState(page)).toEqual(saved)
  await info.attach('H-03-extra-created-session', { body: JSON.stringify({ before: data, after: saved }, null, 2), contentType: 'application/json' })
})

test('OIC-003/006/007 + H06 A5: Session-only seat, controls, persist failure/retry/reload preserve identity', async ({ page }) => {
  await page.clock.install({ time: instant }); await page.clock.setFixedTime(instant)
  const data = canonicalWriteFixture(); data.sessions = [session('z-older', '2026-09-26', 0, 99), session('a-later', '2026-09-26', 1, 27)]
  await seedCanonicalAndReload(page, data)
  const legacy = await readStoredState(page)
  await run(page)
  await expect(page.getByRole('region', { name: '前回実績' })).toHaveCount(0)
  await page.getByRole('button', { name: '重量を1kg減らす' }).click()
  await expect(page.getByText('19.00 kg', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '重量を0.25kg減らす' }).click()
  await page.getByRole('button', { name: '重量を0.25kg増やす' }).click()
  await page.getByRole('button', { name: '重量を1kg増やす' }).click()
  await page.getByLabel('シート位置').fill('session-only')
  await injectWriteFailure(page)
  await page.getByRole('button', { name: '種目を完了' }).click()
  await expect(page.getByRole('status')).toContainText('保存できませんでした')
  expect(await readCanonicalState(page)).toEqual(data)
  await page.clock.setFixedTime(new Date('2026-10-03T13:00:00+09:00'))
  await page.getByRole('button', { name: '種目を完了' }).click()
  const saved = await readCanonicalState(page)
  const sessions = saved.sessions as ReturnType<typeof session>[]
  expect(sessions).toHaveLength(3)
  expect(sessions[2]).toMatchObject({ date: '2026-10-03', performedAt: instant.toISOString(), performedOrder: 0, seat: 'session-only' })
  expect(saved.trainingItems).toEqual(data.trainingItems)
  expect(saved.trainingItemSettingChanges).toEqual(data.trainingItemSettingChanges)
  expect(await readStoredState(page)).toEqual(legacy)
  await page.reload()
  expect((await readCanonicalState(page)).sessions).toEqual(sessions)
  await focusedChest(page)
  await page.getByLabel('実施済も表示').check()
  await page.locator(`[data-session-id="${sessions[2].id}"]`).click()
  await expect(page.getByRole('region', { name: '当該実績' })).toHaveCount(0)
  await expect(page.getByText('20.00 kg', { exact: true })).toBeVisible()
  await expect(page.getByText('10 回', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'セット数を増やす' })).toBeDisabled()
  await expect(page.getByLabel('シート位置')).toBeDisabled()
  expect(await readCanonicalState(page)).toEqual(saved)
  await expect(page.getByLabel('シート位置')).toHaveValue('session-only')
  await expect(page.getByText('やり残し')).toHaveCount(0)
})

test('OIC-006: same Clock completions allocate distinct order and shuffled offset-equivalent actuals select correctly', async ({ page }) => {
  await page.clock.install({ time: instant }); await page.clock.setFixedTime(instant)
  const data = canonicalData(); const earlier = session('z', '2026-09-26', 0, 99); const later = session('a', '2026-09-26', 1, 28); later.performedAt = '2026-09-26T03:00:00Z'; data.sessions = [later, earlier]
  await seedCanonicalAndReload(page, data)
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: '＋ 追加トレーニングを登録' }).click()
    await page.getByRole('button', { name: /正規テストプレス/ }).click()
    if (i === 0) await expect(page.getByRole('region', { name: '前回実績' })).toHaveCount(0)
    await page.getByRole('button', { name: '種目を完了' }).dblclick()
  }
  const added = (await readCanonicalState(page)).sessions as ReturnType<typeof session>[]
  expect(added.slice(2).map(value => value.performedOrder)).toEqual([0, 1])
  expect(added.slice(2).map(value => value.performedAt)).toEqual([instant.toISOString(), instant.toISOString()])
  expect(new Set(added.map(value => value.id)).size).toBe(4)
})

test('OIC-008/009/010/012: temporary weekday filter, distinct today including Extra, actual-date visibility, two-line execution lists', async ({ page }) => {
  await page.clock.install({ time: instant }); await page.clock.setFixedTime(instant)
  const data = canonicalData(); data.sessions = [session('extra-1', '2026-10-03'), session('extra-2', '2026-10-03', 1)]
  const entries = data.menuEntries as Record<string, unknown>[]; entries[0].recommendedDay = 5; entries[1].recommendedDay = 5
  await seedCanonicalAndReload(page, data)
  await expect(page.getByText('今日の実施総数')).toContainText('2/1')
  await page.getByRole('button', { name: '推奨曜日', exact: true }).click()
  await expect(page.getByRole('button', { name: /曜日指定: 土/ })).toBeVisible()
  await page.getByLabel('実施済も表示').check()
  const rows = page.locator('.item-density')
  // H09: two individual Extra Sessions, without two planned aliases.
  await expect(rows).toHaveCount(2)
  await expect(rows.first()).not.toContainText('kg')
  await expect(rows.first().locator('.item-detail-line')).toHaveCount(1)
  await page.getByRole('button', { name: /曜日指定:/ }).click()
  await page.getByRole('checkbox', { name: '月', exact: true }).check()
  await page.getByRole('checkbox', { name: '土', exact: true }).uncheck()
  // TOP T-14/T-16/TO-04: Extra Sessions follow their actual weekday.
  await expect(rows).toHaveCount(0)
  await page.getByLabel('実施済も表示').uncheck()
  await expect(rows).toHaveCount(0)
  await expect(page.getByText('今日の実施総数')).toContainText('2/1')
  expect(await readCanonicalState(page)).toEqual(data)
  await page.reload()
  await page.getByRole('button', { name: '推奨曜日', exact: true }).click()
  await expect(page.getByRole('button', { name: /曜日指定: 土/ })).toBeVisible()
})

test('OIC-002: Menu add/remove confirmations and unsaved back have zero canonical writes', async ({ page }) => {
  await seedCanonicalAndReload(page, canonicalData())
  const before = await readCanonicalState(page)
  await open(page, '週メニュー')
  await page.getByRole('button', { name: /^正規E2Eメニュー/ }).click()
  page.once('dialog', d => d.dismiss()); await page.getByRole('button', { name: '外す', exact: true }).first().click()
  await expect(page.getByRole('button', { name: '外す', exact: true })).toHaveCount(2)
  page.once('dialog', d => d.dismiss()); await page.getByRole('button', { name: '追加', exact: true }).click()
  await expect(page.getByRole('button', { name: '外す', exact: true })).toHaveCount(2)
  expect(await readCanonicalState(page)).toEqual(before)
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: '外す', exact: true }).first().click()
  await page.getByRole('button', { name: '‹ 戻る' }).click()
  expect(await readCanonicalState(page)).toEqual(before)
  await page.getByRole('button', { name: /^正規E2Eメニュー/ }).click()
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: '外す', exact: true }).first().click()
  await page.getByRole('button', { name: '保存', exact: true }).click()
  const after = await readCanonicalState(page)
  expect((after.menuEntries as { lifecycle: string }[]).map(value => value.lifecycle)).toEqual(['archived', 'active'])
  expect(after.sessions).toEqual(before.sessions)
})

test('OIC-013: item-scoped history deletion cancel, exact selected delete and reload never reconstruct initial/current/Session', async ({ page }) => {
  await page.clock.install({ time: instant }); await page.clock.setFixedTime(instant)
  const data = { ...canonicalWriteFixture(), sessions: [session('preserved', '2026-10-03')] }
  const changes = data.trainingItemSettingChanges as Record<string, unknown>[]
  changes.push({ ...changes[0], id: 'change-remove', isInitial: false, changedAt: '2026-10-02T00:00:00Z', changeReason: '削除対象' })
  await seedCanonicalAndReload(page, data)
  await open(page, '設定履歴')
  await page.getByRole('combobox', { name: '実施項目', exact: true }).selectOption('canonical-item')
  await page.getByRole('button', { name: '設定履歴を見る', exact: true }).click()
  await expect(page.getByText('初回設定（削除できません）')).toBeVisible()
  await expect(page.getByRole('button', { name: '削除', exact: true })).toHaveCount(1)
  page.once('dialog', d => d.dismiss()); await page.getByRole('button', { name: '削除', exact: true }).click()
  expect(await readCanonicalState(page)).toEqual(data)
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: '削除', exact: true }).click()
  const after = await readCanonicalState(page)
  expect(after.trainingItemSettingChanges).toEqual([changes[0]])
  expect(after.trainingItems).toEqual(data.trainingItems); expect(after.sessions).toEqual(data.sessions)
  await page.reload(); expect(await readCanonicalState(page)).toEqual(after)
})

for (const proposalName of ['Owner確認候補', 'Owner確認候補 (ByAI)']) {
test(`QA-C01 D-01/02: exact upstream name ${proposalName}, preview/cancel/failure/idempotence/read-back/export`, async ({ page }) => {
  await page.clock.install({ time: instant }); await page.clock.setFixedTime(instant); await seedCanonicalAndReload(page, { ...canonicalData(), sessions: [session('export-one', '2026-10-03')] })
  const before = await readCanonicalState(page)
  await open(page, 'トレーナー連携')
  const file = page.getByLabel('提案ファイルを選択')
  await file.setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{') })
  await expect(page.getByRole('heading', { name: '投入できません' })).toBeVisible()
  await expect(page.getByRole('button', { name: '新しい週メニューを作成' })).toHaveCount(0)
  const proposal = { contractVersion: '1.0', proposalId: 'v1r-one', menu: { name: proposalName }, entries: [{ trainingItemId: 'canonical-item', recommendedDay: 5, order: 0 }] }
  const upload = () => file.setInputFiles({ name: 'proposal.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(proposal)) })
  await upload(); await expect(page.getByText(proposalName, { exact: true })).toBeVisible()
  page.once('dialog', d => d.dismiss()); await page.getByRole('button', { name: '新しい週メニューを作成' }).click()
  expect(await readCanonicalState(page)).toEqual(before)
  await injectWriteFailure(page)
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: '新しい週メニューを作成' }).click()
  await expect(page.getByText(/投入に失敗しました/)).toBeVisible()
  expect(await readCanonicalState(page)).toEqual(before)
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: '新しい週メニューを作成' }).dblclick()
  await expect(page.getByRole('heading', { name: 'メニューを作成しました' })).toBeVisible()
  const applied = await readCanonicalState(page)
  expect((applied.menus as { name: string }[]).map(value => value.name)).toEqual(['正規E2Eメニュー', proposalName])
  expect((applied.menus as unknown[]).slice(0, -1)).toEqual(before.menus)
  expect(applied.activeMenuId).toBe(before.activeMenuId); expect(applied.trainingItems).toEqual(before.trainingItems); expect(applied.sessions).toEqual(before.sessions)
  await upload(); await expect(page.getByRole('heading', { name: '投入できません' })).toBeVisible()
  expect(await readCanonicalState(page)).toEqual(applied)
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'JSONを出力' }).click()
  const payload = JSON.parse(await readFile((await (await download).path())!, 'utf8'))
  expect(payload.range).toEqual({ kind: 'range', fromDate: '2026-10-03', toDate: '2026-10-03', inclusive: true }); expect(payload.sessions).toEqual(before.sessions)
  expect(payload.format).toBeUndefined(); expect(await readCanonicalState(page)).toEqual(applied)
  await page.getByLabel('開始日').fill('2026-10-04'); await page.getByLabel('終了日').fill('2026-10-04')
  await expect(page.getByText('対象期間に履歴がありません。0件')).toBeVisible(); await expect(page.getByRole('button', { name: 'JSONを出力' })).toBeDisabled()
  await page.reload(); expect(await readCanonicalState(page)).toEqual(applied)
})
}

for (const failure of ['none', 'write', 'read-back'] as const) {
  test(`QA-C02 cancellation completion/non-target/reload with ${failure} failure`, async ({ page }, info) => {
    await page.clock.install({ time: instant }); await page.clock.setFixedTime(instant)
    const other = session('non-target-previous-week', '2026-09-20')
    const target = session('cancel-target', '2026-10-03')
    const data = { ...canonicalWriteFixture(), sessions: [other, target] }
    await seedCanonicalAndReload(page, data)
    const legacy = await readStoredState(page)
    await expect(page.getByText('今週の実施総数')).toContainText('1/2')
    await focusedChest(page)
    await page.getByLabel('実施済も表示').check()
    await page.locator('[data-session-id="cancel-target"]').click()
    await page.evaluate(mode => {
      const probe = { writes: 0, reads: 0 }
      Object.assign(window, { cancellationProbe: probe })
      const put = IDBObjectStore.prototype.put
      const get = IDBObjectStore.prototype.get
      IDBObjectStore.prototype.put = function (...args) {
        if (this.name === 'canonical') {
          probe.writes++
          if (mode === 'write') { IDBObjectStore.prototype.put = put; throw new Error('QA-C02 injected write failure') }
        }
        return put.apply(this, args)
      }
      IDBObjectStore.prototype.get = function (...args) {
        if (this.name === 'canonical') {
          probe.reads++
          if (mode === 'read-back' && probe.writes > 0) { IDBObjectStore.prototype.get = get; throw new Error('QA-C02 injected read-back failure') }
        }
        return get.apply(this, args)
      }
    }, failure)
    const cancel = page.getByRole('button', { name: '10/3の実行を取り消す' })
    page.once('dialog', d => d.dismiss()); await cancel.click()
    expect(await readCanonicalState(page)).toEqual(data)
    const probe = () => page.evaluate(() => (window as unknown as { cancellationProbe: { writes: number; reads: number } }).cancellationProbe)
    expect((await probe()).writes).toBe(0)
    await expect(cancel).toBeVisible()
    page.once('dialog', d => d.accept()); await cancel.click()
    const cancelled = { ...data, sessions: [other] }
    if (failure === 'write') {
      await expect(page.getByRole('status')).toContainText('実行を取り消せませんでした')
      await expect(cancel).toBeVisible()
      expect(await readCanonicalState(page)).toEqual(data)
    } else if (failure === 'read-back') {
      await expect(page.getByRole('alert')).toContainText('保存の成功を確認できません')
      await expect(page.getByRole('heading', { name: '保存状態の確認' })).toBeVisible()
      expect(await readCanonicalState(page)).toEqual(cancelled)
    } else {
      await expect.poll(() => readCanonicalState(page)).toEqual(cancelled)
      await expect(page.getByRole('heading', { name: '胸', exact: true })).toBeVisible()
      await expect(cancel).toHaveCount(0)
      await top(page)
      await expect(page.getByText('今週の実施総数')).toContainText('0/2')
      await expect(page.getByText('今日の実施総数')).toContainText('0/0')
    }
    if (failure !== 'none') await expect(page.getByText('今週の実施総数')).toHaveCount(0)
    await info.attach('cancellation-boundary', { body: JSON.stringify({ failure, probe: await probe(), before: data, after: await readCanonicalState(page) }, null, 2), contentType: 'application/json' })
    expect(await readStoredState(page)).toEqual(legacy)
    await page.reload()
    await expect(page.getByText('今週の実施総数')).toContainText(failure === 'write' ? '1/2' : '0/2')
    expect(await readCanonicalState(page)).toEqual(failure === 'write' ? data : cancelled)
    expect(await readStoredState(page)).toEqual(legacy)
  })
}

test('D-03/OIC-016: baseline settings/list/edit/custom required label and hide/show preserve IDs', async ({ page }) => {
  const data = canonicalData(); (data.exercises as Record<string, unknown>[])[0].classifications = [{ kind: 'bodyRegion', label: '前腕（補助）' }]
  await seedCanonicalAndReload(page, data)
  await settings(page)
  await expect(page.getByLabel('ビルド識別子')).toHaveText(/^Build /)
  await expect(page.getByRole('button', { name: /^カテゴリ / })).toHaveCount(0)
  await page.getByRole('button', { name: /^種目 / }).click()
  await page.getByRole('button').filter({ has: page.locator('b').getByText('正規テストプレス', { exact: true }) }).click()
  await expect(page.getByRole('combobox', { name: '部位', exact: true })).toHaveValue('custom')
  await expect(page.getByLabel('カスタム部位')).toHaveValue('前腕（補助）')
  await page.getByLabel('カスタム部位').fill('   '); await expect(page.getByRole('button', { name: '保存', exact: true })).toBeDisabled()
  await page.getByLabel('カスタム部位').fill('前腕（補助）'); await page.getByRole('button', { name: '保存', exact: true }).click()
  expect((await readCanonicalState(page)).exercises).toEqual(data.exercises)
  await page.getByRole('button', { name: '＋ 種目を登録' }).click()
  await page.getByLabel('種目名').fill('カスタム追加')
  await expect(page.getByRole('button', { name: '種目だけ保存' })).toBeDisabled()
  const select = page.getByRole('combobox', { name: '部位', exact: true })
  await expect(select.locator('option')).toHaveText(['選択してください', '胸', '背中', '腕', '肩', '下半身', '体幹', 'その他 / カスタム'])
  await select.selectOption('custom'); await page.getByLabel('カスタム部位').fill('運動群'); await page.getByRole('button', { name: '種目だけ保存' }).click()
  await page.getByRole('button').filter({ has: page.locator('b').getByText('カスタム追加', { exact: true }) }).click()
  page.once('dialog', d => d.dismiss()); await page.getByRole('button', { name: 'この種目を非表示にする' }).click()
  await expect(page.getByLabel('種目名')).toHaveValue('カスタム追加')
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'この種目を非表示にする' }).click()
  await page.getByLabel('非表示データを表示').check(); await page.getByRole('button').filter({ has: page.locator('b').getByText('カスタム追加', { exact: true }) }).click(); await page.getByRole('button', { name: '再表示する' }).click()
  await page.reload(); expect((await readCanonicalState(page)).exercises).toHaveLength(2)
})

test('OIC-011 / PRESERVE: full screen population back/menu, Profile and Analysis original controls including half-year', async ({ page }, info) => {
  await page.clock.install({ time: instant }); await page.clock.setFixedTime(instant); await seedCanonicalAndReload(page, { ...canonicalData(), sessions: [session('one', '2026-10-03')] })
  const root = info.outputPath('population'); await mkdir(root, { recursive: true })
  const inventory: unknown[] = []
  const record = async (id: string) => { await page.evaluate(async () => document.fonts.ready); inventory.push({ id, text: await page.locator('main').innerText(), controls: await page.locator('button,input,select,textarea').evaluateAll(nodes => nodes.map(node => ({ tag: node.tagName, text: node.textContent, label: node.getAttribute('aria-label') }))) }); await expect(page.getByRole('button', { name: '共通メニュー' })).toBeVisible(); await expect(page.locator('nav')).toHaveCount(0); await page.screenshot({ path: `${root}/${id}.png`, fullPage: true, animations: 'disabled' }) }
  await record('top'); await focusedChest(page); await record('category'); await page.getByLabel('実施済も表示').check(); await page.locator('[data-session-id="one"]').click(); await record('run-completed'); await page.getByRole('button', { name: /この実施項目の設定履歴を見る/ }).click(); await record('history-from-run')
  for (const name of ['プロフィール', '種目', '実施項目', '週メニュー', '設定履歴', '分析', 'データ管理', 'トレーナー連携']) {
    await open(page, name); await record(name)
    if (name === '分析') {
      await expect(page.getByRole('combobox', { name: '集計', exact: true }).locator('option')).toHaveText(['実施総重量', '総トレーニング負荷（参考）'])
      await expect(page.getByRole('combobox', { name: '期間', exact: true }).locator('option')).toHaveText(['週', '月', '四半期', '半年', '年'])
      await page.getByRole('combobox', { name: '表示', exact: true }).selectOption('detail'); await page.getByRole('combobox', { name: '内訳', exact: true }).selectOption('exercise'); await expect(page.getByRole('img', { name: 'トレーニング推移グラフ' })).toBeVisible(); await expect(page.getByText('● 記録時の名称')).toBeVisible()
    }
    if (['種目', '実施項目', '週メニュー'].includes(name)) { await page.getByRole('button', { name: name === '週メニュー' ? /^正規E2Eメニュー/ : /正規テストプレス/ }).click(); await record(`${name}-edit`); await page.getByRole('button', { name: '‹ 戻る' }).click(); await expect(page.getByRole('heading', { name, exact: true })).toBeVisible() }
  }
  await top(page); await page.getByRole('button', { name: '＋ 追加トレーニングを登録' }).click(); await record('extra-list'); await expect(page.getByRole('combobox', { name: '部位', exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: /正規テストプレス/ })).toContainText('20 kg × 10 回 × 3 セット')
  await writeFile(`${root}/inventory.json`, JSON.stringify(inventory, null, 2))
})

for (const boundary of ['2026-10-04T23:59:59+09:00', '2026-10-05T00:00:00+09:00', '2026-12-31T23:59:59+09:00', '2027-01-01T00:00:00+09:00', '2026-10-31T23:59:59+09:00', '2026-11-01T00:00:00+09:00']) {
  test(`Clock local midnight/week/month/year boundary ${boundary}`, async ({ page }) => {
    const before = new Date('2026-10-03T23:59:59+09:00'); await page.clock.install({ time: before }); await page.clock.setFixedTime(before)
    const data = canonicalData(); data.sessions = [session('fact', '2026-10-03')]
    await seedCanonicalAndReload(page, data); await expect(page.getByText('今日の実施総数')).toContainText('1/0')
    await page.clock.setFixedTime(new Date(boundary)); await page.reload(); await expect(page.getByText('今日の実施総数')).toContainText('0/')
    expect(await readCanonicalState(page)).toEqual(data)
    // TOP T-08 counts one Session against the two active Entries.
    const expected = boundary.startsWith('2026-10-04') ? '1/2' : '0/2'
    await expect(page.getByText('今週の実施総数')).toContainText(expected)
  })
}

test('OIC-015: all seven week starts warn/cancel, persist exact setting without rewriting historical facts', async ({ page }) => {
  await page.clock.install({ time: instant }); await page.clock.setFixedTime(instant); const data = { ...canonicalWriteFixture(), sessions: [session('fact', '2026-09-27')] }; await seedCanonicalAndReload(page, data)
  await open(page, 'プロフィール')
  const select = page.getByRole('combobox', { name: '週開始曜日', exact: true })
  page.once('dialog', d => d.dismiss()); await select.selectOption('6'); expect(await readCanonicalState(page)).toEqual(data)
  for (const day of [1, 2, 3, 4, 5, 6, 0]) {
    page.once('dialog', d => { expect(d.message()).toContain('過去を含む週集計'); d.accept() }); await select.selectOption(String(day))
    await expect.poll(() => readCanonicalState(page)).toEqual({ ...data, weekStartsOn: day })
  }
  await page.reload(); expect(await readCanonicalState(page)).toEqual(data)
})

test('canonical write read-back failure prevents stale editing; reload preserves original logical Session pair', async ({ page }) => {
  await page.clock.install({ time: instant }); await page.clock.setFixedTime(instant); await seedCanonicalAndReload(page, canonicalWriteFixture()); await run(page)
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put
    const get = IDBObjectStore.prototype.get
    const probe = { writes: 0, committed: false, injected: false }
    Object.assign(window, { runReadBackProbe: probe })
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'canonical') {
        probe.writes++
        this.transaction.addEventListener('complete', () => { probe.committed = true }, { once: true })
        IDBObjectStore.prototype.put = put
      }
      return put.apply(this, args)
    }
    IDBObjectStore.prototype.get = function (...args) {
      if (this.name === 'canonical' && this.transaction.mode === 'readonly' && probe.writes === 1) {
        probe.injected = true
        IDBObjectStore.prototype.get = get
        throw new Error('injected independent Run read-back failure')
      }
      return get.apply(this, args)
    }
  })
  await page.getByRole('button', { name: '種目を完了' }).click()
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'runReadBackProbe'))).toEqual({ writes: 1, committed: true, injected: true })
  await expect(page.getByRole('alert')).toContainText('通常編集へ戻れません')
  await expect(page.getByRole('button', { name: '種目を完了' })).toHaveCount(0)
  const saved = await readCanonicalState(page); expect(saved.sessions).toHaveLength(1)
  await page.getByRole('button', { name: '保存状態を再読込' }).click(); expect(await readCanonicalState(page)).toEqual(saved)
})

test('H-09 startup/Restore reject unsupported old canonical without repair, Session drop or legacy fallback', async ({ page }) => {
  await page.clock.install({ time: instant }); await page.clock.setFixedTime(instant)
  const current = { ...canonicalWriteFixture(), sessions: [session('fact', '2026-10-03')] }
  const old = structuredClone(current); delete (old.sessions[0] as Record<string, unknown>).performedOrder
  await seedCanonicalAndReload(page, old)
  await expect(page.getByText(/正規データを読み込めません/)).toBeVisible()
  expect(await readCanonicalState(page)).toEqual(old)
  await page.reload(); expect(await readCanonicalState(page)).toEqual(old)
  // Recover by an explicit valid Backup; no old pair is guessed.
  await page.getByLabel('正規バックアップを選択').setInputFiles({ name: 'current.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'training-check-backup', schemaVersion: 1, createdAt: instant.toISOString(), payload: current })) })
  await expect(page.getByRole('heading', { name: '今週の実施メニュー' })).toBeVisible()
  expect(await readCanonicalState(page)).toEqual(current)
  await open(page, 'データ管理')
  await page.getByLabel('正規バックアップを選択').setInputFiles({ name: 'old.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'training-check-backup', schemaVersion: 1, createdAt: instant.toISOString(), payload: old })) })
  await expect(page.getByRole('heading', { name: '復元できません' })).toBeVisible()
  expect(await readCanonicalState(page)).toEqual(current)
})

test('PRESERVE Profile all fields and standard-setting failure/retry create exactly one event', async ({ page }) => {
  await page.clock.install({ time: instant }); await page.clock.setFixedTime(instant); await seedCanonicalAndReload(page, canonicalData())
  await open(page, 'プロフィール')
  await page.getByRole('spinbutton', { name: /体重/ }).fill('67.5'); await page.getByLabel('身長（cm）').fill('171'); await page.getByLabel('年齢').fill('42'); await page.getByLabel('性別').fill('male')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  expect((await readCanonicalState(page)).profile).toEqual({ weight: 67.5, height: 171, age: 42, sex: 'male' })
  await open(page, '実施項目'); await page.getByRole('button').filter({ has: page.locator('b').getByText('正規テストプレス', { exact: true }) }).click()
  await page.getByLabel('回数', { exact: true }).fill('12'); await page.getByLabel('変更理由（任意）').fill('更新確認')
  const before = await readCanonicalState(page)
  await injectWriteFailure(page); await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('保存に失敗しました'); expect(await readCanonicalState(page)).toEqual(before)
  await page.getByRole('button', { name: '保存', exact: true }).dblclick()
  await expect.poll(async () => (await readCanonicalState(page)).trainingItemSettingChanges).toHaveLength(2)
  const after = await readCanonicalState(page); expect((after.trainingItems as { reps: number }[])[0].reps).toBe(12)
  await page.reload(); expect(await readCanonicalState(page)).toEqual(after)
})

test('D-01 Warning requires acknowledgment and rollback uncertainty blocks edits until reload', async ({ page }) => {
  await page.clock.install({ time: instant }); await page.clock.setFixedTime(instant); await seedCanonicalAndReload(page, canonicalData()); await open(page, 'トレーナー連携')
  await page.getByLabel('提案ファイルを選択').setInputFiles({ name: 'warning.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ contractVersion: '1.0', proposalId: 'warning', menu: { name: '正規E2Eメニュー' }, entries: [{ trainingItemId: 'canonical-item', order: 0 }] })) })
  await expect(page.getByRole('heading', { name: '確認が必要な項目' })).toBeVisible()
  await expect(page.getByRole('button', { name: '新しい週メニューを作成' })).toBeDisabled()
  await page.getByLabel('内容を確認しました').check()
  const before = await readCanonicalState(page)
  await page.evaluate(() => {
    const get = IDBObjectStore.prototype.get, put = IDBObjectStore.prototype.put
    let candidatePersisted = false
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'canonical') {
        if (candidatePersisted) { IDBObjectStore.prototype.put = put; throw new Error('injected rollback write failure') }
        candidatePersisted = true
      }
      return put.apply(this, args)
    }
    IDBObjectStore.prototype.get = function (...args) { if (this.name === 'canonical') { IDBObjectStore.prototype.get = get; throw new Error('injected candidate read failure') } return get.apply(this, args) }
  })
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: '新しい週メニューを作成' }).click()
  await expect(page.getByRole('alert')).toContainText('通常編集へ戻れません')
  await expect(page.getByRole('heading', { name: 'メニューを作成しました' })).toHaveCount(0)
  const saved = await readCanonicalState(page); expect(saved.menus).toHaveLength(2); expect(saved.activeMenuId).toBe(before.activeMenuId)
  await page.getByRole('button', { name: '保存状態を再読込' }).click(); expect(await readCanonicalState(page)).toEqual(saved)
})

test('OIC-015 Analysis weekly rebuckets and month/quarter/half/year remain unchanged after week-setting change', async ({ page }) => {
  await page.clock.install({ time: instant }); await page.clock.setFixedTime(instant)
  const data = { ...canonicalData(), sessions: [session('Sunday', '2026-09-27')] }; await seedCanonicalAndReload(page, data)
  const graph = async (period: string) => { await open(page, '分析'); await page.getByRole('combobox', { name: '期間', exact: true }).selectOption(period); return page.locator('polyline').getAttribute('points') }
  const weekly = await graph('week'); const unchanged = new Map<string, string | null>()
  for (const period of ['month', 'quarter', 'half', 'year']) unchanged.set(period, await graph(period))
  await open(page, 'プロフィール'); page.once('dialog', d => d.accept()); await page.getByRole('combobox', { name: '週開始曜日', exact: true }).selectOption('6')
  expect(await graph('week')).not.toBe(weekly)
  for (const period of ['month', 'quarter', 'half', 'year']) expect(await graph(period)).toBe(unchanged.get(period))
  expect((await readCanonicalState(page)).sessions).toEqual(data.sessions)
})

test('PRESERVE time Exercise → Item setup → Run slots → Extra completion and load snapshot', async ({ page }) => {
  await page.clock.install({ time: instant }); await page.clock.setFixedTime(instant); await seedCanonicalAndReload(page, canonicalData())
  await open(page, '種目'); await page.getByRole('button', { name: '＋ 種目を登録' }).click(); await page.getByLabel('種目名').fill('時間型プランク')
  await page.getByRole('combobox', { name: '部位', exact: true }).selectOption('体幹'); await page.getByRole('combobox', { name: '計測方法', exact: true }).selectOption('time')
  await page.getByRole('spinbutton', { name: /秒間負荷係数/ }).fill('10'); await page.getByRole('button', { name: '保存して実施項目を設定' }).click()
  await page.getByLabel('時間（秒）').fill('30'); await page.getByLabel('セット数', { exact: true }).fill('3'); await page.getByRole('button', { name: '保存', exact: true }).click()
  const before = await readCanonicalState(page)
  await top(page); await page.getByRole('button', { name: '＋ 追加トレーニングを登録' }).click(); await page.getByRole('button', { name: /時間型プランク/ }).click()
  await expect(page.locator('.weight-controls')).toHaveCount(0); await expect(page.getByRole('region', { name: '前回実績' })).toHaveCount(0)
  await page.getByRole('button', { name: '時間を増やす' }).click(); await page.getByRole('button', { name: 'セット数を増やす' }).click(); await page.getByRole('button', { name: '種目を完了' }).click()
  const after = await readCanonicalState(page); expect((after.sessions as Record<string, unknown>[])[0]).toMatchObject({ seconds: 40, sets: 4, bodyWeight: 66, snapshot: { measureType: 'time', secondsLoadRatio: 10 } }); expect(after.trainingItems).toEqual(before.trainingItems)
  await expect(page.getByText('1,056 pt', { exact: true })).toBeVisible(); await page.reload(); expect(await readCanonicalState(page)).toEqual(after)
})

test('PRESERVE list filter/hidden state, Item hide/show, Menu active guard/confirmation and unsaved cancel', async ({ page }) => {
  await seedCanonicalAndReload(page, canonicalWriteFixture()); const original = await readCanonicalState(page)
  await open(page, '実施項目'); await page.getByRole('combobox', { name: '部位', exact: true }).selectOption('胸'); await page.getByRole('button').filter({ has: page.locator('b').getByText('正規テストプレス', { exact: true }) }).click()
  page.once('dialog', d => d.dismiss()); await page.getByRole('button', { name: 'この実施項目を非表示にする' }).click(); expect(await readCanonicalState(page)).toEqual(original)
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'この実施項目を非表示にする' }).click()
  await expect(page.getByRole('combobox', { name: '部位', exact: true })).toHaveValue('胸'); await page.getByLabel('非表示データを表示').check(); await page.getByRole('button').filter({ has: page.locator('b').getByText('正規テストプレス', { exact: true }) }).click(); await page.getByRole('button', { name: '‹ 戻る' }).click(); await expect(page.getByLabel('非表示データを表示')).toBeChecked()
  await open(page, '分析'); await open(page, '実施項目'); await expect(page.getByLabel('非表示データを表示')).toBeChecked(); await expect(page.getByRole('combobox', { name: '部位', exact: true })).toHaveValue('胸')
  await page.getByRole('button').filter({ has: page.locator('b').getByText('正規テストプレス', { exact: true }) }).click(); await page.getByRole('button', { name: '再表示する' }).click(); expect(await readCanonicalState(page)).toEqual(original)
  await open(page, '週メニュー'); await page.getByRole('button', { name: /^正規E2Eメニュー/ }).click(); await expect(page.getByRole('button', { name: '使用中の週メニューは非表示にできません' })).toBeDisabled()
  await page.getByRole('button', { name: '‹ 戻る' }).click(); await page.getByRole('button', { name: '＋ 週メニューを登録' }).click(); await page.getByLabel('週メニュー名').fill('追加メニュー'); await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.getByRole('button', { name: /^追加メニュー / }).click(); page.once('dialog', d => d.dismiss()); await page.getByRole('button', { name: 'この週メニューを非表示にする' }).click(); await expect(page.getByLabel('週メニュー名')).toHaveValue('追加メニュー')
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'この週メニューを非表示にする' }).click(); await page.getByLabel('非表示データを表示').check(); await page.getByRole('button', { name: /^追加メニュー / }).click(); await page.getByRole('button', { name: '再表示する' }).click()
  await expect(page.getByLabel('非表示データを表示')).not.toBeChecked(); expect((await readCanonicalState(page)).activeMenuId).toBe(original.activeMenuId)
})

for (const name of ['Owner確認候補', 'Owner確認候補 (ByAI)']) {
  test(`Trainer v1 TR-02/TR-04: ${name}, preview, cancel, apply, replay rejection and 100-day Context`, async ({ page }, info) => {
    await page.clock.setFixedTime(instant)
    const before = { ...canonicalWriteFixture(), sessions: [
      session('outside-context', '2026-06-25'),
      session('first-context-day', '2026-06-26'),
      session('last-context-day', '2026-10-03'),
    ] }
    await seedCanonicalAndReload(page, before)
    await open(page, 'トレーナー連携')
    const input = page.getByLabel('提案ファイルを選ぶ')
    await expect(input).toBeEnabled()
    const proposal = {
      format: 'training-project.trainer-proposal', version: 1, proposalId: `qa-trainer-v1-${name}`, baseRevision: 'synthetic',
      masterSuggestions: { exercises: [], trainingItems: [] }, trainingItemChanges: [], washRequests: [],
      menuProposals: [{ candidateId: 'qa-menu', name, entries: [
        { candidateId: 'qa-entry', trainingItemRef: { kind: 'existing', trainingItemId: 'canonical-item' }, order: 0 },
      ] }],
    }
    const upload = (value: unknown) => input.setInputFiles({ name: 'trainer.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) })
    await upload({ ...proposal, unexpected: true })
    await expect(page.getByRole('button', { name: '診断情報を保存' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '取り込む内容' })).toHaveCount(0)
    expect(await readCanonicalState(page)).toEqual(before)
    await upload(proposal)
    await expect(page.getByRole('heading', { name: '取り込む内容' })).toBeVisible()
    await expect(page.getByText(name, { exact: true })).toBeVisible()
    const apply = page.getByRole('button', { name: 'この内容を取り込む' })
    page.once('dialog', dialog => dialog.dismiss())
    await apply.click()
    await expect(apply).toBeVisible()
    expect(await readCanonicalState(page)).toEqual(before)
    page.once('dialog', dialog => dialog.accept())
    await apply.click()
    await expect(page.getByText('トレーナーからの提案を取り込みました。', { exact: true })).toBeVisible()
    const saved = await readCanonicalState(page)
    const menus = saved.menus as { id: string }[]
    const added = menus[menus.length - 1]
    expect(added.id).toBeTruthy()
    expect(saved).toEqual({
      ...before,
      appliedProposalIds: [proposal.proposalId],
      menus: [...before.menus, { id: added.id, name, lifecycle: 'active', managementMode: 'TRAINER' }],
      menuEntries: [...before.menuEntries as object[], { id: expect.any(String), menuId: added.id, lifecycle: 'active', trainingItemId: 'canonical-item', order: 0 }],
    })
    await page.reload()
    await open(page, 'トレーナー連携')
    await expect(input).toBeEnabled()
    await upload(proposal)
    await expect(page.getByRole('button', { name: '診断情報を保存' })).toBeVisible()
    expect(await readCanonicalState(page)).toEqual(saved)
    const downloadEvent = page.waitForEvent('download')
    await page.getByRole('button', { name: 'トレーナー用ファイルを作る' }).click()
    const download = await downloadEvent
    const context = JSON.parse(await readFile((await download.path())!, 'utf8'))
    expect(context).toMatchObject({ version: 1, fromDate: '2026-06-26', toDate: '2026-10-03' })
    expect(context.history.map((row: { id: string }) => row.id)).toEqual(['first-context-day', 'last-context-day'])
    expect(await readCanonicalState(page)).toEqual(saved)
    await info.attach('trainer-v1-context-boundary', { body: JSON.stringify({ fromDate: context.fromDate, toDate: context.toDate, historyIds: context.history.map((row: { id: string }) => row.id) }), contentType: 'application/json' })
  })
}

for (const fault of ['read-back', 'marker-clear'] as const) {
  test(`Trainer v1 TRO-03: ${fault} failure retains committed data and holds after reload`, async ({ page }, info) => {
    const before = canonicalWriteFixture()
    await seedCanonicalAndReload(page, before)
    await open(page, 'トレーナー連携')
    const input = page.getByLabel('提案ファイルを選ぶ')
    await expect(input).toBeEnabled()
    const proposalId = `trainer-v1-held-${fault}`
    const proposal = {
      format: 'training-project.trainer-proposal', version: 1, proposalId, baseRevision: 'synthetic',
      masterSuggestions: { exercises: [], trainingItems: [] }, trainingItemChanges: [], washRequests: [],
      menuProposals: [{ candidateId: 'held-menu', name: '保留確認メニュー', entries: [] }],
    }
    await input.setInputFiles({ name: 'trainer.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(proposal)) })
    await expect(page.getByRole('heading', { name: '取り込む内容' })).toBeVisible()
    await page.evaluate(fault => {
      const put = IDBObjectStore.prototype.put
      const get = IDBObjectStore.prototype.get
      const probe = { writes: 0, committed: false, independentReads: 0, injected: false }
      Object.assign(window, { trainerHoldProbe: probe })
      IDBObjectStore.prototype.put = function (...args) {
        if (this.name === 'canonical') {
          probe.writes++
          this.transaction.addEventListener('complete', () => { probe.committed = true }, { once: true })
          IDBObjectStore.prototype.put = put
        }
        return put.apply(this, args)
      }
      IDBObjectStore.prototype.get = function (...args) {
        if (probe.writes === 1 && this.name === 'canonical' && this.transaction.mode === 'readonly') {
          probe.independentReads++
          if (fault !== 'read-back') return get.apply(this, args)
        } else if (!(fault === 'marker-clear' && probe.independentReads === 1 && this.name === 'cutover' && this.transaction.mode === 'readwrite')) {
          return get.apply(this, args)
        }
        probe.injected = true
        IDBObjectStore.prototype.get = get
        throw new Error(`injected Trainer v1 ${fault} fault`)
      }
    }, fault)
    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: 'この内容を取り込む' }).click()
    const readProbe = () => page.evaluate(() => Reflect.get(window, 'trainerHoldProbe'))
    await expect.poll(readProbe).toEqual({ writes: 1, committed: true, independentReads: 1, injected: true })
    const probe = await readProbe()
    const saved = await readCanonicalState(page)
    const menus = saved.menus as { id: string }[]
    expect(saved).toEqual({
      ...before, appliedProposalIds: [proposalId],
      menus: [...before.menus, { id: menus[menus.length - 1].id, lifecycle: 'active', managementMode: 'TRAINER', name: '保留確認メニュー' }],
    })
    const readMarker = () => page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('training-check', 7)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      try {
        return await new Promise<string | undefined>((resolve, reject) => {
          const request = db.transaction('cutover').objectStore('cutover').get('state')
          request.onsuccess = () => resolve(request.result.trainerPendingProposalId)
          request.onerror = () => reject(request.error)
        })
      } finally { db.close() }
    })
    const assertHeld = async () => {
      await expect(input).toBeDisabled()
      await expect(page.getByRole('button', { name: 'トレーナー用ファイルを作る' })).toBeDisabled()
      await expect(page.getByRole('button', { name: 'この内容を取り込む' })).toHaveCount(0)
      await expect(page.getByRole('button', { name: '診断情報を保存' })).toBeEnabled()
      await expect(page.getByText('トレーナーからの提案を取り込みました。', { exact: true })).toHaveCount(0)
      expect(await readMarker()).toBe(proposalId)
      expect(await readCanonicalState(page)).toEqual(saved)
    }
    await assertHeld()
    await page.reload()
    await open(page, 'トレーナー連携')
    await assertHeld()
    await info.attach('trainer-v1-hold', { body: JSON.stringify({ fault, probe, marker: await readMarker(), canonical: saved }), contentType: 'application/json' })
  })
}

test('Trainer v1 TRO-02/03: Master, standards, wash and MAN rejection', async ({ page }) => {
  await page.clock.setFixedTime(instant)
  const base = canonicalWriteFixture()
  const before = {
    ...base,
    trainingItemSettingChanges: [...base.trainingItemSettingChanges as object[], {
      id: 'trainer-initial', trainingItemId: 'trainer-item', changedAt: '2026-09-21T10:00:00+09:00',
      isInitial: true, snapshot: { reps: 6, sets: 2, weight: 10 },
    }],
    sessions: [session('unchanged-session', '2026-10-03')],
    trainingItems: [...base.trainingItems, { id: 'trainer-item', lifecycle: 'active', managementMode: 'TRAINER', exerciseId: 'canonical-exercise', displayName: 'Trainer item', reps: 6, sets: 2, weight: 10 }],
    menus: [...base.menus, ...['remove-menu', 'replace-menu'].map(id => ({ id, name: id, lifecycle: 'active', managementMode: 'TRAINER' }))],
    menuEntries: [...base.menuEntries as object[], ...['remove-menu', 'replace-menu'].map(id => ({ id: id + '-entry', menuId: id, trainingItemId: 'canonical-item', lifecycle: 'active', order: 0 }))],
  }
  await seedCanonicalAndReload(page, before)
  await open(page, 'トレーナー連携')
  const input = page.getByLabel('提案ファイルを選ぶ')
  await expect(input).toBeEnabled()
  const proposal = {
    format: 'training-project.trainer-proposal', version: 1, proposalId: 'qa-full-scope', baseRevision: 'synthetic',
    masterSuggestions: {
      exercises: [{ candidateId: 'new-ex', name: '合成新種目', bodyRegion: '胸', measureType: 'reps', usesWeight: false, selfWeightRatio: 0, secondsLoadRatio: 0 }],
      trainingItems: [{ candidateId: 'new-ti', name: '合成新項目', exerciseRef: { kind: 'candidate', candidateId: 'new-ex' }, reps: 8, sets: 2 }],
    },
    trainingItemChanges: [{ operation: 'TRAINER_TI_SETTINGS_UPDATE', targetTrainingItemId: 'trainer-item', settings: { reps: 9, sets: 2, weight: 10 } }],
    menuProposals: [],
    washRequests: [
      { operation: 'MENU_ENTRY_REMOVE', targetMenuId: 'remove-menu', entryId: 'remove-menu-entry' },
      { operation: 'MENU_ENTRY_REPLACE', targetMenuId: 'replace-menu', entries: [{ kind: 'candidate', candidateId: 'new-entry', trainingItemRef: { kind: 'candidate', candidateId: 'new-ti' }, order: 0 }] },
    ],
  }
  const upload = (value: unknown) => input.setInputFiles({ name: 'scope.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) })
  const rejected = [
    { ...proposal, trainingItemChanges: [{ ...proposal.trainingItemChanges[0], targetTrainingItemId: 'canonical-item' }] },
    { ...proposal, washRequests: [{ operation: 'MENU_ENTRY_REMOVE', targetMenuId: 'canonical-menu', entryId: 'canonical-entry-a' }, proposal.washRequests[1]] },
    { ...proposal, washRequests: [proposal.washRequests[0], { ...proposal.washRequests[1], targetMenuId: 'canonical-menu' }] },
  ]
  for (const invalid of rejected) {
    await page.reload()
    await open(page, 'トレーナー連携')
    await expect(input).toBeEnabled()
    await upload(invalid)
    await expect(page.getByRole('button', { name: '診断情報を保存' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '取り込む内容' })).toHaveCount(0)
    await expect(input).toBeEnabled()
    await expect(page.getByRole('button', { name: 'トレーナー用ファイルを作る' })).toBeEnabled()
    expect(await readCanonicalState(page)).toEqual(before)
  }
  await upload(proposal)
  await expect(page.getByRole('heading', { name: '取り込む内容' })).toBeVisible()
  await page.evaluate(() => {
    const probe = { canonicalAttempts: 0, nativeCanonicalPuts: 0, cutoverPuts: 0, aborted: false }
    Object.assign(window, { trainerPreWriteProbe: probe })
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'canonical' && probe.canonicalAttempts++ === 0) {
        this.transaction.addEventListener('abort', () => { probe.aborted = true }, { once: true })
        throw new Error('injected before native canonical put')
      }
      if (this.name === 'canonical') probe.nativeCanonicalPuts++
      if (this.name === 'cutover') probe.cutoverPuts++
      return put.apply(this, args)
    }
  })
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'この内容を取り込む' }).click()
  await expect(page.getByRole('button', { name: '診断情報を保存' })).toBeVisible()
  await expect(input).toBeEnabled()
  await expect(page.getByRole('button', { name: 'トレーナー用ファイルを作る' })).toBeEnabled()
  expect(await readCanonicalState(page)).toEqual(before)
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'trainerPreWriteProbe'))).toEqual({
    canonicalAttempts: 1, nativeCanonicalPuts: 0, cutoverPuts: 0, aborted: true,
  })
  const diagnosticEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: '診断情報を保存' }).click()
  const diagnostic = await diagnosticEvent
  expect(JSON.parse(await readFile((await diagnostic.path())!, 'utf8'))).toMatchObject({
    stage: 'apply', code: 'REJECTED_ZERO_MUTATION', proposalId: proposal.proposalId,
  })
  await page.reload()
  await open(page, 'トレーナー連携')
  await expect(input).toBeEnabled()
  await upload(proposal)
  await expect(page.getByRole('heading', { name: '取り込む内容' })).toBeVisible()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'この内容を取り込む' }).click()
  await expect(page.getByText('トレーナーからの提案を取り込みました。', { exact: true })).toBeVisible()
  const saved = await readCanonicalState(page)
  const exercise = (saved.exercises as { id: string }[]).at(-1)!
  const item = (saved.trainingItems as { id: string }[]).at(-1)!
  const entry = (saved.menuEntries as { id: string }[]).at(-1)!
  expect(new Set([exercise.id, item.id, entry.id]).size).toBe(3)
  expect(saved.exercises).toEqual([...before.exercises as object[], { id: exercise.id, lifecycle: 'active', name: '合成新種目', measureType: 'reps', usesWeight: false, selfWeightRatio: 0, secondsLoadRatio: 0, classifications: [{ kind: 'bodyRegion', label: '胸' }] }])
  expect(saved.trainingItems).toEqual([before.trainingItems[0], { ...before.trainingItems[1], reps: 9 }, { id: item.id, lifecycle: 'active', managementMode: 'TRAINER', exerciseId: exercise.id, displayName: '合成新項目', reps: 8, sets: 2 }])
  expect(saved.menuEntries).toEqual([
    ...base.menuEntries as object[],
    ...['remove-menu', 'replace-menu'].map(id => ({ id: id + '-entry', menuId: id, trainingItemId: 'canonical-item', lifecycle: 'archived', order: 0 })),
    { id: entry.id, menuId: 'replace-menu', trainingItemId: item.id, lifecycle: 'active', order: 0 },
  ])
  expect(saved.trainingItemSettingChanges).toEqual([
    ...before.trainingItemSettingChanges as object[],
    expect.objectContaining({ trainingItemId: item.id, isInitial: true, snapshot: { reps: 8, sets: 2 } }),
    expect.objectContaining({ trainingItemId: 'trainer-item', snapshot: { reps: 9, sets: 2, weight: 10 } }),
  ])
  expect(saved).toMatchObject({ sessions: before.sessions, activeMenuId: before.activeMenuId, menus: before.menus, profile: before.profile, appliedProposalIds: [proposal.proposalId] })
  await page.getByText('保存結果を確認', { exact: true }).click()
  for (const [candidate, id] of [['new-ex', exercise.id], ['new-ti', item.id], ['new-entry', entry.id]]) {
    await expect(page.getByText(`${candidate} → ${id}`, { exact: true })).toBeVisible()
  }
  await page.reload()
  expect(await readCanonicalState(page)).toEqual(saved)
})
