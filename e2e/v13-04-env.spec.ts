import { expect, test } from '@playwright/test'

const fixturePath = '/e2e/fixtures/v13-04/'

test('V13-04 synthetic browser capability probe', async ({ page, browser }) => {
  console.log(`Node ${process.version}; ${process.platform}/${process.arch}; Chromium ${browser.version()}`)

  await test.step('Local HTTP page executes JavaScript', async () => {
    const response = await page.goto(fixturePath + 'index.html')
    expect(response?.status()).toBe(200)
    await expect(page.locator('#probe')).toHaveText('42')
    expect(await page.evaluate(() => isSecureContext)).toBe(true)
  })

  await test.step('IndexedDB commits and reads back in a separate transaction', async () => {
    const result = await page.evaluate(async () => {
      const name = 'v13-04-synthetic-probe'
      function complete<T>(request: IDBRequest<T>): Promise<T> {
        return new Promise((resolve, reject) => {
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
      }

      const open = indexedDB.open(name, 1)
      open.onupgradeneeded = () => open.result.createObjectStore('probe')
      const db = await complete(open)
      try {
        const write = db.transaction('probe', 'readwrite')
        await new Promise<void>((resolve, reject) => {
          write.oncomplete = () => resolve()
          write.onabort = () => reject(write.error)
          write.objectStore('probe').put('synthetic-idb-value', 'key')
        })
        const read = db.transaction('probe', 'readonly')
        return await complete(read.objectStore('probe').get('key'))
      } finally {
        db.close()
        await complete(indexedDB.deleteDatabase(name))
      }
    })
    expect(result).toBe('synthetic-idb-value')
  })

  await test.step('Service Worker reports active state and scope', async () => {
    await page.evaluate(() => navigator.serviceWorker.register('./sw.js'))
    try {
      const registration = await page.evaluate(async () => {
        const ready = await navigator.serviceWorker.ready
        return { scope: ready.scope, state: ready.active?.state, scriptURL: ready.active?.scriptURL }
      })
      expect(registration).toEqual({
        scope: new URL(fixturePath, page.url()).href,
        state: 'activated',
        scriptURL: new URL('sw.js', page.url()).href,
      })
    } finally {
      expect(await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration()
        return registration?.unregister()
      })).toBe(true)
    }
  })

  await test.step('Cache Storage writes, reads and deletes a synthetic entry', async () => {
    const result = await page.evaluate(async () => {
      const name = 'v13-04-synthetic-probe'
      const key = new URL('./synthetic-cache-key', location.href).href
      const cache = await caches.open(name)
      let value
      let removed
      try {
        await cache.put(key, new Response('synthetic-cache-value'))
        value = await (await cache.match(key))?.text()
      } finally {
        removed = await caches.delete(name)
      }
      return { value, removed, exists: await caches.has(name) }
    })
    expect(result).toEqual({ value: 'synthetic-cache-value', removed: true, exists: false })
  })
})
