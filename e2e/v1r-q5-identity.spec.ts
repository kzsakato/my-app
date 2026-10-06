import { expect, test, type Page } from '@playwright/test'
import { canonicalData, seedCanonicalAndReload, readCanonicalState, readStoredState } from './helpers/state'
import { createCanonicalSession } from '../src/canonical/runtime'
import { addTrainingItem } from '../src/canonical/operations'
import { validateCanonical } from '../src/canonical/validate'
import type { CanonicalAppData, Session } from '../src/canonical/types'

const instant = new Date('2026-10-06T12:00:00+09:00')
async function top(page: Page) {
  await page.getByRole('button', { name: '共通メニュー' }).click()
  await page.getByRole('button', { name: '実施メニュー', exact: true }).click()
}
async function list(page: Page, mode: 'category' | 'recommended', region = '胸') {
  await top(page)
  await page.getByRole('button', { name: mode === 'category' ? 'カテゴリ表示' : '推奨曜日', exact: true }).click()
  if (mode === 'category') await page.getByRole('button', { name: new RegExp(`^${region} `) }).click()
  await page.getByLabel('実施済も表示').check()
}
async function assertRows(page: Page, sessions: Session[]) {
  await expect(page.locator('[data-session-id]')).toHaveCount(sessions.length)
  for (const session of sessions) {
    const row = page.locator(`[data-session-id="${session.id}"]`)
    await expect(row.locator('b')).toHaveText(session.snapshot.trainingItemDisplayName)
    expect(await row.getAttribute('data-session-menu-entry-id')).toBe(session.menuEntryId ?? null)
    if (!session.menuEntryId) await expect(row).toContainText('追加実施')
    // Independent oracle: Oct 6 is the only completed date in this fixture.
    expect((await row.locator('.item-history').innerText()).replaceAll('｜', '')).toBe('○'.repeat(13) + '●')
  }
}
async function actual(page: Page, session: Session) {
  const row = page.locator(`[data-session-id="${session.id}"]`)
  await expect(row.locator('b')).toHaveText(session.snapshot.trainingItemDisplayName)
  await row.click()
  await expect(page.getByRole('heading', { name: session.snapshot.trainingItemDisplayName, exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: '当該実績' })).toContainText(`${session.weight} kg × ${session.reps} 回 × ${session.sets} セット`)
  await expect(page.getByLabel('今回メモ')).toHaveValue(session.memo!)
}
function fixture(shape: string) {
  let data = canonicalData() as unknown as CanonicalAppData
  data.trainingItems[0].displayName = 'プレス重'
  data.menuEntries.forEach(entry => { entry.recommendedDay = 1 })
  data = addTrainingItem(data, { ...data.trainingItems[0], id: 'light', displayName: 'プレス軽', weight: 20 }, { newId: () => 'light-setting', now: () => instant.toISOString() })
  const make = (id: string, itemIndex: number, entryIndex: number | undefined, order: number) => createCanonicalSession({
    id, item: data.trainingItems[itemIndex], exercise: data.exercises[0], date: '2026-10-06', performedAt: instant.toISOString(), performedOrder: order,
    menuEntryId: entryIndex === undefined ? undefined : data.menuEntries[entryIndex].id,
    weight: 40 - order * 10, reps: 8 + order, sets: 2 + order, bodyWeight: 66, memo: id,
  })
  if (shape === 'different-items-extra') data.menuEntries.splice(1)
  data.sessions = [make('normal-A', 0, 0, 0),
    make('normal-B', 0, shape === 'different-entries' ? 1 : 0, 1), make('extra-L', 1, undefined, 2)]
  expect(validateCanonical(data).errors).toEqual([])
  return data
}

for (const shape of ['different-items-extra', 'different-entries', 'same-membership']) {
  test(`H09 independent Session identity, both modes and cancellation: ${shape}`, async ({ page }, info) => {
    test.setTimeout(90000)
    await page.clock.install({ time: instant }); await page.clock.setFixedTime(instant)
    const data = fixture(shape)
    await seedCanonicalAndReload(page, data as unknown as Record<string, unknown>)
    const legacy = await readStoredState(page)
    let remaining = [...data.sessions]
    const evidence: unknown[] = []
    for (const target of [...data.sessions, undefined]) {
      await top(page)
      await expect(page.getByText('今日の実施総数')).toContainText(`${remaining.length ? 1 : 0}/1`)
      await expect(page.getByText('今週の実施総数')).toContainText(`${remaining.length ? data.menuEntries.length : 0}/${data.menuEntries.length}`)
      for (const mode of ['category', 'recommended'] as const) {
        await list(page, mode)
        await assertRows(page, remaining)
        for (const session of remaining) {
          await actual(page, session)
          await page.getByRole('button', { name: '戻る', exact: true }).click()
          await page.getByLabel('実施済も表示').check()
        }
        evidence.push({ mode, target: target?.id, labels: await page.locator('[data-session-id] b').allTextContents() })
      }
      if (!target) break
      await list(page, 'category')
      await actual(page, target)
      page.once('dialog', dialog => dialog.accept())
      await page.getByRole('button', { name: '10/6の実行を取り消す' }).click()
      remaining = remaining.filter(session => session.id !== target.id)
      await expect.poll(() => readCanonicalState(page)).toEqual({ ...data, sessions: remaining })
      expect(JSON.stringify((await readCanonicalState(page)).sessions)).toBe(JSON.stringify(remaining))
      await page.reload()
      expect(await readCanonicalState(page)).toEqual({ ...data, sessions: remaining })
    }
    expect(await readStoredState(page)).toEqual(legacy)
    await info.attach('identity-evidence', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' })
  })
}

test('H09 snapshot-only Category destination and unclassified compatibility in recommended', async ({ page }) => {
  await page.clock.install({ time: instant }); await page.clock.setFixedTime(instant)
  const data = fixture('different-items-extra')
  const extra = data.sessions[2]
  extra.snapshot.classifications = [{ kind: 'bodyRegion', label: '記録時の部位' }]
  delete data.sessions[1].snapshot.classifications
  data.trainingItems[1].displayName = '現在の改名'
  await seedCanonicalAndReload(page, data as unknown as Record<string, unknown>)
  await list(page, 'category', '記録時の部位')
  await assertRows(page, [extra])
  await actual(page, extra)
  await list(page, 'recommended')
  await assertRows(page, data.sessions)
  await actual(page, data.sessions[1])
  await top(page)
  await expect(page.getByText('未分類', { exact: true })).toHaveCount(0)
  await page.reload()
  expect(await readCanonicalState(page)).toEqual(data)
})
