import { validateCanonical } from '../../src/canonical/validate'

type Summary = { authority: 'absent' | boolean; canonical: 'missing' | 'valid' | 'invalid'; legacyPresent: boolean; legacyVersion: number | null; classification: string }

async function storageSummary(): Promise<Summary> {
  // Enumeration avoids opening (and thereby creating) an absent database.
  if (typeof indexedDB.databases !== 'function') throw new Error('enumeration unavailable')
  const databases = await indexedDB.databases()
  const empty: Summary = { authority: 'absent', canonical: 'missing', legacyPresent: false, legacyVersion: null, classification: 'legacy-active' }
  if (!databases.some(database => database.name === 'training-check')) return empty
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('training-check')
    // The database may disappear between enumeration and open. Never create it.
    request.onupgradeneeded = () => { request.transaction?.abort(); reject(new Error('database changed')) }
    request.onblocked = () => reject(new Error('blocked'))
    request.onerror = () => reject(new Error('open failed'))
    request.onsuccess = () => resolve(request.result)
  })
  try {
    const stores = ['cutover', 'canonical', 'state'].filter(name => db.objectStoreNames.contains(name))
    if (!stores.length) return empty
    const tx = db.transaction(stores, 'readonly')
    const complete = new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(new Error('read failed')) })
    const read = (store: string, key: string) => !stores.includes(store) ? Promise.resolve(undefined) : new Promise<any>((resolve, reject) => {
      const request = tx.objectStore(store).get(key)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(new Error('read failed'))
    })
    const [marker, canonical, legacy] = await Promise.all([read('cutover', 'state'), read('canonical', 'app'), read('state', 'app')])
    await complete
    if (marker !== undefined && (marker === null || typeof marker.authoritative !== 'boolean')) throw new Error('invalid authority')
    const authority = marker === undefined ? 'absent' : marker.authoritative as boolean
    const validation = canonical === undefined || canonical === null ? 'missing' : validateCanonical(canonical).errors.length ? 'invalid' : 'valid'
    return { authority, canonical: validation, legacyPresent: legacy !== undefined && legacy !== null,
      legacyVersion: Number.isSafeInteger(legacy?.version) ? legacy.version : null,
      classification: authority !== true ? 'legacy-active' : validation === 'valid' ? 'canonical-ready' : 'canonical-recovery-required' }
  } finally { db.close() }
}

async function diagnose() {
  const result: Record<string, unknown> = { diagnostic: 'H14 temporary read-only v1', timestamp: new Date().toISOString(), origin: location.origin,
    productUI: 'not inspected; compare with the screen seen immediately before this page',
    servedProduct: { build: '2026-10-06 / 118ff493', mainAsset: '/assets/index-ddSmqDMp.js', sha256: '648426d684a96d70f1c3993073a4f29ca7e081a0ef68bcb9cc5576a420f209ff', source: 'fixed Worker artifact declaration, not previously executing Product JS' } }
  try {
    result.storage = await storageSummary()
    result.serviceWorker = { controller: navigator.serviceWorker.controller?.scriptURL ?? null,
      registrations: (await navigator.serviceWorker.getRegistrations()).map(registration => ({ scope: registration.scope, activeScript: registration.active?.scriptURL ?? null, activeState: registration.active?.state ?? null })) }
  } catch { result.classification = 'READ ERROR / STOP' }
  // No raw errors, validator issues or payload can reach DOM, console or network.
  document.getElementById('result')!.textContent = JSON.stringify(result, null, 2)
  document.getElementById('status')!.textContent = result.classification === 'READ ERROR / STOP' ? 'READ ERROR / STOP' : '診断完了（変更なし）'
}
void diagnose()
