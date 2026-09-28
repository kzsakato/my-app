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
      const request = indexedDB.open('training-check', 7)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('state')) request.result.createObjectStore('state')
        if (!request.result.objectStoreNames.contains('recovery')) request.result.createObjectStore('recovery')
        if (!request.result.objectStoreNames.contains('canonical')) request.result.createObjectStore('canonical')
        if (!request.result.objectStoreNames.contains('cutover')) request.result.createObjectStore('cutover')
        if (!request.result.objectStoreNames.contains('baseline')) request.result.createObjectStore('baseline')
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
  // Let the initial AppData load and its persistence effect settle before
  // replacing IndexedDB with this test's deterministic state.
  await page.getByRole('heading', { name: '今週の実施メニュー' }).waitFor()
  await page.waitForTimeout(100)
  await openDatabase(page, 'seed', value)
  await page.reload()
}

export async function readStoredState(page: Page): Promise<LegacyAppData> {
  return openDatabase(page, 'read') as Promise<LegacyAppData>
}

export type CanonicalData = Record<string, unknown>

async function canonicalStore(page: Page, operation: 'seed' | 'read', value?: CanonicalData): Promise<unknown> {
  return page.evaluate(async ({ operation, value }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('training-check', 7)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const transaction = db.transaction(['canonical', 'cutover'], operation === 'seed' ? 'readwrite' : 'readonly')
    const canonical = transaction.objectStore('canonical')
    const cutover = transaction.objectStore('cutover')
    if (operation === 'seed') {
      canonical.put(value, 'app')
      cutover.put({ authoritative: true, establishedAt: '2026-09-21T10:00:00+09:00' }, 'state')
    }
    const result = operation === 'read' ? await new Promise<unknown>((resolve, reject) => {
      const request = canonical.get('app')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    }) : value
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error) })
    db.close()
    return result
  }, { operation, value })
}

export function canonicalData(): CanonicalData {
  return {
    schemaVersion: 1, weekStartsOn: 0, activeMenuId: 'canonical-menu', profile: { weight: 66 },
    exercises: [{ id: 'canonical-exercise', lifecycle: 'active', name: '正規テストプレス', measureType: 'reps', usesWeight: true, weightMode: 'total', classifications: [{ kind: 'bodyRegion', label: '胸' }] }],
    trainingItems: [{ id: 'canonical-item', lifecycle: 'active', exerciseId: 'canonical-exercise', displayName: '正規テストプレス', weight: 20, reps: 10, sets: 3 }],
    menus: [{ id: 'canonical-menu', lifecycle: 'active', name: '正規E2Eメニュー' }],
    menuEntries: [{ id: 'canonical-entry-a', lifecycle: 'active', menuId: 'canonical-menu', trainingItemId: 'canonical-item', recommendedDay: 0, order: 0 }, { id: 'canonical-entry-b', lifecycle: 'active', menuId: 'canonical-menu', trainingItemId: 'canonical-item', recommendedDay: 1, order: 1 }],
    sessions: [],
    trainingItemSettingChanges: [{ id: 'canonical-change', trainingItemId: 'canonical-item', changedAt: '2026-09-21T10:00:00+09:00', snapshot: { weight: 20, reps: 10, sets: 3 } }],
  }
}

export async function seedCanonicalAndReload(page: Page, value: CanonicalData): Promise<void> {
  await page.goto('/')
  await page.getByRole('heading', { name: '今週の実施メニュー' }).waitFor()
  await canonicalStore(page, 'seed', value)
  await page.reload()
}

export async function readCanonicalState(page: Page): Promise<CanonicalData> {
  return canonicalStore(page, 'read') as Promise<CanonicalData>
}
