import { base, canonicalStorage, getRecoveryPoint, loadData } from '../../src/data'
import { prepare } from './prepare'

const status = document.getElementById('status')!
const token = location.hash.slice(1)
history.replaceState(null, '', location.pathname)
const authorize = async () => {
  const response = await fetch('/__staging/authorize', { method: 'POST', cache: 'no-store', headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) throw Error('Gate closed')
  return response.json() as Promise<{ run: string }>
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
      authorize, newId: () => crypto.randomUUID(), now: () => new Date().toISOString(),
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
