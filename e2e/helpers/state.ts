import type { Page } from '@playwright/test'

export type LegacyAppData = {
  version: 6
  activeMenuId: string
  profile: { weight: number; analysisStartDate: string }
  exercises: Array<Record<string, unknown>>
  categories: Array<Record<string, unknown>>
  items: Array<Record<string, unknown>>
  menus: Array<Record<string, unknown>>
  menuItems: Array<Record<string, unknown>>
  sessions: Array<Record<string, unknown>>
  settingHistories: Array<Record<string, unknown>>
}

/** A minimal valid v6 state for exercising the current production UI. */
export function seedData(recommendedDay = 0): LegacyAppData {
  return {
    version: 6,
    activeMenuId: 'menu-e2e',
    profile: { weight: 66, analysisStartDate: '2026-09-22' },
    exercises: [{ id: 'exercise-e2e', name: 'テストプレス', bodyPart: '胸', measureType: 'reps', usesWeight: true, weightMode: 'total', selfWeightRatio: 0, secondsLoadRatio: 0 }],
    categories: [{ id: 'category-e2e', name: '胸', bodyParts: ['胸'], exerciseIds: ['exercise-e2e'] }],
    items: [{ id: 'item-e2e', name: 'テストプレス', categoryId: 'category-e2e', exerciseId: 'exercise-e2e', weight: 20, reps: 10, sets: 3 }],
    menus: [{ id: 'menu-e2e', name: 'E2Eメニュー' }],
    menuItems: [{ id: 'entry-e2e', menuId: 'menu-e2e', itemId: 'item-e2e', recommendedDay }],
    sessions: [],
    settingHistories: [],
  }
}

async function openDatabase(page: Page, operation: 'seed' | 'read', value?: LegacyAppData): Promise<unknown> {
  return page.evaluate(async ({ operation, value }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('training-check', 6)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('state')) request.result.createObjectStore('state')
        if (!request.result.objectStoreNames.contains('recovery')) request.result.createObjectStore('recovery')
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const transaction = db.transaction('state', operation === 'seed' ? 'readwrite' : 'readonly')
    const store = transaction.objectStore('state')
    const result = await new Promise<unknown>((resolve, reject) => {
      const request = operation === 'seed' ? store.put(value, 'app') : store.get('app')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onabort = () => reject(transaction.error)
      transaction.onerror = () => reject(transaction.error)
    })
    db.close()
    return result
  }, { operation, value })
}

/** Opens the app once, writes a deterministic test state through IndexedDB, then reloads it. */
export async function seedAndReload(page: Page, value: LegacyAppData): Promise<void> {
  await page.goto('/')
  await openDatabase(page, 'seed', value)
  await page.reload()
}

export async function readStoredState(page: Page): Promise<LegacyAppData> {
  return openDatabase(page, 'read') as Promise<LegacyAppData>
}
