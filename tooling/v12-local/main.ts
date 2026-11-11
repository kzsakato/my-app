import { openDB } from 'idb'
import { canonicalFixture } from '../../src/canonical/fixtures'
import { validateCanonical } from '../../src/canonical/validate'

async function boot() {
  if (location.origin !== 'http://localhost:4182' || !isSecureContext) throw new Error('検証用localhost以外では起動しません')
  const db = await openDB('training-check-v12-local-man', 7, { upgrade(db) {
    for (const name of ['state','recovery','canonical','cutover','baseline']) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name)
  } })
  const data = structuredClone(canonicalFixture)
  data.exercises[0].name = 'ダミー胸プレス'
  data.trainingItems[0].displayName = 'ダミー胸プレス'
  data.menus[0].name = 'MANダミーメニュー'
  const today = new Date(), date = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
  data.menuEntries[0].recommendedDay = ((today.getDay()+6)%7) as 0|1|2|3|4|5|6
  data.sessions[0].date = date
  data.sessions[0].performedAt = `${date}T00:00:00+09:00`
  data.sessions[0].snapshot.exerciseName = 'ダミー胸プレス'
  data.sessions[0].snapshot.trainingItemDisplayName = 'ダミー胸プレス'
  if (validateCanonical(data).errors.length) throw new Error('ダミーfixture不正')
  const names = [...db.objectStoreNames]
  const tx = db.transaction(names, 'readwrite')
  const counts = await Promise.all(names.map(n => tx.objectStore(n).count()))
  if (counts.every(n => n === 0)) {
    await tx.objectStore('canonical').put(data, 'app')
    await tx.objectStore('cutover').put({ authoritative: true, establishedAt: new Date().toISOString() }, 'state')
  } else {
    const authority = await tx.objectStore('cutover').get('state')
    const existing = await tx.objectStore('canonical').get('app')
    if (!authority?.authoritative || !existing || validateCanonical(existing).errors.length) {
      tx.abort(); await tx.done.catch(() => {}); db.close(); throw new Error('既存検証DBを変更せず停止しました。再seedしません')
    }
  }
  await tx.done; db.close()
  const banner = document.createElement('p')
  banner.textContent = 'V1.2 MAN候補・ダミー専用：実データ／実Backupを持ち込まないでください'
  document.body.prepend(banner)
  await import('../../src/main')
  await navigator.serviceWorker.register('/sw.js', { scope: '/' })
}
boot().catch(error => { document.getElementById('root')!.textContent = String(error) })
