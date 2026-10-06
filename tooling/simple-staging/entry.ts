import { validateCanonical } from '../../src/canonical/validate'
import type { CanonicalAppData } from '../../src/canonical/types'

declare const STAGING_ORIGIN: string
declare const FIXTURE: CanonicalAppData
declare const FIXTURE_ID: string
declare const FIXTURE_AT: string
const stores = ['baseline', 'canonical', 'cutover', 'recovery', 'state']
const markerKey = 'simple-staging-fixture'
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const request = <T>(r: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error)
})

async function provision() {
  // Guard before any DB discovery/open. This code is not part of Product dist.
  if (location.origin !== STAGING_ORIGIN || location.pathname !== '/' || window.top !== window.self) throw Error('Origin')
  if (validateCanonical(FIXTURE).errors.length) throw Error('Fixture')
  const databases = await indexedDB.databases()
  const existing = databases.find(db => db.name === 'training-check')
  if (databases.some(db => db.name !== 'training-check') || (existing && existing.version !== 7)) throw Error('Unexpected database')
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    let blocked = false
    const r = indexedDB.open('training-check', 7)
    r.onupgradeneeded = event => {
      if (event.oldVersion !== 0) { r.transaction?.abort(); return }
      for (const name of stores) r.result.createObjectStore(name)
    }
    r.onsuccess = () => { if (blocked) r.result.close(); else resolve(r.result) }; r.onerror = () => reject(r.error)
    r.onblocked = () => { blocked = true; reject(Error('Database blocked')) }
  })
  try {
    if (!same([...db.objectStoreNames], stores)) throw Error('Unexpected stores')
    const tx = db.transaction(stores, 'readwrite')
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve(); tx.onabort = () => reject(Error('Transaction aborted'))
    })
    void done.catch(() => {})
    let fresh = false
    try {
      const counts = await Promise.all(stores.map(name => request(tx.objectStore(name).count())))
      fresh = counts.every(count => count === 0)
      if (fresh) {
        if (localStorage.length || sessionStorage.length) throw Error('Unexpected web storage')
        tx.objectStore('canonical').put(FIXTURE, 'app')
        tx.objectStore('cutover').put({ authoritative: true, establishedAt: FIXTURE_AT }, 'state')
        tx.objectStore('cutover').put(FIXTURE_ID, markerKey)
      } else {
        if (!same(counts, [0, 1, 2, 0, 0])) throw Error('Unexpected records')
        const [data, state, marker] = await Promise.all([
          request(tx.objectStore('canonical').get('app')),
          request(tx.objectStore('cutover').get('state')),
          request(tx.objectStore('cutover').get(markerKey)),
        ])
        if (marker !== FIXTURE_ID || !same(state, { authoritative: true, establishedAt: FIXTURE_AT }) || validateCanonical(data).errors.length) throw Error('Unexpected state')
        // Valid MAN changes are deliberately preserved; no fixture rewrite.
      }
      await done
    } catch (error) { try { tx.abort() } catch {} await done.catch(() => {}); throw error }
    const read = db.transaction(['canonical', 'cutover'], 'readonly')
    const [data, state, marker] = await Promise.all([
      request(read.objectStore('canonical').get('app')),
      request(read.objectStore('cutover').get('state')),
      request(read.objectStore('cutover').get(markerKey)),
    ])
    if (marker !== FIXTURE_ID || !same(state, { authoritative: true, establishedAt: FIXTURE_AT }) || validateCanonical(data).errors.length || (fresh && !same(data, FIXTURE))) throw Error('Read-back')
  } finally { db.close() }
  location.replace('/app/')
}
provision().catch(() => { document.getElementById('status')!.textContent = 'STOP：この環境ではテストを開始できません。操作せず、この表示を報告してください。' })
