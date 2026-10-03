import { test, expect } from '@playwright/test'
import { canonicalData, seedCanonicalAndReload } from './helpers/state'

// Pixel oracle: pre-change capture d4e5c09, pinned source add343ae.
// Exact Exercise Edit: D-03 changes choices/requiredness, preserves the selected
// normal-preset view and all unrelated baseline layout/controls. Never update this oracle.
test('selected VRT preserves baseline Exercise edit with an existing bodyRegion preset', async ({ page }) => {
  await page.setViewportSize({ width: 1020, height: 967 })
  await page.clock.install({ time: new Date('2026-10-03T12:00:00+09:00') })
  const data = canonicalData()
  Object.assign((data.exercises as Record<string, unknown>[])[0], { name: 'テストプレス', selfWeightRatio: 0, secondsLoadRatio: 0 })
  await seedCanonicalAndReload(page, data)
  await page.getByRole('button', { name: '共通メニュー' }).click()
  await page.getByRole('button', { name: '設定', exact: true }).click()
  await page.getByRole('button', { name: /^種目 / }).click()
  await page.getByRole('button', { name: /^テストプレス / }).click()
  await page.evaluate(async () => document.fonts.ready)
  expect(await page.screenshot({ fullPage: true, animations: 'disabled' })).toMatchSnapshot('exerciseEdit.png', { maxDiffPixels: 0 })
})

test('selected VRT preserves baseline Menu edit with confirmation changes outside the static view', async ({ page }) => {
  await page.setViewportSize({ width: 1020, height: 967 })
  await page.clock.install({ time: new Date('2026-10-03T12:00:00+09:00') })
  const data = canonicalData()
  Object.assign((data.exercises as Record<string, unknown>[])[0], { name: 'テストプレス', selfWeightRatio: 0, secondsLoadRatio: 0 })
  Object.assign((data.trainingItems as Record<string, unknown>[])[0], { displayName: 'テストプレス' })
  Object.assign((data.menus as Record<string, unknown>[])[0], { name: 'E2Eメニュー' })
  data.menuEntries = [{ ...(data.menuEntries as Record<string, unknown>[])[0], recommendedDay: 5 }]
  await seedCanonicalAndReload(page, data)
  await page.getByRole('button', { name: '共通メニュー' }).click()
  await page.getByRole('button', { name: '設定', exact: true }).click()
  await page.getByRole('button', { name: /^週メニュー / }).click()
  await page.getByRole('button', { name: /^E2Eメニュー/ }).click()
  await page.evaluate(async () => document.fonts.ready)
  expect(await page.screenshot({ fullPage: true, animations: 'disabled' })).toMatchSnapshot('menuEdit.png', { maxDiffPixels: 0 })
})
