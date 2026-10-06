import { base, canonicalStorage, getRecoveryPoint, loadData } from '../../src/data'
import { prepare, type PreparationPurpose } from './prepare'

const status = document.getElementById('status')!
const token = location.hash.slice(1)
history.replaceState(null, '', location.pathname)
let boundGate: { run: string; purpose: PreparationPurpose } | undefined
const authorize = async () => {
  const response = await fetch('/__staging/authorize', { method: 'POST', cache: 'no-store', headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) throw Error('Gate closed')
  const gate = await response.json() as { run: string; purpose?: PreparationPurpose }
  const purpose = gate.purpose ?? 'fresh'
  if (!gate.run || (purpose !== 'fresh' && purpose !== 'h14-recovery')) throw Error('Invalid gate')
  if (boundGate && (boundGate.run !== gate.run || boundGate.purpose !== purpose)) throw Error('Run changed')
  boundGate = { run: gate.run, purpose }
  return boundGate
}
const legacySource = async () => {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('training-check')
    request.onupgradeneeded = () => { request.transaction?.abort(); reject(new Error('Missing database')) }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('Read failed'))
  })
  try {
    if (!db.objectStoreNames.contains('state')) throw Error('Missing legacy store')
    return await new Promise<unknown>((resolve, reject) => {
      const request = db.transaction('state', 'readonly').objectStore('state').get('app')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(new Error('Read failed'))
    })
  } finally { db.close() }
}
async function run() {
  if (!navigator.locks) throw Error('Lock unavailable')
  await navigator.locks.request('v1r-staging-preparation', { ifAvailable: true }, async lock => {
    if (!lock) throw Error('Concurrent preparation')
    const storage = { ...canonicalStorage }
    for (const key of ['writeBaseline', 'writeCutoverState', 'writeCanonical'] as const) {
      const write = canonicalStorage[key].bind(canonicalStorage) as (value: unknown) => Promise<void>
      // Even an already-loaded/cached tool must re-check the server before each write.
      storage[key] = async (value: never) => { await authorize(); await write(value) }
    }
    const result = await prepare({ storage, base, load: loadData, recovery: getRecoveryPoint,
      authorize, legacySource, newId: () => crypto.randomUUID(), now: () => new Date().toISOString(),
      journal: {
        read: () => JSON.parse(localStorage.getItem('v1r-staging-receipt') ?? 'null'),
        write: receipt => localStorage.setItem('v1r-staging-receipt', JSON.stringify(receipt)),
      },
    })
    status.textContent = result.status
    if (result.status === 'PREPARED') {
      const receipt = JSON.parse(localStorage.getItem('v1r-staging-receipt') ?? 'null')
      document.getElementById('attempt')!.textContent = `${receipt.run} / ${receipt.ids[0].slice(0, 8)}`
    }
  })
}
run().catch(() => { status.textContent = 'STOP' })
