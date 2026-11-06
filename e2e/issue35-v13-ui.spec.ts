import { canonicalFixture } from '../src/canonical/fixtures'
import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 360, height: 800 } })

async function seed(page: Page, fixture = canonicalFixture) {
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
  }, fixture)
  await page.reload()
  await expect(page.getByRole('heading', { name: '今週の実施メニュー' })).toBeVisible()
}

test('UI-01 and UI-02: independent sort drafts and fixed settings description', async ({ page }) => {
  await seed(page)
  await page.getByRole('button', { name: '共通メニュー' }).click()
  await page.getByRole('button', { name: '設定', exact: true }).click()
  const display = page.getByRole('button', { name: /^表示設定/ })
  await expect(display.locator('small')).toHaveText('ソート順など、画面表示に関する設定')
  await display.locator('small').evaluate(node => node.style.fontSize = '24px')
  await expect.poll(() => display.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
  await display.locator('small').click()
  const defaultSort = page.getByRole('region', { name: 'Default', exact: true })
  const optionSort = page.getByRole('region', { name: 'Option', exact: true })
  const rows = defaultSort.locator('.sort-priority-row')
  const labels = rows.locator('span:first-child')
  const original = await labels.allTextContents()
  const option = optionSort.locator('.sort-priority-row span:first-child')
  const originalOption = await option.allTextContents()
  const moveOption = optionSort.getByRole('button', { name: /を上へ/ }).last()
  await moveOption.focus()
  await expect(moveOption).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(option).toHaveText([originalOption[0], originalOption[2].replace(/^3/, '2'), originalOption[1].replace(/^2/, '3')])
  await page.getByRole('button', { name: /戻る/ }).click()
  await display.click()
  await expect(option).toHaveText(originalOption)
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

test('UI-03: cancel preserves Trainer authority, confirmation saves standard and releases it', async ({ page }) => {
  const fixture = structuredClone(canonicalFixture)
  fixture.trainingItems[0].managementMode = 'TRAINER'
  fixture.sessions[0].date = '2026-09-01'
  fixture.sessions[0].performedAt = '2026-09-01T09:00:00+09:00'
  fixture.sessions.push({
    ...structuredClone(fixture.sessions[0]), id: 'session-older',
    date: '2026-08-31', performedAt: '2026-08-31T09:00:00+09:00', memo: '過去の合成メモ',
  })
  await seed(page, fixture)
  await page.locator('.weekday-dropdown-trigger').click()
  await page.getByRole('button', { name: '全ON', exact: true }).click()
  await page.locator('.weekday-dropdown-trigger').click()
  await page.locator('[data-menu-entry-id="entry-1"]').click()
  const save = page.getByRole('button', { name: 'この設定を登録' })
  await page.getByRole('button', { name: '重量を1kg増やす' }).click()
  await page.getByLabel('今回メモ').fill('保存対象外の合成メモ')
  const confirmation = 'この設定を標準設定として登録すると、トレーナー管理を解除します。当回メモは標準設定へ保存しません。登録しますか？'
  const read = () => page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('training-check', 7)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      return await new Promise<typeof canonicalFixture>((resolve, reject) => {
        const request = db.transaction('canonical').objectStore('canonical').get('app')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
    } finally { db.close() }
  })
  const click = async (accept: boolean, expected = confirmation) => {
    const dialog = page.waitForEvent('dialog')
    const action = save.click()
    const prompt = await dialog
    const message = prompt.message()
    if (accept) await prompt.accept()
    else await prompt.dismiss()
    await action
    expect(message).toBe(expected)
  }
  await click(false)
  expect(await read()).toEqual(fixture)
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'canonical' && args[1] === 'app') {
        IDBObjectStore.prototype.put = original
        throw new DOMException('Synthetic pre-commit failure', 'QuotaExceededError')
      }
      return original.apply(this, args)
    }
  })
  await click(true)
  await expect(page.getByText('標準設定を保存できません。入力値を確認してください。')).toBeVisible()
  expect(await read()).toEqual(fixture)
  await click(true)
  await expect.poll(async () => (await read()).trainingItems[0]).toEqual({
    ...fixture.trainingItems[0], managementMode: 'MAN', weight: 19,
  })
  const stored = await read()
  await click(false, 'この設定を標準設定として登録しますか？当回メモは標準設定へ保存しません。')
  expect(await read()).toEqual(stored)
  expect(stored.sessions).toEqual(fixture.sessions)
  expect(stored.trainingItemSettingChanges).toHaveLength(fixture.trainingItemSettingChanges.length + 1)
})
test('UI-01: touch drag reorders only its own section', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173', viewport: { width: 360, height: 620 }, hasTouch: true, isMobile: true, timezoneId: 'Asia/Tokyo' })
  try {
    const page = await context.newPage()
    await seed(page)
    await page.getByRole('button', { name: '共通メニュー' }).tap()
    await page.getByRole('button', { name: '設定', exact: true }).tap()
    await page.getByRole('button', { name: /^表示設定/ }).tap()
    const handles = page.getByRole('region', { name: 'Default', exact: true }).locator('.sort-drag-handle')
    const beforeOption = await page.getByRole('region', { name: 'Option', exact: true }).textContent()
    const coordinates = async (index: number) => {
      const box = await handles.nth(index).boundingBox()
      return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 }
    }
    const cdp = await context.newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [await coordinates(2)] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [await coordinates(0)] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect(handles.first().locator('..').locator('span:first-child')).toHaveText('1 部位')
    expect(await page.getByRole('region', { name: 'Option', exact: true }).textContent()).toBe(beforeOption)
  } finally { await context.close() }
})
