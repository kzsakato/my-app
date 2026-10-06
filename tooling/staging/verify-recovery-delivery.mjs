// Explicit local/remote automation. Remote mode temporarily deploys only my-app-staging,
// then closes the capability and restores accepted assets, including on failure.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { legacy } from './recovery-fixture.mjs';

const [mode, wranglerPath] = process.argv.slice(2);
assert.ok(['local', 'remote'].includes(mode), 'mode must be explicit local or remote');
const pkg = path.resolve(wranglerPath), { unstable_dev } = createRequire(import.meta.url)(pkg);
const dir = path.dirname(fileURLToPath(import.meta.url)), generated = path.join(dir, '.generated');
const acceptedConfig = path.join(dir, 'wrangler.json'), temporaryConfig = path.join(generated, 'recovery-wrangler.json');
const accepted = JSON.parse(fs.readFileSync(path.join(dir, '../../evidence/h-20261006-09/build-manifest.json')));
const temporary = JSON.parse(fs.readFileSync(path.join(generated, 'recovery-manifest.json')));
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const hash = value => digest(JSON.stringify(value));
const token = crypto.randomBytes(32).toString('hex');
const gate = { PREP_RUN: `H14-${mode}-delivery-automation`, PREP_PURPOSE: 'h14-recovery', PREP_EXPIRES: new Date(Date.now() + 3600000).toISOString(), PREP_TOKEN_HASH: digest(token) };
fs.writeFileSync(path.join(generated, `recovery-${mode}-automation-capability.local.json`), JSON.stringify({ token, run: gate.PREP_RUN, expires: gate.PREP_EXPIRES }, null, 2));
const closed = { PREP_RUN: '', PREP_EXPIRES: '', PREP_TOKEN_HASH: '' };
const evidence = { result: 'RUNNING', mode, at: new Date().toISOString(), ownerPartitionInspected: false, checks: [], deployments: [] };
let worker, context, origin, port = 0, remoteChanged = false, restored = false;
const record = name => { evidence.checks.push(name); console.log(name); };
async function deploy(temporaryAssets, open) {
  const config = temporaryAssets ? temporaryConfig : acceptedConfig;
  if (mode === 'local') {
    await worker?.stop();
    worker = await unstable_dev(path.join(dir, 'worker.ts'), { config, vars: open ? gate : closed, local: true, ip: '127.0.0.1', port, persist: false, logLevel: 'error', experimental: { disableExperimentalWarning: true, disableDevRegistry: true, watch: false } });
    port = worker.port; origin = `http://127.0.0.1:${port}`;
  } else {
    const cfg = JSON.parse(fs.readFileSync(config));
    assert.equal(cfg.name, 'my-app-staging');
    cfg.main = '../worker.ts'; cfg.assets.directory = temporaryAssets ? './recovery-dist' : '../../../dist'; cfg.vars = open ? gate : closed;
    const filename = path.join(generated, 'recovery-automation-deploy.local.json');
    fs.writeFileSync(filename, JSON.stringify(cfg, null, 2));
    remoteChanged = true;
    const output = execFileSync(process.execPath, [path.join(pkg, 'bin/wrangler.js'), 'deploy', '--config', filename], { cwd: path.join(dir, '../..'), encoding: 'utf8', timeout: 120000 });
    fs.writeFileSync(path.join(generated, `recovery-${mode}-deploy-${evidence.deployments.length}.log`), output);
    evidence.deployments.push({ temporaryAssets, open, version: output.match(/Current Version ID:\s*(\S+)/)?.[1] ?? 'see local deploy log' });
    console.log(`Staging deployed: temporary=${temporaryAssets}, capability=${open ? 'automation-only' : 'closed'}`);
    // A completed CLI deployment is not proof that every subsequent HTTP request
    // already sees the new version. Observe assets AND gate before browser work.
    let stable = 0, ready = false;
    for (let attempt = 1; attempt <= 15; attempt++) {
      try {
        await integrity(temporaryAssets ? temporary : accepted);
        const headers = { Origin: origin, Authorization: `Bearer ${token}` };
        for (const endpoint of ['authorize', 'initializer']) {
          const response = await fetch(`${origin}/__staging/${endpoint}`, { method: 'POST', headers });
          assert.equal(response.status, open ? 200 : 403);
          if (open && endpoint === 'authorize') assert.deepEqual(await response.json(), { run: gate.PREP_RUN, purpose: 'h14-recovery' });
        }
        stable++;
      } catch { stable = 0; }
      if (stable === 2) { evidence.deployments.at(-1).httpReadyAttempts = attempt; ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    assert.ok(ready, 'STOP: deployment assets/gate did not converge within bounded HTTP readiness checks');
  }
}
async function integrity(manifest) {
  for (const file of manifest.files) {
    const response = await fetch(`${origin}/${file.path}`);
    assert.equal(response.status, 200); assert.equal(digest(Buffer.from(await response.arrayBuffer())), file.sha256, file.path);
  }
}
async function production() {
  const previous = JSON.parse(fs.readFileSync(path.join(dir, 'evidence/h14-temporary-diagnostic/post-integrity.json'))).production;
  const hashes = {};
  for (const [file, expected] of Object.entries(previous.hashes)) {
    const response = await fetch(new URL(file, previous.origin)); assert.equal(response.status, 200);
    hashes[file] = digest(Buffer.from(await response.arrayBuffer())); assert.equal(hashes[file], expected);
  }
  const deployment = JSON.parse(execFileSync('gh', ['api', 'repos/kzsakato/my-app/deployments', '--jq', '.[0] | {id,sha,environment}'], { encoding: 'utf8' }));
  const main = execFileSync('git', ['ls-remote', 'https://github.com/kzsakato/my-app.git', 'refs/heads/main'], { encoding: 'utf8' }).split(/\s/)[0];
  assert.equal(main, previous.main); assert.equal(deployment.id, previous.deployment.id); assert.equal(deployment.sha, previous.deployment.sha);
  return { hashes, deployment, main };
}
const snapshot = page => page.evaluate(async () => {
  const data = {};
  for (const entry of await indexedDB.databases()) {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open(entry.name); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const stores = {};
    for (const name of [...db.objectStoreNames]) {
      const store = db.transaction(name).objectStore(name);
      const read = r => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
      const [keys, values] = await Promise.all([read(store.getAllKeys()), read(store.getAll())]);
      stores[name] = keys.map((key, i) => [key, values[i]]);
    }
    data[entry.name] = { version: db.version, stores }; db.close();
  }
  const readStorage = storage => Object.fromEntries(Object.keys(storage).sort().map(key => [key, storage.getItem(key)]));
  return { data, local: readStorage(localStorage), session: readStorage(sessionStorage) };
});
async function updateByOrdinaryNavigation(page, expectedShell) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(10000);
    const response = await page.goto(`${origin}/__staging/prepare.html`, { waitUntil: 'domcontentloaded' });
    const shell = await page.locator('#status').count() === 1;
    if (shell === expectedShell) {
      assert.equal(response.fromServiceWorker(), !expectedShell);
      return attempt;
    }
  }
  throw Error('STOP: ordinary SW convergence not demonstrated within bounded cycles');
}
async function ordinaryCanonical(page, prepared) {
  await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '共通メニュー' }).click();
  await page.getByRole('button', { name: '設定', exact: true }).click();
  const body = await page.locator('body').innerText();
  assert.ok(body.includes('トレーナー連携') && !body.includes('カテゴリ'));
  assert.ok(body.includes('Build 2026-10-06 / 118ff493'));
  assert.deepEqual(await snapshot(page), prepared);
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.getByRole('combobox', { name: '週メニュー' }).inputValue(), prepared.data['training-check'].stores.canonical[0][1].activeMenuId);
  assert.deepEqual(await snapshot(page), prepared);
}
try {
  if (mode === 'remote') { origin = 'https://my-app-staging.kzsakato-lab.workers.dev'; evidence.productionBefore = await production(); }
  else await deploy(false, false);
  await integrity(accepted);
  const profile = fs.mkdtempSync(path.join(generated, `h14-delivery-${mode}-profile-`));
  fs.writeFileSync(path.join(generated, `recovery-delivery-${mode}-profile.local.json`), JSON.stringify({ profile, origin }, null, 2));
  context = await chromium.launchPersistentContext(profile, { headless: true });
  let page = await context.newPage();
  await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  // Deliberately seed only this newly created automation profile, before delivery measurements.
  await page.evaluate(async legacy => {
    const db = await new Promise(resolve => { const r = indexedDB.open('training-check'); r.onsuccess = () => resolve(r.result); });
    await new Promise((resolve, reject) => { const tx = db.transaction('state', 'readwrite'); tx.objectStore('state').put(legacy, 'app'); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); db.close();
  }, legacy);
  await page.reload({ waitUntil: 'networkidle' });
  const before = await snapshot(page), stores = before.data['training-check'].stores;
  for (const name of ['baseline', 'canonical', 'cutover', 'recovery']) assert.deepEqual(stores[name], []);
  assert.equal(before.local['v1r-staging-receipt'], undefined);
  const old = await page.goto(`${origin}/__staging/prepare.html`, { waitUntil: 'domcontentloaded' });
  assert.ok(old.fromServiceWorker()); assert.equal(await page.locator('#status').count(), 0);
  assert.deepEqual(await snapshot(page), before);
  record('persistent-old-accepted-SW-controls-and-intercepts-prepare');
  const mutations = [], forbidden = [], legacyWrites = [];
  await context.exposeBinding('__h14Mutation', (_, operation, value) => { mutations.push(operation); if (operation === 'state:put') legacyWrites.push(value); });
  await context.exposeBinding('__h14Forbidden', (_, operation) => forbidden.push(operation));
  await context.addInitScript(() => {
    for (const key of ['put', 'add', 'delete', 'clear']) { const old = IDBObjectStore.prototype[key]; IDBObjectStore.prototype[key] = function (...args) { window.__h14Mutation(this.name + ':' + key, this.name === 'state' && key === 'put' ? JSON.stringify(args[0]) : undefined); return old.apply(this, args); }; }
    for (const key of ['setItem', 'removeItem', 'clear']) { const old = Storage.prototype[key]; Storage.prototype[key] = function (...args) { window.__h14Mutation('storage:' + key); return old.apply(this, args); }; }
    for (const key of ['update', 'unregister']) { const old = ServiceWorkerRegistration.prototype[key]; ServiceWorkerRegistration.prototype[key] = function (...args) { window.__h14Forbidden(key); return old.apply(this, args); }; }
    const old = CacheStorage.prototype.delete; CacheStorage.prototype.delete = function (...args) { window.__h14Forbidden('cache-delete'); return old.apply(this, args); };
  });
  await deploy(true, true); await integrity(temporary);
  evidence.updateCycles = await updateByOrdinaryNavigation(page, true);
  assert.deepEqual(await snapshot(page), before); assert.deepEqual(forbidden, []);
  // Accepted legacy App mounts call saveData(d). Prove these ordinary autosaves
  // contain the identical value; the delivery shim has no storage operation.
  assert.ok(mutations.every(operation => operation === 'state:put'));
  assert.ok(legacyWrites.every(value => value === JSON.stringify(legacy)));
  evidence.ordinaryLegacyIdenticalAutosaves = legacyWrites.length;
  mutations.length = 0;
  record('ordinary-update-activates-exact-prepare-exclusion-product-data-unchanged');
  for (const suffix of ['/__staging/prepare.html?other=1', '/__staging/prepare.html/extra', '/__staging/diagnose.html', '/__staging/initializer', '/__staging/authorize']) {
    const response = await page.goto(origin + suffix, { waitUntil: 'networkidle' });
    assert.ok(response.fromServiceWorker(), `exclusion too wide: ${suffix}`); assert.equal(await page.locator('#status').count(), 0);
  }
  assert.deepEqual(await snapshot(page), before); assert.deepEqual(mutations, []);
  const headers = { Origin: origin, Authorization: `Bearer ${token}` };
  const request = (endpoint, h = headers, method = 'POST') => fetch(`${origin}/__staging/${endpoint}`, { method, headers: h });
  assert.deepEqual(await (await request('authorize')).json(), { run: gate.PREP_RUN, purpose: 'h14-recovery' });
  for (const endpoint of ['authorize', 'initializer']) {
    for (const h of [{ Origin: origin }, { ...headers, Origin: 'https://invalid.example' }, { ...headers, Authorization: `Bearer ${'0'.repeat(64)}` }]) assert.equal((await request(endpoint, h)).status, 403);
    assert.equal((await request(endpoint, headers, 'GET')).status, 403);
  }
  record('exact-path-only-and-same-origin-POST-bearer-purpose-boundary');
  await page.goto('about:blank'); await page.goto(`${origin}/__staging/prepare.html#${token}`);
  await page.getByText('PREPARED', { exact: true }).waitFor();
  const prepared = await snapshot(page), result = prepared.data['training-check'].stores, data = result.canonical[0][1];
  assert.deepEqual(result.state, stores.state); assert.deepEqual(result.recovery, stores.recovery);
  assert.equal(result.baseline[0][1].rawJson, JSON.stringify(legacy)); assert.equal(result.cutover[0][1].authoritative, true);
  assert.deepEqual(data.profile, { weight: 66 }); assert.equal(data.weekStartsOn, 0); assert.deepEqual(data.sessions, []);
  assert.deepEqual(data.exercises.map(e => e.name), ['ペクトラルフライ（マシン）', 'サイドレイズ', 'レッグレイズ']);
  assert.equal(data.trainingItems.length, 3); assert.equal(data.trainingItemSettingChanges.length, 3); assert.ok(data.trainingItemSettingChanges.every(c => c.isInitial));
  assert.equal(data.activeMenuId, data.menus[0].id); assert.ok(data.menuEntries.every(e => data.trainingItems.some(i => i.id === e.trainingItemId)));
  assert.ok(!JSON.stringify(data).includes('legacy-'));
  const receipt = JSON.parse(prepared.local['v1r-staging-receipt']); assert.equal(receipt.purpose, 'h14-recovery'); assert.equal(receipt.phase, 'complete');
  record('bounded-recovery-PREPARED-baseline-exact-legacy-unchanged-no-import');
  mutations.length = 0; await page.goto('about:blank'); await page.goto(`${origin}/__staging/prepare.html#${token}`);
  await page.getByText('PREPARED', { exact: true }).waitFor(); assert.deepEqual(await snapshot(page), prepared); assert.deepEqual(mutations, []);
  record('duplicate-zero-write');
  await deploy(true, false);
  for (const endpoint of ['authorize', 'initializer']) assert.equal((await request(endpoint)).status, 403);
  await page.goto('about:blank'); await page.goto(`${origin}/__staging/prepare.html#${token}`);
  await page.getByText('STOP', { exact: true }).waitFor(); assert.deepEqual(await snapshot(page), prepared);
  record('revoke-before-restore-old-token-inert-no-writes');
  await deploy(false, false); restored = true; await integrity(accepted);
  evidence.restoreCycles = await updateByOrdinaryNavigation(page, false);
  assert.deepEqual(await snapshot(page), prepared); assert.deepEqual(mutations, []); assert.deepEqual(forbidden, []);
  await ordinaryCanonical(page, prepared);
  await context.close(); context = await chromium.launchPersistentContext(profile, { headless: true }); page = await context.newPage();
  await ordinaryCanonical(page, prepared);
  record('accepted-SW-restored-no-temporary-shell-canonical-reload-process-restart');
  evidence.beforeStorageSHA256 = hash(before); evidence.preparedStorageSHA256 = hash(prepared);
  evidence.legacyJsonSHA256 = digest(JSON.stringify(legacy)); evidence.acceptedProduct = accepted.productCommit;
  evidence.temporarySW = temporary.files.find(f => f.path === 'sw.js').sha256;
  if (mode === 'remote') { evidence.productionAfter = await production(); assert.deepEqual(evidence.productionAfter, evidence.productionBefore); record('Production-hashes-deployment-main-unchanged'); }
  evidence.result = 'PASS';
} catch (error) {
  evidence.result = 'FAIL'; evidence.failure = String(error).replaceAll(token, '[redacted]'); throw error;
} finally {
  await context?.close();
  try {
    if (mode === 'remote' && remoteChanged && !restored) {
      try { await deploy(true, false); } catch { evidence.failureCloseReadiness = 'not confirmed before accepted restore attempt'; }
      await deploy(false, false); await integrity(accepted); evidence.failureCleanup = 'capability closed and accepted artifact restored';
    }
  } finally {
    await worker?.stop();
    fs.writeFileSync(path.join(generated, `recovery-delivery-${mode}-evidence.json`), JSON.stringify(evidence, null, 2));
  }
}
console.log('PASS');
