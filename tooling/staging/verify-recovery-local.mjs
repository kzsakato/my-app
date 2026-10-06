// Local workerd + real Chromium only. Never consumes an Owner capability or contacts Staging.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const { unstable_dev } = createRequire(import.meta.url)(path.resolve(process.argv[2]));
const dir = path.dirname(fileURLToPath(import.meta.url));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const token = crypto.randomBytes(32).toString('hex');
const vars = { PREP_RUN: 'H14-local-automation', PREP_PURPOSE: 'h14-recovery', PREP_EXPIRES: new Date(Date.now() + 3600000).toISOString(), PREP_TOKEN_HASH: hash(token) };
const evidence = { result: 'RUNNING', environment: 'local workerd / Chromium isolated automation partitions', checks: [] };
const record = name => { evidence.checks.push(name); console.log(name); };
const legacy = {
  version: 6, activeMenuId: 'legacy-menu', profile: { weight: 91, height: 181, analysisStartDate: '2001-01-01' },
  exercises: [{ id: 'legacy-exercise', name: 'legacy-only exercise', bodyPart: '胸', measureType: 'reps', usesWeight: true }],
  categories: [{ id: 'legacy-category', name: 'legacy-only category', bodyParts: ['胸'], exerciseIds: ['legacy-exercise'] }],
  items: [{ id: 'legacy-item', name: 'legacy-only item', categoryId: 'legacy-category', exerciseId: 'legacy-exercise', sets: 9 }],
  menus: [{ id: 'legacy-menu', name: 'legacy-only menu' }],
  menuItems: [{ id: 'legacy-entry', menuId: 'legacy-menu', itemId: 'legacy-item', recommendedDay: 3 }],
  sessions: [{ id: 'legacy-session', itemId: 'legacy-item', date: '2026-10-01', sets: 7, snapshot: { exerciseId: 'legacy-exercise', exerciseName: 'historical legacy', trainingItemDisplayName: 'historical item', measureType: 'reps' } }],
  settingHistories: [{ id: 'legacy-history', itemId: 'legacy-item', date: '2026-10-01', sets: 8 }],
};
let worker, context, browser;
const start = async (bindings, port = 0) => unstable_dev(path.join(dir, 'worker.ts'), {
  config: path.join(dir, 'wrangler.json'), local: true, ip: '127.0.0.1', port,
  vars: bindings, persist: false, logLevel: 'error',
  experimental: { disableExperimentalWarning: true, disableDevRegistry: true, watch: false },
});
const snapshot = page => page.evaluate(async () => {
  const db = await new Promise((resolve, reject) => { const r = indexedDB.open('training-check'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  const result = {};
  for (const name of [...db.objectStoreNames]) {
    const tx = db.transaction(name), store = tx.objectStore(name);
    const read = r => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const [keys, values] = await Promise.all([read(store.getAllKeys()), read(store.getAll())]);
    result[name] = keys.map((key, i) => [key, values[i]]);
  }
  db.close();
  return { stores: result, receipt: JSON.parse(localStorage.getItem('v1r-staging-receipt') ?? 'null') };
});
const seed = async page => page.evaluate(async value => {
  const db = await new Promise((resolve, reject) => {
    const r = indexedDB.open('training-check', 7);
    r.onupgradeneeded = () => { for (const name of ['state', 'recovery', 'canonical', 'cutover', 'baseline']) r.result.createObjectStore(name); };
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  });
  await new Promise((resolve, reject) => { const tx = db.transaction('state', 'readwrite'); tx.objectStore('state').put(value, 'app'); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
  db.close();
}, legacy);
try {
  worker = await start(vars);
  const port = worker.port, origin = `http://127.0.0.1:${port}`, url = `${origin}/__staging/prepare.html#${token}`;
  const headers = { Origin: origin, Authorization: `Bearer ${token}` };
  const gate = await fetch(`${origin}/__staging/authorize`, { method: 'POST', headers });
  assert.equal(gate.status, 200, 'local server gate');
  assert.deepEqual(await gate.json(), { run: vars.PREP_RUN, purpose: 'h14-recovery' });
  const provenance = JSON.parse(fs.readFileSync(path.join(dir, '.generated/provenance.json')));
  for (const [file, digest] of Object.entries(provenance.hashes)) {
    const response = await fetch(`${origin}/${file}`);
    assert.equal(response.status, 200); assert.equal(hash(Buffer.from(await response.arrayBuffer())), digest);
  }
  record('all-eight-accepted-product-assets-byte-identical');
  const profile = fs.mkdtempSync(path.join(dir, '.generated/h14-recovery-profile-'));
  context = await chromium.launchPersistentContext(profile, { headless: true });
  let page = await context.newPage(); const errors = [], requests = [];
  context.on('request', r => requests.push(r.url())); page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${origin}/__staging/prepare.html`); await seed(page);
  const before = await snapshot(page);
  assert.deepEqual(before.stores.cutover, []); assert.deepEqual(before.stores.canonical, []);
  await page.goto('about:blank'); await page.goto(url); await page.locator('#status').filter({ hasText: /PREPARED|STOP/ }).waitFor();
  assert.equal(await page.locator('#status').innerText(), 'PREPARED', JSON.stringify({ errors, state: await snapshot(page) }));
  const prepared = await snapshot(page), data = prepared.stores.canonical[0][1];
  assert.deepEqual(prepared.stores.state, before.stores.state);
  assert.equal(prepared.stores.baseline[0][1].rawJson, JSON.stringify(legacy));
  assert.equal(prepared.receipt.purpose, 'h14-recovery'); assert.equal(prepared.receipt.phase, 'complete');
  assert.deepEqual(data.profile, { weight: 66 }); assert.equal(data.weekStartsOn, 0);
  assert.deepEqual(data.exercises.map(e => e.name), ['ペクトラルフライ（マシン）', 'サイドレイズ', 'レッグレイズ']);
  assert.equal(data.trainingItems.length, 3); assert.equal(data.trainingItemSettingChanges.length, 3);
  assert.ok(data.trainingItemSettingChanges.every(c => c.isInitial)); assert.deepEqual(data.sessions, []);
  assert.equal(data.activeMenuId, data.menus[0].id);
  assert.ok(data.menuEntries.every(e => data.trainingItems.some(i => i.id === e.trainingItemId)));
  assert.ok(!JSON.stringify(data).includes('legacy-')); assert.equal(context.serviceWorkers().length, 0);
  record('non-base-v6-real-IDB-preparation-exact-baseline-no-import-no-legacy-write');
  // Count mutation API calls in this automation document, including local receipt writes.
  await context.addInitScript(() => {
    window.__writes = 0;
    for (const name of ['put', 'add', 'delete', 'clear']) { const original = IDBObjectStore.prototype[name]; IDBObjectStore.prototype[name] = function (...args) { window.__writes++; return original.apply(this, args); }; }
    const original = Storage.prototype.setItem; Storage.prototype.setItem = function (...args) { window.__writes++; return original.apply(this, args); };
  });
  await page.goto('about:blank'); await page.goto(url); await page.getByText('PREPARED', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.__writes), 0); assert.deepEqual(await snapshot(page), prepared);
  record('exact-duplicate-zero-IDB-and-receipt-writes');

  browser = await chromium.launch();
  const changed = await browser.newContext(), changedPage = await changed.newPage();
  await changedPage.goto(`${origin}/__staging/prepare.html`); await seed(changedPage);
  let calls = 0;
  await changedPage.route('**/__staging/authorize', async route => {
    const response = await route.fetch();
    if (++calls === 3) await route.fulfill({ response, json: { run: vars.PREP_RUN, purpose: 'fresh' } });
    else await route.fulfill({ response });
  });
  await changedPage.goto('about:blank'); await changedPage.goto(url); await changedPage.getByText('STOP', { exact: true }).waitFor();
  const stopped = await snapshot(changedPage);
  assert.equal(stopped.receipt.phase, 'started');
  assert.deepEqual(stopped.stores, before.stores);
  record('loaded-client-pins-purpose-at-every-storage-write');
  await changed.close();

  const held = await browser.newContext(), heldPage = await held.newPage();
  await heldPage.goto(`${origin}/__staging/prepare.html`); await seed(heldPage);
  let release, reached;
  const hold = new Promise(resolve => { release = resolve; }), checkpoint = new Promise(resolve => { reached = resolve; });
  await heldPage.route('**/__staging/authorize', async route => { reached(); await hold; await route.continue(); });
  await heldPage.goto('about:blank'); await heldPage.goto(url); await checkpoint;
  await worker.stop(); worker = await start({ PREP_RUN: '', PREP_EXPIRES: '', PREP_TOKEN_HASH: '' }, port);
  release();
  await heldPage.getByText('STOP', { exact: true }).waitFor();
  assert.deepEqual(await snapshot(heldPage), before);
  for (const endpoint of ['authorize', 'initializer']) assert.equal((await fetch(`${origin}/__staging/${endpoint}`, { method: 'POST', headers })).status, 403);
  record('real-server-revocation-stops-already-loaded-client-without-writes');
  await held.close(); await browser.close(); browser = undefined;

  await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.getByRole('button', { name: '共通メニュー' }).click();
  await page.getByRole('button', { name: '設定', exact: true }).click();
  const body = await page.locator('body').innerText();
  assert.ok(body.includes('トレーナー連携') && !body.includes('カテゴリ'));
  assert.ok(body.includes('Build 2026-10-06 / 118ff493'));
  assert.deepEqual(await snapshot(page), prepared);
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.getByRole('combobox', { name: '週メニュー' }).inputValue(), data.activeMenuId);
  assert.deepEqual(await snapshot(page), prepared);
  record('revoked-ordinary-accepted-runtime-canonical-settings-and-reload');
  assert.equal(errors.length, 0); assert.ok(requests.every(u => u.startsWith('blob:') || new URL(u).origin === origin));
  await context.close(); context = await chromium.launchPersistentContext(profile, { headless: true });
  page = await context.newPage(); await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
  assert.deepEqual(await snapshot(page), prepared);
  assert.equal(await page.getByRole('combobox', { name: '週メニュー' }).inputValue(), data.activeMenuId);
  record('browser-process-restart-retains-canonical-and-unchanged-legacy');
  const intercepted = await page.goto(`${origin}/__staging/prepare.html`, { waitUntil: 'networkidle' });
  assert.ok(intercepted.fromServiceWorker());
  assert.ok((await intercepted.text()).includes('./assets/index-ddSmqDMp.js'));
  assert.equal(await page.locator('#status').count(), 0);
  assert.deepEqual(await snapshot(page), prepared);
  record('known-unmodified-SW-intercepts-prepare-navigation-delivery-remains-separate');
  evidence.result = 'PASS'; evidence.accepted = provenance.accepted;
  evidence.legacyJsonSha256 = hash(JSON.stringify(legacy)); evidence.productHashes = provenance.hashes;
  fs.writeFileSync(path.join(dir, '.generated/h14-recovery-local-evidence.json'), JSON.stringify(evidence, null, 2));
  console.log('PASS');
} finally { await context?.close(); await browser?.close(); await worker?.stop(); }
