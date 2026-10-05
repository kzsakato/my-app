import { expect, test, type Page } from '@playwright/test'
import { canonicalData, seedCanonicalAndReload, readCanonicalState, readStoredState } from './helpers/state'
import { createCanonicalSession } from '../src/canonical/runtime'
import { addTrainingItem } from '../src/canonical/operations'
import { validateCanonical } from '../src/canonical/validate'
import type { CanonicalAppData, Session } from '../src/canonical/types'

// H-20261005-06 A1–A8, H03/04/05 specialist boundaries. No Owner storage used.
const instant = new Date('2026-10-03T12:00:00+09:00')
async function top(page: Page) {
  await page.getByRole('button', { name: '共通メニュー' }).click()
  await page.getByRole('button', { name: '実施メニュー', exact: true }).click()
}
async function items(page: Page) {
  await page.getByRole('button', { name: '共通メニュー' }).click()
  await page.getByRole('button', { name: '設定', exact: true }).click()
  await page.getByRole('button', { name: /^実施項目 / }).click()
}
async function actuals(page: Page) {
  await page.getByRole('button', { name: '推奨曜日', exact: true }).click()
  await page.getByLabel('実施済も表示').check()
}
async function ownActual(page: Page, session: Session) {
  await page.locator(`[data-session-id="${session.id}"]`).first().click()
  await expect(page.getByRole('region', { name: '当該実績' })).toContainText(`${session.weight} kg × ${session.reps} 回 × ${session.sets} セット`)
  await expect(page.getByLabel('シート位置')).toHaveValue(session.seat!)
  await expect(page.getByLabel('今回メモ')).toHaveValue(session.memo!)
  await expect(page.getByText(`${session.weight!.toFixed(2)} kg`, { exact: true })).toBeVisible()
  await expect(page.getByLabel('変更理由（任意）')).toHaveCount(0)
  await expect(page.getByRole('region', { name: '前回実績' })).toHaveCount(0)
}
async function projections(page: Page, remaining: Session[], entryCount: number) {
  await expect(page.getByText('今日の実施総数')).toContainText(`${remaining.length ? 1 : 0}/1`)
  await expect(page.getByText('今週の実施総数')).toContainText(`${remaining.length ? entryCount : 0}/${entryCount}`)
  // Independent 14-day oracle: all three actuals are on Oct 3. No product helper.
  const expected = `${'○'.repeat(13)}${remaining.length ? '●' : '○'}`
  for (const marker of await page.locator('.item-history').all()) {
    expect((await marker.innerText()).replaceAll('｜', '')).toBe(expected)
  }
  await expect(page.locator('.item-history').first()).toBeVisible()
}

for (const membership of ['same-item-two-entries', 'same-item-same-entry', 'two-items-same-exercise'] as const) {
  test(`H06 A1/A4/A5 normal A/B + UI Extra C cancellation identity: ${membership}`, async ({ page }, info) => {
    test.setTimeout(60000)
    await page.clock.install({ time: instant }); await page.clock.setFixedTime(instant)
    let data = canonicalData() as unknown as CanonicalAppData
    if (membership === 'two-items-same-exercise') {
      data = addTrainingItem(data, { ...data.trainingItems[0], id: 'item-b', displayName: '別設定プレス', reps: 15 }, { newId: () => 'change-b', now: () => '2026-10-01T00:00:00Z' })
      data.menuEntries[1].trainingItemId = 'item-b'
    }
    if (membership === 'same-item-same-entry') data.menuEntries.splice(1)
    data.menuEntries.forEach(entry => { entry.recommendedDay = 5 })
    // Normal records are created through the canonical factory, then persisted as
    // deterministic test setup. Extra C is created through real Run UI below.
    const create = (id: string, index: number, weight: number, order: number) => {
      const entry = data.menuEntries[index]
      const item = data.trainingItems.find(value => value.id === entry.trainingItemId)!
      return createCanonicalSession({ id, item, exercise: data.exercises[0], date: '2026-10-03', performedAt: instant.toISOString(), performedOrder: order, menuEntryId: entry.id, weight, reps: 7 + order, sets: 1 + order, bodyWeight: 66, seat: `seat-${id}`, memo: `memo-${id}` })
    }
    const a = create('normal-A', 0, 31, 0)
    const b = create('normal-B', membership === 'same-item-same-entry' ? 0 : 1, 42, 1)
    data.sessions = [b, a] // Array order deliberately differs from completion order.
    expect(validateCanonical(data).errors).toEqual([])
    await seedCanonicalAndReload(page, data as unknown as Record<string, unknown>)
    const legacy = await readStoredState(page)
    await page.getByRole('button', { name: '＋ 追加トレーニングを登録' }).click()
    await page.getByRole('button', { name: /胸：正規テストプレス/ }).click()
    await expect(page.getByLabel('変更理由（任意）')).toHaveCount(0)
    await expect(page.getByRole('region', { name: '前回実績' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /の実行を取り消す/ })).toHaveCount(0)
    await page.getByRole('button', { name: '重量を1kg増やす' }).click()
    await page.getByLabel('シート位置').fill('seat-C')
    await page.getByLabel('今回メモ').fill('memo-C')
    await page.getByRole('button', { name: '種目を完了' }).click()
    await expect(page.getByRole('heading', { name: '今週の実施メニュー' })).toBeVisible()
    const created = await readCanonicalState(page) as unknown as CanonicalAppData
    const c = created.sessions.find(row => row.id !== a.id && row.id !== b.id)!
    expect(c).toMatchObject({ weight: 21, reps: 10, sets: 3, seat: 'seat-C', memo: 'memo-C', performedAt: instant.toISOString(), performedOrder: 2 })
    expect(c.menuEntryId).toBeUndefined()
    expect({ ...created, sessions: data.sessions }).toEqual(data)
    let remaining = created.sessions
    const stages: unknown[] = [{ created }]
    await actuals(page)
    await projections(page, remaining, data.menuEntries.length)
    // Select each exact ID before cancellation: no latest-Exercise borrowing.
    for (const row of [a, b, c]) {
      await ownActual(page, row)
      await page.getByRole('button', { name: '戻る', exact: true }).click()
    }
    await page.screenshot({ path: info.outputPath('completed-records.png'), fullPage: true })
    for (const target of [b, a, c]) {
      await ownActual(page, target)
      page.once('dialog', dialog => dialog.accept())
      await page.getByRole('button', { name: '10/3の実行を取り消す' }).click()
      remaining = remaining.filter(row => row.id !== target.id)
      const expected = { ...created, sessions: remaining }
      await expect.poll(() => readCanonicalState(page)).toEqual(expected)
      expect(JSON.stringify((await readCanonicalState(page)).sessions)).toBe(JSON.stringify(remaining))
      await projections(page, remaining, data.menuEntries.length)
      for (const row of remaining) {
        await ownActual(page, row)
        await page.getByRole('button', { name: '戻る', exact: true }).click()
      }
      stages.push({ cancelledId: target.id, canonical: await readCanonicalState(page), markers: await page.locator('.item-history').allTextContents() })
      await page.reload()
      expect(await readCanonicalState(page)).toEqual(expected)
      await actuals(page)
      await projections(page, remaining, data.menuEntries.length)
      await expect(page.locator(`[data-session-id="${target.id}"]`)).toHaveCount(0)
    }
    expect(await readStoredState(page)).toEqual(legacy)
    await info.attach('H06-Session-identity-journey', { body: JSON.stringify(stages, null, 2), contentType: 'application/json' })
  })
}

for (const weekStartsOn of [0, 6]) {
  test(`H06 A2/A3 fixed weekday order and completed future-day discovery (weekStartsOn=${weekStartsOn})`, async ({ page }) => {
    await page.clock.install({ time: instant }); await page.clock.setFixedTime(instant)
    const data = canonicalData() as unknown as CanonicalAppData
    data.weekStartsOn = weekStartsOn
    data.menuEntries.forEach(entry => { entry.recommendedDay = 6 })
    const base = { item: data.trainingItems[0], exercise: data.exercises[0], date: '2026-10-02', performedAt: '2026-10-02T12:00:00+09:00', weight: 30, reps: 8, sets: 2, bodyWeight: 66 }
    data.sessions = [createCanonicalSession({ ...base, id: 'future-normal', performedOrder: 0, menuEntryId: data.menuEntries[0].id }), createCanonicalSession({ ...base, id: 'future-extra', performedOrder: 1 })]
    await seedCanonicalAndReload(page, data as unknown as Record<string, unknown>)
    await page.getByRole('button', { name: '推奨曜日', exact: true }).click()
    await expect(page.locator('[data-session-id]')).toHaveCount(0)
    await page.getByLabel('実施済も表示').check()
    await expect(page.locator('[data-session-id="future-normal"]')).toBeVisible()
    await expect(page.locator('[data-session-id="future-extra"]')).toBeVisible()
    const filter = page.getByRole('button', { name: /表示する推奨曜日:/ })
    await expect(filter).toHaveText('表示する推奨曜日: 土')
    await filter.click()
    await expect(page.getByRole('checkbox', { name: '日', exact: true })).not.toBeChecked()
    await page.getByRole('checkbox', { name: '土', exact: true }).uncheck()
    for (const day of ['日', '金', '水', '月', '土', '木', '火']) await page.getByRole('checkbox', { name: day, exact: true }).check()
    await expect(filter).toHaveText('表示する推奨曜日: 月・火・水・木・金・土・日')
    await page.getByRole('checkbox', { name: '月', exact: true }).uncheck()
    await page.getByRole('checkbox', { name: '月', exact: true }).check()
    await expect(filter).toHaveText('表示する推奨曜日: 月・火・水・木・金・土・日')
    for (const day of ['月', '火', '水', '木', '金', '日']) await page.getByRole('checkbox', { name: day, exact: true }).uncheck()
    await filter.click()
    await page.getByLabel('実施済も表示').uncheck()
    await expect(page.locator('[data-session-id]')).toHaveCount(0)
    await expect(filter).toHaveText('表示する推奨曜日: 土')
    expect(await readCanonicalState(page)).toEqual(JSON.parse(JSON.stringify(data)))
  })
}

test('H06 A6/A7/A8 zero defaults, canonical save blocking and form-local error lifecycle', async ({ page }, info) => {
  await page.clock.install({ time: instant })
  const data = canonicalData() as unknown as CanonicalAppData
  data.exercises.push({ id: 'time-exercise', lifecycle: 'active', name: '時間テスト', measureType: 'time', usesWeight: false, classifications: [{ kind: 'bodyRegion', label: '体幹' }] })
  await seedCanonicalAndReload(page, data as unknown as Record<string, unknown>)
  await items(page)
  await page.getByRole('button', { name: '＋ 実施項目を登録' }).click()
  await page.getByLabel('表示名').fill('新規0テスト')
  for (const label of ['重量（kg）', '回数', 'セット数']) await expect(page.getByLabel(label, { exact: true })).toHaveValue('0')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('回数')
  await expect(page.getByRole('alert')).toContainText('セット数')
  await expect(page.locator('body')).not.toContainText('trainingItems[')
  await expect(page.locator('body')).not.toContainText('trainingItemSettingChanges[')
  expect(await readCanonicalState(page)).toEqual(data)
  await page.screenshot({ path: info.outputPath('item-local-error.png'), fullPage: true })
  await page.getByLabel('回数', { exact: true }).fill('8')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('セット数')
  await expect(page.getByRole('alert')).not.toContainText('回数')
  await page.getByRole('button', { name: '‹ 戻る' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.getByRole('button', { name: /^正規テストプレス / }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByLabel('回数', { exact: true })).toHaveValue('10')
  await expect(page.getByLabel('セット数', { exact: true })).toHaveValue('3')
  await page.getByRole('button', { name: '‹ 戻る' }).click()
  await page.getByRole('button', { name: '＋ 実施項目を登録' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.getByLabel('表示名').fill('有効な新規時間')
  await page.getByLabel('元にする種目').selectOption('time-exercise')
  await expect(page.getByLabel('時間（秒）')).toHaveValue('0')
  await expect(page.getByLabel('セット数', { exact: true })).toHaveValue('0')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('時間（秒）')
  expect(await readCanonicalState(page)).toEqual(data)
  await top(page)
  await items(page)
  await page.getByRole('button', { name: '＋ 実施項目を登録' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.getByLabel('表示名').fill('有効な新規時間')
  await page.getByLabel('元にする種目').selectOption('time-exercise')
  await page.getByLabel('時間（秒）').fill('30')
  await page.getByLabel('セット数', { exact: true }).fill('2')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('heading', { name: '実施項目', exact: true })).toBeVisible()
  const saved = await readCanonicalState(page) as unknown as CanonicalAppData
  expect(saved.trainingItems).toHaveLength(2)
  expect(saved.trainingItems[0]).toEqual(data.trainingItems[0])
  expect(saved.trainingItems[1]).toMatchObject({ seconds: 30, sets: 2, displayName: '有効な新規時間' })
  expect(saved.trainingItems[1].reps).toBeUndefined()
  expect(validateCanonical(saved).errors).toEqual([])
  await page.reload()
  expect(await readCanonicalState(page)).toEqual(saved)
})
