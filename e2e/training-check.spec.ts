import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { readStoredState, seedAndReload, seedData } from './helpers/state'

const monday = new Date('2026-09-21T10:00:00+09:00')

test('seeded menu item can be completed, persisted, and retained after reload', async ({ page }) => {
  await page.clock.install({ time: monday })
  await seedAndReload(page, seedData(0))

  await expect(page.getByRole('heading', { name: '今週の実施メニュー' })).toBeVisible()
  await page.getByRole('button', { name: /胸.*項目/ }).click()
  await page.getByRole('button', { name: /テストプレス/ }).click()
  await page.getByRole('button', { name: '種目を完了' }).click()
  await expect(page.getByText('未実施の項目はありません。')).toBeVisible()
  await page.getByRole('button', { name: /実施メニュー/ }).click()
  await expect(page.locator('.totals span').first()).toContainText('1/1')

  await expect.poll(async () => (await readStoredState(page)).sessions.length).toBe(1)
  await page.reload()
  await expect(page.getByText('今週の実施総数', { exact: false })).toContainText('1/1')
  expect((await readStoredState(page)).sessions).toHaveLength(1)
})

test('fixed date changes recommended display and resets the weekly completion state', async ({ page }) => {
  await page.clock.install({ time: monday })
  await seedAndReload(page, seedData(1))

  await page.getByRole('button', { name: '推奨曜日' }).click()
  await expect(page.getByText('表示する推奨日の項目はありません。')).toBeVisible()

  await page.clock.setFixedTime(new Date('2026-09-22T10:00:00+09:00'))
  await page.reload()
  await page.getByRole('button', { name: '推奨曜日' }).click()
  await page.getByRole('button', { name: /テストプレス/ }).click()
  await page.getByRole('button', { name: '種目を完了' }).click()
  await expect(page.getByText('今週の実施総数', { exact: false })).toContainText('1/1')

  await page.clock.setFixedTime(new Date('2026-09-28T10:00:00+09:00'))
  await page.reload()
  await expect(page.getByText('今週の実施総数', { exact: false })).toContainText('0/1')
})

test('backup export can restore the original state through the visible import control', async ({ page }) => {
  await page.clock.install({ time: monday })
  const original = seedData(0)
  await seedAndReload(page, original)
  await page.getByRole('button', { name: '設定' }).click()
  await page.getByRole('button', { name: 'データ管理' }).click()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'バックアップを作成' }).click()
  const download = await downloadPromise
  const backup = await readFile(await download.path()!)

  const changed = { ...original, profile: { ...original.profile, weight: 80 } }
  await seedAndReload(page, changed)
  await page.getByRole('button', { name: '設定' }).click()
  await page.getByRole('button', { name: 'データ管理' }).click()
  page.on('dialog', dialog => dialog.accept())
  await page.getByLabel('バックアップから復元').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: backup })
  await expect(page.getByRole('heading', { name: '設定' })).toBeVisible()
  await expect.poll(async () => (await readStoredState(page)).profile.weight).toBe(66)
})
