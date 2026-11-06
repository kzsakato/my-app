import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { chromium } from '@playwright/test'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'

const [primary, secondary, out] = process.argv.slice(2).map(path => resolve(path))
const parentFirst = process.argv.includes('--parent-first')
await mkdir(out, { recursive: true })
const prefix = '/v13-test/'
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json' }
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname
  const child = path.startsWith(prefix)
  const root = child ? secondary : primary
  const file = resolve(root, (child ? path.slice(prefix.length) : path.slice(1)) || 'index.html')
  try {
    if (!file.startsWith(root + sep)) throw new Error('path')
    const body = await readFile(file)
    response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' }).end(body)
  } catch { response.writeHead(404).end() }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch()
try {
  const context = await browser.newContext({ viewport: { width: 360, height: 800 }, timezoneId: 'Asia/Tokyo', acceptDownloads: true })
  const root = await context.newPage()
  const openRoot = async () => {
    await root.goto(origin)
    await root.evaluate(() => navigator.serviceWorker.ready.then(() => true))
    await root.reload()
  }
  if (parentFirst) await openRoot()
  const child = await context.newPage()
  await child.clock.setFixedTime(new Date('2026-11-06T12:00:00+09:00'))
  const navigation = await child.goto(origin + prefix)
  if (parentFirst && !(await navigation.text()).includes('/v13-test/assets/')) {
    console.log(JSON.stringify({
      result: 'FAIL_PARENT_FALLBACK', chromium: browser.version(), url: child.url(),
      navigationFromServiceWorker: navigation.fromServiceWorker(),
      controller: await child.evaluate(() => navigator.serviceWorker.controller?.scriptURL),
      databases: await child.evaluate(() => indexedDB.databases()),
    }, null, 2))
    process.exitCode = 1
  } else {
  await child.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.endsWith('/v13-test/v13-worker.js'))
  await child.waitForFunction(async () => (await indexedDB.databases()).some(db => db.name === 'training-check-v13-test'))
  if (!parentFirst) await openRoot()
  const rootSnapshot = () => root.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('training-check', 7)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      const names = [...db.objectStoreNames]
      const tx = db.transaction(names)
      const read = request => new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      return await Promise.all(names.map(async name => [name, await read(tx.objectStore(name).getAllKeys()), await read(tx.objectStore(name).getAll())]))
    } finally { db.close() }
  })
  const readSecondary = () => child.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('training-check-v13-test', 7)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      const tx = db.transaction(['canonical', 'cutover'])
      const read = (store, key) => new Promise((resolve, reject) => {
        const request = tx.objectStore(store).get(key)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      return await Promise.all([read('canonical', 'app'), read('cutover', 'state')])
    } finally { db.close() }
  })
  const rootBefore = await rootSnapshot()
  const backupPath = 'evidence/issue35-v13/synthetic-initial-backup.json'
  const backup = JSON.parse(await readFile(backupPath, 'utf8'))
  const oldBackup = structuredClone(backup)
  oldBackup.schemaVersion = 1
  await child.getByLabel('正規バックアップを選択').setInputFiles({
    name: 'outer1.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(oldBackup)),
  })
  await child.getByText('Error: V13_BACKUP_VERSION_REQUIRED', { exact: true }).waitFor()
  assert.deepEqual(await readSecondary(), [undefined, undefined])
  await child.getByLabel('正規バックアップを選択').setInputFiles(backupPath)
  await child.getByRole('heading', { name: '復元内容の確認' }).waitFor()
  await child.getByRole('button', { name: '復元する' }).click()
  await child.getByRole('heading', { name: '今週の実施メニュー' }).waitFor()
  const [restored, marker] = await readSecondary()
  assert.deepEqual(restored, backup.payload)
  assert.ok(marker.v13InitialRestore)
  assert.equal(marker.v13Pending, undefined)
  const settings = async () => {
    await child.getByRole('button', { name: '共通メニュー' }).click()
    await child.getByRole('button', { name: '設定', exact: true }).click()
  }
  await settings()
  await child.getByRole('button', { name: /^トレーナー連携/ }).click()
  const proposal = 'evidence/issue35-v13/synthetic-initial-proposal.json'
  await child.getByLabel('提案ファイルを選ぶ').setInputFiles(proposal)
  await child.getByText('初回寄与率を登録しました。', { exact: true }).waitFor()
  const applied = await readSecondary()
  const expected = structuredClone(backup.payload)
  const parsed = JSON.parse(await readFile(proposal, 'utf8'))
  expected.trainerDataRevision = 1
  expected.appliedProposalIds.push(parsed.proposalId)
  for (const operation of parsed.operations) expected.contributions.byExerciseId[operation.exerciseId] = { rates: operation.rates, revision: 1 }
  assert.deepEqual(applied, [expected, marker])
  await child.getByLabel('提案ファイルを選ぶ').setInputFiles(proposal)
  await child.getByRole('button', { name: '診断情報を保存' }).waitFor()
  assert.deepEqual(await readSecondary(), applied)
  const badBatch = {
    ...parsed, proposalId: 'synthetic-invalid-batch', baseRevision: 1,
    operations: [{ ...parsed.operations[0], exerciseId: 'ex-C' }, parsed.operations[1]],
  }
  await child.getByLabel('提案ファイルを選ぶ').setInputFiles({
    name: 'bad-batch.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(badBatch)),
  })
  await child.getByRole('button', { name: '診断情報を保存' }).waitFor()
  assert.deepEqual(await readSecondary(), applied)
  const download = child.waitForEvent('download')
  await child.getByRole('button', { name: 'トレーナー用ファイルを作る' }).click()
  await (await download).saveAs(resolve(out, 'synthetic-context-v2.json'))
  const bytes = await readFile(resolve(out, 'synthetic-context-v2.json'))
  const contextValue = JSON.parse(bytes.toString('utf8'))
  assert.equal(contextValue.version, 2)
  assert.equal(contextValue.trainingContext.trainerDataRevision, 1)
  assert.deepEqual(contextValue.history.map(value => value.id), ['S-A1', 'S-B1', 'S-C1', 'S-A0'])
  const trainer = contextValue.trainingContext
  const order = (items, key = 'id') => [...items].sort((a, b) => a[key].localeCompare(b[key]))
  const indexA = {
    format: 'training-project.trainer-index-a', version: 1, generatedAt: '2026-11-06T12:00:00+09:00',
    source: {
      format: contextValue.format, version: contextValue.version, contractVersion: trainer.contractVersion,
      exportedLocalDate: contextValue.exportedLocalDate, fromDate: contextValue.fromDate, toDate: contextValue.toDate,
      sourceSha256: createHash('sha256').update(bytes).digest('hex'),
    },
    exercises: order(trainer.exercises), trainingItems: order(trainer.trainingItems), menus: order(trainer.menus),
    menuEntries: order(trainer.menuEntries), contributionStates: order(trainer.contributionStates, 'exerciseId'),
    ...(trainer.activeMenuId === undefined ? {} : { activeMenuId: trainer.activeMenuId }),
    executionPresence: order(trainer.trainingItems).map(item => {
      const last = contextValue.history.filter(session => session.trainingItemId === item.id).map(session => session.date).sort().at(-1) ?? null
      return { trainingItemId: item.id, hasSessionInWindow: last !== null, lastSessionDateInWindow: last }
    }),
  }
  assert.deepEqual(indexA.executionPresence.map(item => item.lastSessionDateInWindow), ['2026-11-02', '2026-11-03', '2026-11-04', null])
  await writeFile(resolve(out, 'synthetic-index-a.json'), JSON.stringify(indexA, null, 2) + '\n')
  await settings()
  await child.getByRole('button', { name: /^分析/ }).click()
  await child.getByRole('heading', { name: '種目別内訳' }).waitFor()
  assert.equal(await child.locator('svg polyline').count(), 7)
  const plot = await child.locator('svg polyline').evaluateAll(lines => Object.fromEntries(lines.map(line => [line.dataset.series, JSON.parse(line.dataset.values)])))
  assert.deepEqual(plot.pt, [...Array(10).fill(0), 36, 530])
  assert.deepEqual(Object.values(plot).slice(1).map(series => series.slice(-2)), [[0.5, 1], [0, 2], [0, 0], [0.5, 1], [0, 2], [0, 0]])
  assert.equal(await child.getByText('未配賦 3', { exact: true }).count(), 1)
  await writeFile(resolve(out, 'analysis-plot.json'), JSON.stringify(plot, null, 2) + '\n')
  await child.screenshot({ path: resolve(out, 'analysis-ax01-360.png'), fullPage: true })
  await settings()
  await child.getByRole('button', { name: /^トレーナー連携/ }).click()
  const registerC = {
    ...parsed, proposalId: 'synthetic-ax01b', baseRevision: 1,
    operations: [{ ...parsed.operations[0], exerciseId: 'ex-C', rates: { chest: 0, back: 0, arms: 100, shoulders: 0, lowerBody: 0, core: 0 } }],
  }
  await child.getByLabel('提案ファイルを選ぶ').setInputFiles({
    name: 'ax01b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(registerC)),
  })
  await child.getByText('初回寄与率を登録しました。', { exact: true }).waitFor()
  const [afterC] = await readSecondary()
  assert.deepEqual(afterC.sessions, backup.payload.sessions)
  await settings()
  await child.getByRole('button', { name: /^分析/ }).click()
  await child.getByLabel('部位', { exact: true }).selectOption('2')
  assert.equal(await child.getByText('未配賦 3', { exact: true }).count(), 0)
  const afterPlot = await child.locator('svg polyline').evaluateAll(lines => Object.fromEntries(lines.map(line => [line.dataset.series, JSON.parse(line.dataset.values)])))
  assert.deepEqual(afterPlot.pt, plot.pt)
  assert.deepEqual(afterPlot['腕'].slice(-2), [0, 3])
  assert.equal(await child.locator('[data-exercise-id="ex-C"] meter').getAttribute('value'), '3')
  await writeFile(resolve(out, 'analysis-plot-after.json'), JSON.stringify(afterPlot, null, 2) + '\n')
  await child.screenshot({ path: resolve(out, 'analysis-ax01b-360.png'), fullPage: true })

  assert.deepEqual(await rootSnapshot(), rootBefore)
  const evidence = await child.evaluate(async () => ({
    dbs: await indexedDB.databases(),
    caches: await caches.keys(),
    registrations: (await navigator.serviceWorker.getRegistrations()).map(reg => [reg.scope, reg.active?.scriptURL]),
    controller: navigator.serviceWorker.controller?.scriptURL,
    manifest: await fetch(document.querySelector('link[rel="manifest"]').href).then(response => response.json()),
  }))
  assert.deepEqual(evidence.dbs.map(db => db.name).sort(), ['training-check', 'training-check-v13-test'])
  assert.equal(evidence.manifest.start_url, prefix)
  assert.equal(evidence.manifest.scope, prefix)
  assert.equal(evidence.controller, origin + prefix + 'v13-worker.js')
  assert.equal(await root.evaluate(() => navigator.serviceWorker.controller?.scriptURL), origin + '/sw.js')
  assert.equal(evidence.caches.filter(key => key.includes('training-check-v13-test')).length, 1)
  await context.setOffline(true)
  await child.reload()
  await child.waitForFunction(() => document.querySelector('main'))
  console.log(JSON.stringify({ result: 'PASS_CHILD_FIRST_LIMITED', chromium: browser.version(), origin, rootCanonicalAndOtherStoresUnchanged: true, exactRestoreReadback: true, exactProposalReadback: true, replayAndInvalidBatchUnchanged: true, ...evidence }, null, 2))
  }
} finally {
  await browser.close()
  server.close()
}
