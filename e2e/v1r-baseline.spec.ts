import { test, expect, type Page } from '@playwright/test'
import { seedData, seedAndReload } from './helpers/state'
import { mkdir, writeFile } from 'node:fs/promises'

// Initial authoring checkpoint: pinned add343ae; no product changes.
// Meaning authority: Owner designation + SCREEN_SPEC + Step5 freeze.
test('capture pinned full screen/task population before V1R product edits', async ({ page }, info) => {
  await page.clock.install({ time: new Date('2026-10-03T12:00:00+09:00') })
  const seed = seedData(5)
  seed.settingHistories = [{ id: 'history-e2e', itemId: 'item-e2e', date: '2026-10-02', weight: 20, reps: 10, sets: 3, seat: '2', memo1: '標準メモ' }]
  await seedAndReload(page, seed)
  const root = 'evidence/v1r-baseline'
  await mkdir(root, { recursive: true })
  const inventory: unknown[] = []
  const capture = async (id: string, image = true) => {
    await page.evaluate(async () => { await document.fonts.ready })
    inventory.push({ id, semantics: await page.locator('main, .page-frame').first().innerText(), controls: await page.locator('button,input,select').evaluateAll(nodes => nodes.map(n => ({ tag: n.tagName, text: n.textContent, label: n.getAttribute('aria-label'), type: n.getAttribute('type') }))) })
    if (image) await page.screenshot({ path: `${root}/${id}.png`, fullPage: true, animations: 'disabled' })
  }
  const settings = async () => { await page.getByRole('button', { name: '共通メニュー', exact: true }).click(); await page.getByRole('button', { name: '設定', exact: true }).click() }
  const open = async (name: string) => { await settings(); await page.getByRole('button', { name: new RegExp(`^${name}`) }).click() }
  await capture('top-category')
  await page.getByRole('button', { name: /^胸/ }).click()
  await capture('cat')
  await page.getByRole('button', { name: /テストプレス/ }).click()
  await page.getByRole('button', { name: '戻る', exact: true }).click()
  await expect(page.getByRole('heading', { name: '胸', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '戻る', exact: true }).click()
  await page.getByRole('button', { name: '推奨曜日', exact: true }).click()
  await capture('top-recommended-off')
  await page.getByLabel('実施済も表示').check()
  await capture('top-recommended-on')
  await page.getByRole('button', { name: /テストプレス/ }).click()
  await capture('run-active')
  await page.getByRole('button', { name: /設定履歴を見る/ }).click()
  await capture('history-from-run', false)
  await settings(); await expect(page.getByLabel('ビルド識別子')).toBeVisible(); await capture('settings')
  for (const [name, id] of [['プロフィール','profile'],['分析','analysis'],['データ管理','data'],['設定履歴','settingHistory'],['種目','exercise'],['カテゴリ','category'],['実施項目','item'],['週メニュー','menu']]) {
    await open(name); await capture(id, ['settingHistory'].includes(id))
    if (id === 'settingHistory') {
      await page.getByLabel('カテゴリ').selectOption('category-e2e')
      await page.getByLabel('実施項目').selectOption('item-e2e')
      await page.getByRole('button', { name: '設定履歴を見る', exact: true }).click()
      await capture('history-from-settings')
    }
    if (['exercise','category','item','menu'].includes(id)) {
      await page.getByRole('button', { name: id === 'category' ? /^胸/ : id === 'menu' ? /^E2Eメニュー/ : /^テストプレス/ }).click()
      await capture(`${id}Edit`)
    }
  }
  await writeFile(`${root}/manifest.json`, JSON.stringify({ source: 'add343ae60a5a38e72426a90861da5501eef5bac', browser: page.context().browser()?.version(), viewport: page.viewportSize(), deviceScaleFactor: 1, timezone: 'Asia/Tokyo', locale: 'ja-JP', clock: '2026-10-03T12:00:00+09:00', inventory }, null, 2))
})
