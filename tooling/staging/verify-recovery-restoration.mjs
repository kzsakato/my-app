// Read-only verification of the existing synthetic automation profile after restore.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { legacy } from './recovery-fixture.mjs';
const dir = new URL('./', import.meta.url);
const { profile, origin } = JSON.parse(fs.readFileSync(new URL('.generated/recovery-delivery-remote-profile.local.json', dir)));
assert.equal(origin, 'https://my-app-staging.kzsakato-lab.workers.dev');
assert.ok(profile.includes('h14-delivery-remote-profile-'));
const cap = JSON.parse(fs.readFileSync(new URL('.generated/recovery-remote-automation-capability.local.json', dir)));
assert.ok(cap.run.includes('automation') && !cap.run.includes('owner'));
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const accepted = JSON.parse(fs.readFileSync(new URL('../../evidence/h-20261006-09/build-manifest.json', dir)));
for (const file of accepted.files) {
  const r = await fetch(`${origin}/${file.path}`); assert.equal(r.status, 200); assert.equal(digest(Buffer.from(await r.arrayBuffer())), file.sha256);
}
for (const endpoint of ['authorize', 'initializer']) assert.equal((await fetch(`${origin}/__staging/${endpoint}`, { method: 'POST', headers: { Origin: origin, Authorization: `Bearer ${cap.token}` } })).status, 403);
const snapshot = page => page.evaluate(async () => {
  const data = {};
  for (const entry of await indexedDB.databases()) {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open(entry.name); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const stores = {};
    for (const name of [...db.objectStoreNames]) {
      const store = db.transaction(name).objectStore(name);
      const read = r => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
      const [keys, values] = await Promise.all([read(store.getAllKeys()), read(store.getAll())]); stores[name] = keys.map((key, i) => [key, values[i]]);
    }
    data[entry.name] = { version: db.version, stores }; db.close();
  }
  const readStorage = storage => Object.fromEntries(Object.keys(storage).sort().map(key => [key, storage.getItem(key)]));
  return { data, local: readStorage(localStorage), session: readStorage(sessionStorage) };
});
const evidence = { result: 'RUNNING', at: new Date().toISOString(), scope: 'accepted restore / existing synthetic automation partition only', ownerPartitionInspected: false };
let context = await chromium.launchPersistentContext(profile, { headless: true });
try {
  let page = await context.newPage(); await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
  const before = await snapshot(page), stores = before.data['training-check'].stores;
  assert.deepEqual(stores.state[0][1], legacy); assert.equal(stores.baseline[0][1].rawJson, JSON.stringify(legacy));
  assert.equal(stores.cutover[0][1].authoritative, true); assert.equal(JSON.parse(before.local['v1r-staging-receipt']).phase, 'complete');
  const data = stores.canonical[0][1]; assert.deepEqual(data.sessions, []); assert.deepEqual(data.profile, { weight: 66 });
  let restored = false;
  for (let attempt = 1; attempt <= 6; attempt++) {
    await page.goto(`${origin}/`, { waitUntil: 'networkidle' }); await page.waitForTimeout(10000);
    const response = await page.goto(`${origin}/__staging/prepare.html`, { waitUntil: 'domcontentloaded' });
    if (response.fromServiceWorker() && (await response.text()).includes('./assets/index-ddSmqDMp.js') && await page.locator('#status').count() === 0) { restored = true; evidence.ordinaryRestoreCycles = attempt; break; }
  }
  assert.ok(restored, 'STOP: accepted SW convergence not confirmed'); assert.deepEqual(await snapshot(page), before);
  await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '共通メニュー' }).click(); await page.getByRole('button', { name: '設定', exact: true }).click();
  const body = await page.locator('body').innerText(); assert.ok(body.includes('トレーナー連携') && !body.includes('カテゴリ') && body.includes('Build 2026-10-06 / 118ff493'));
  await page.reload({ waitUntil: 'networkidle' }); assert.deepEqual(await snapshot(page), before);
  await context.close(); context = await chromium.launchPersistentContext(profile, { headless: true }); page = await context.newPage();
  await page.goto(`${origin}/`, { waitUntil: 'networkidle' }); assert.deepEqual(await snapshot(page), before);
  assert.equal(await page.getByRole('combobox', { name: '週メニュー' }).inputValue(), data.activeMenuId);
  evidence.storageSHA256 = digest(JSON.stringify(before)); evidence.acceptedAssets = 8; evidence.oldAutomationTokenRevoked = true;
} finally { await context.close(); }
const previous = JSON.parse(fs.readFileSync(new URL('evidence/h14-temporary-diagnostic/post-integrity.json', dir))).production;
for (const [file, expected] of Object.entries(previous.hashes)) {
  const r = await fetch(new URL(file, previous.origin)); assert.equal(r.status, 200); assert.equal(digest(Buffer.from(await r.arrayBuffer())), expected);
}
const deployment = JSON.parse(execFileSync('gh', ['api', 'repos/kzsakato/my-app/deployments', '--jq', '.[0] | {id,sha}'], { encoding: 'utf8' }));
assert.deepEqual(deployment, previous.deployment);
const main = execFileSync('git', ['ls-remote', 'https://github.com/kzsakato/my-app.git', 'refs/heads/main'], { encoding: 'utf8' }).split(/\s/)[0]; assert.equal(main, previous.main);
evidence.production = { hashes: previous.hashes, deployment, main };
evidence.result = 'PASS';
fs.writeFileSync(new URL('.generated/recovery-restoration-evidence.json', dir), JSON.stringify(evidence, null, 2)); console.log(JSON.stringify(evidence));
