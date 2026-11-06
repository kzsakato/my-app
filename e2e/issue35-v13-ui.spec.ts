import { canonicalFixture } from '../src/canonical/fixtures'
import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 360, height: 800 } })

async function seed(page: Page) {
  await page.clock.setFixedTime(new Date('2026-09-24T12:00:00+09:00'))
  await page.goto('/')
  await page.evaluate(async data => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('training-check', 7)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['canonical', 'cutover'], 'readwrite')
      tx.objectStore('canonical').put(data, 'app')
      tx.objectStore('cutover').put({ authoritative: true, establishedAt: '2026-09-24T00:00:00+09:00' }, 'state')
      tx.oncomplete = () => resolve()
      tx.onabort = () => reject(tx.error)
    })
    db.close()
  }, canonicalFixture)
  await page.reload()
  await expect(page.getByRole('heading', { name: '今週の実施メニュー' })).toBeVisible()
}

test('UI-01 and UI-02: independent sort drafts and fixed settings description', async ({ page }) => {
  await seed(page)
  await page.getByRole('button', { name: '共通メニュー' }).click()
  await page.getByRole('button', { name: '設定', exact: true }).click()
  const display = page.getByRole('button', { name: /^表示設定/ })
  await expect(display.locator('small')).toHaveText('ソート順など、画面表示に関する設定')
  await display.locator('small').click()
  const defaultSort = page.getByRole('region', { name: 'Default', exact: true })
  const optionSort = page.getByRole('region', { name: 'Option', exact: true })
  const rows = defaultSort.locator('.sort-priority-row')
  const labels = rows.locator('span:first-child')
  const original = await labels.allTextContents()
  const option = optionSort.locator('.sort-priority-row span:first-child')
  const originalOption = await option.allTextContents()
  expect(original).toHaveLength(3)
  const handle = rows.last().locator('.sort-drag-handle')
  const destination = rows.first().locator('.sort-drag-handle')
  const drag = async () => {
    const source = await handle.boundingBox()
    const target = await destination.boundingBox()
    await page.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2)
    await page.mouse.down()
    await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 2, { steps: 8 })
    await page.mouse.up()
  }
  await drag()
  const reordered = [original[2], original[0], original[1]].map((text, i) => text.replace(/^\d/, String(i + 1)))
  await expect(labels).toHaveText(reordered)
  await expect(option).toHaveText(originalOption)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(360)
  await page.getByRole('button', { name: /戻る/ }).click()
  await display.click()
  await expect(labels).toHaveText(original)
  await drag()
  await page.getByRole('button', { name: '設定を保存' }).click()
  await display.click()
  await expect(labels).toHaveText(reordered)
  await expect(option).toHaveText(originalOption)
})

test('UI-04: removes the decorative glyph while preserving history and Run entry', async ({ page }) => {
  await seed(page)
  await page.getByRole('button', { name: '＋ 追加トレーニングを登録' }).click()
  const row = page.locator('[data-training-item-id="item-1"] > button')
  await expect(row).not.toContainText('›')
  await expect(row.locator('.item-history')).toHaveText(/^(?:[●○]｜?){14}$/)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(360)
  await row.click()
  await expect(page.getByRole('heading', { name: 'ダンベルプレス', exact: true })).toBeVisible()
})
