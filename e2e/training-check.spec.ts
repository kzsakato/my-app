import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { canonicalData, readCanonicalState, readStoredState, seedAndReload, seedCanonicalAndReload, seedData } from './helpers/state'

const monday = new Date('2026-09-21T10:00:00+09:00')

test('common menu reaches settings and the bottom navigation is absent', async ({ page }) => {
  await page.clock.install({ time: monday })
  await seedAndReload(page, seedData(0))

  await expect(page.locator('nav')).toHaveCount(0)
  await page.getByRole('button', { name: '共通メニュー' }).click()
  await page.getByRole('button', { name: '設定' }).click()
  await expect(page.getByRole('heading', { name: '設定' })).toBeVisible()
  await page.getByRole('button', { name: '共通メニュー' }).click()
  await page.getByRole('button', { name: '実施メニュー' }).click()
  await expect(page.getByRole('heading', { name: '今週の実施メニュー' })).toBeVisible()
})

test('seeded menu item can be completed, persisted, and retained after reload', async ({ page }) => {
  await page.clock.install({ time: monday })
  await seedAndReload(page, seedData(0))

  await expect(page.getByRole('heading', { name: '今週の実施メニュー' })).toBeVisible()
  await page.getByRole('button', { name: /胸.*項目/ }).click()
  await page.getByRole('button', { name: /テストプレス/ }).click()
  await expect(page.getByRole('button', { name: '重量を1kg増やす' })).toBeVisible()
  await page.getByRole('button', { name: '重量を1kg増やす' }).click()
  await page.getByRole('button', { name: '重量を0.25kg減らす' }).click()
  await expect(page.getByText('20.75 kg')).toBeVisible()
  await page.getByRole('button', { name: '種目を完了' }).click()
  await expect(page.getByText('未実施の項目はありません。')).toBeVisible()
  await page.getByRole('button', { name: '共通メニュー' }).click()
  await page.getByRole('button', { name: '実施メニュー' }).click()
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
  await page.getByRole('button', { name: '共通メニュー' }).click()
  await page.getByRole('button', { name: '設定' }).click()
  await page.getByRole('button', { name: 'データ管理' }).click()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'バックアップを作成' }).click()
  const download = await downloadPromise
  const backup = await readFile(await download.path()!)

  const changed = { ...original, profile: { ...original.profile, weight: 80 } }
  await seedAndReload(page, changed)
  await page.getByRole('button', { name: '共通メニュー' }).click()
  await page.getByRole('button', { name: '設定' }).click()
  await page.getByRole('button', { name: 'データ管理' }).click()
  page.on('dialog', dialog => dialog.accept())
  await page.getByLabel('バックアップから復元').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: backup })
  await expect(page.getByRole('heading', { name: '設定' })).toBeVisible()
  await expect.poll(async () => (await readStoredState(page)).profile.weight).toBe(66)
})

test('canonical-authoritative runtime completes an entry and preserves a canonical-only session after reload', async ({ page }) => {
  await page.clock.install({ time: monday })
  await seedCanonicalAndReload(page, canonicalData())
  await expect(page.getByRole('heading', { name: '今週の実施メニュー' })).toBeVisible()
  await page.getByRole('button', { name: /正規テストプレス/ }).first().click()
  await page.getByRole('button', { name: '種目を完了' }).click()
  await expect.poll(async () => ((await readCanonicalState(page)).sessions as unknown[]).length).toBe(1)
  await page.reload()
  await expect(page.getByRole('heading', { name: '今週の実施メニュー' })).toBeVisible()
  expect((await readCanonicalState(page)).sessions).toHaveLength(1)
})

test('canonical settings imports a verified MenuProposal without changing the active menu', async ({ page }) => {
  await page.clock.install({ time: monday })
  await seedCanonicalAndReload(page, canonicalData())
  await page.getByRole('button', { name: '共通メニュー' }).click()
  await page.getByRole('button', { name: '設定' }).click()
  await expect(page.getByRole('heading', { name: '正規データの設定' })).toBeVisible()
  await page.getByRole('button', { name: 'メニュー投入' }).click()
  await page.getByLabel('提案ファイルを選択').setInputFiles({
    name: 'proposal.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({
      contractVersion: '1.0', proposalId: 'e2e-proposal-1', menu: { name: 'E2E投入メニュー' },
      entries: [{ trainingItemId: 'canonical-item', recommendedDay: 1, order: 0 }],
    })),
  })
  await expect(page.getByRole('heading', { name: '内容確認' })).toBeVisible()
  page.on('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: '新しい週メニューを作成' }).click()
  await expect(page.getByRole('heading', { name: 'メニューを作成しました' })).toBeVisible()
  await expect(page.getByText('E2E投入メニュー', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '週メニューで内容を確認' }).click()
  await expect(page.getByRole('heading', { name: '正規データの設定' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'E2E投入メニュー' })).toBeVisible()
  const stored = await readCanonicalState(page)
  expect((stored.menus as Array<{ name: string }>).some(menu => menu.name === 'E2E投入メニュー')).toBe(true)
  expect(stored.activeMenuId).toBe('canonical-menu')
  expect(stored.appliedProposalIds).toEqual(['e2e-proposal-1'])
})

test('explicit cutover adopts only the confirmed Profile candidate and does not copy legacy master data', async ({ page }) => {
  await page.clock.install({ time: monday })
  const legacy = { ...seedData(0), profile: { ...seedData(0).profile, height: 170, age: 40, sex: 'male' } }
  await seedAndReload(page, legacy)
  await page.getByRole('button', { name: '共通メニュー' }).click()
  await page.getByRole('button', { name: '設定' }).click()
  await page.getByRole('button', { name: 'データ管理' }).click()
  await page.getByRole('button', { name: '正規データへの切替を準備' }).click()
  await expect(page.getByText('体重: 66 kg')).toBeVisible()
  await expect(page.getByText('身長: 170 cm')).toBeVisible()
  await expect(page.getByText('年齢: 40')).toBeVisible()
  await expect(page.getByText('性別: male')).toBeVisible()
  await expect(page.getByRole('button', { name: '正規データへ切替' })).toBeDisabled()
  await page.getByRole('button', { name: '切替準備を確認' }).click()
  await expect(page.getByText('baseline / Recovery準備: 確認済み')).toBeVisible()
  await page.getByLabel('表示したProfile候補を採用する').check()
  await page.getByLabel('切替後は正規データが正本であり、旧データへ自動復帰しないことを確認した').check()
  page.on('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: '正規データへ切替' }).click()
  await expect(page.getByRole('heading', { name: '今週の実施メニュー' })).toBeVisible()
  const canonical = await readCanonicalState(page)
  expect(canonical.profile).toMatchObject({ weight: 66, height: 170, age: 40, sex: 'male' })
  expect(canonical.exercises).toEqual([])
  expect(canonical.trainingItems).toEqual([])
  expect(canonical.menus).toEqual([])
  expect((await readStoredState(page)).exercises).toHaveLength(1)
})
