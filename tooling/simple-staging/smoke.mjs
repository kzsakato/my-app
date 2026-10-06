import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
const dir = path.dirname(fileURLToPath(import.meta.url)), generated = path.join(dir, '.generated'), site = path.join(generated, 'site');
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/blank.html') { res.end('<!doctype html><title>fixture test setup</title>'); return; }
  const file = path.resolve(site, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
  if (!file.startsWith(site + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : 'application/json', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const evidence = { date: '2026-10-07', scope: 'local bounded smoke only; no remote deploy', checks: [] };
const record = value => { evidence.checks.push(value); console.log(value); };
const snapshot = page => page.evaluate(async () => {
  const db = await new Promise((resolve, reject) => { const r = indexedDB.open('training-check'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  const data = {};
  for (const name of [...db.objectStoreNames]) {
    const store = db.transaction(name).objectStore(name);
    const read = r => new Promise(resolve => { r.onsuccess = () => resolve(r.result); });
    data[name] = await Promise.all([read(store.getAllKeys()), read(store.getAll())]);
  }
  db.close(); return data;
});
try {
  execFileSync(process.execPath, [path.join(dir, 'build.mjs'), origin], { stdio: 'pipe' });
  const manifest = JSON.parse(fs.readFileSync(path.join(generated, 'manifest.json')));
  for (const file of manifest.productFiles) for (const base of [path.join(site, 'app'), path.join(generated, 'product')]) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(base, file.path))).digest('hex'), file.sha256);
  assert.deepEqual(fs.readdirSync(path.join(generated, 'product'), { recursive: true }).filter(p => fs.statSync(path.join(generated, 'product', p)).isFile()).map(p => p.replaceAll('\\', '/')).sort(), manifest.productFiles.map(f => f.path).sort());
  record('eight-Product-files-byte-identical-and-promotion-excludes-entry-fixture');
  browser = await chromium.launch();
  const context = await browser.newContext(), page = await context.newPage();
  let entryPuts = 0; await context.exposeFunction('__entryMutation', () => { entryPuts++; });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await context.addInitScript(() => {
    window.__puts = 0;
    const put = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (...args) { window.__puts++; if (location.pathname === '/') window.__entryMutation(); return put.apply(this, args); };
  });
  await page.goto(origin + '/'); await page.waitForURL(origin + '/app/');
  await page.getByRole('combobox', { name: '週メニュー' }).waitFor();
  const fresh = await snapshot(page), data = fresh.canonical[1][0];
  assert.deepEqual(data, JSON.parse(fs.readFileSync(path.join(generated, 'fixture.json'))));
  assert.deepEqual(data.sessions, []); assert.equal(data.exercises.length, 3); assert.equal(data.trainingItems.length, 3);
  assert.equal(data.activeMenuId, data.menus[0].id); assert.deepEqual(fresh.state[0], []); assert.deepEqual(fresh.baseline[0], []);
  assert.equal(entryPuts, 3);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  assert.deepEqual(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map(r => r.scope)), [origin + '/app/']);
  // Observe a second root visit before it redirects: its document is uncontrolled.
  await context.addInitScript(() => { if (location.pathname === '/') sessionStorage.setItem('smoke-root-controller', String(navigator.serviceWorker.controller)); });
  await page.getByRole('button', { name: '共通メニュー' }).click(); await page.getByRole('button', { name: '設定', exact: true }).click();
  const settings = await page.locator('body').innerText(); assert.ok(settings.includes('トレーナー連携') && !settings.includes('カテゴリ'));
  await page.getByRole('button', { name: /プロフィール/ }).click();
  await page.getByLabel('体重（kg）', { exact: false }).fill('67'); await page.getByRole('button', { name: '保存', exact: true }).click();
  const edited = await snapshot(page); assert.equal(edited.canonical[1][0].profile.weight, 67);
  record('fresh-canonical-approved-fixture-zero-Sessions-normal-Profile-edit');
  entryPuts = 0;
  await page.goto(origin + '/'); await page.waitForURL(origin + '/app/');
  assert.deepEqual(await snapshot(page), edited); assert.equal(await page.evaluate(() => sessionStorage.getItem('smoke-root-controller')), 'null');
  await page.reload(); await page.getByRole('combobox', { name: '週メニュー' }).waitFor(); assert.deepEqual(await snapshot(page), edited);
  assert.equal(entryPuts, 0); evidence.revisitEntryPuts = entryPuts; assert.deepEqual(errors, []);
  record('revisit-zero-provisioning-reload-preserves-MAN-change-SW-only-app');
  await context.close();
  for (const version of [7, 6]) {
    const dirty = await browser.newContext(), p = await dirty.newPage(); await p.goto(origin + '/blank.html');
    await p.evaluate(async version => {
      const db = await new Promise(resolve => { const r = indexedDB.open('training-check', version); r.onupgradeneeded = () => { for (const name of ['state', 'canonical', 'cutover', 'baseline', 'recovery']) r.result.createObjectStore(name); }; r.onsuccess = () => resolve(r.result); });
      await new Promise(resolve => { const tx = db.transaction('state', 'readwrite'); tx.objectStore('state').put({ sentinel: 'unknown data' }, 'app'); tx.oncomplete = resolve; }); db.close();
    }, version);
    const before = await snapshot(p); await p.goto(origin + '/'); await p.getByText(/STOP/).waitFor(); assert.deepEqual(await snapshot(p), before); assert.equal(p.url(), origin + '/'); await dirty.close();
  }
  record('unexpected-data-and-old-DB-version-STOP-without-provisioning');
  const interrupted = await browser.newContext();
  await interrupted.addInitScript(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) { if (args[1] === 'simple-staging-fixture') throw Error('synthetic interruption'); return original.apply(this, args); };
  });
  const partial = await interrupted.newPage(); await partial.goto(origin + '/'); await partial.getByText(/STOP/).waitFor();
  assert.ok(Object.values(await snapshot(partial)).every(([keys]) => keys.length === 0)); await interrupted.close();
  record('interrupted-first-transaction-keeps-data-and-authority-absent');
  const denied = await browser.newContext();
  // Intercept ALL requests: no request is sent to the real Production host.
  await denied.route('**/*', route => route.fulfill({ status: 200, contentType: route.request().url().endsWith('/entry.js') ? 'text/javascript' : 'text/html', body: fs.readFileSync(path.join(site, route.request().url().endsWith('/entry.js') ? 'entry.js' : 'index.html')) }));
  const p = await denied.newPage(); await p.goto('https://kzsakato.github.io/'); await p.getByText(/STOP/).waitFor(); assert.deepEqual(await p.evaluate(() => indexedDB.databases()), []); await denied.close();
  record('intercepted-Production-origin-zero-DB-provisioning-no-real-network');
  evidence.result = 'PASS'; evidence.productCommit = manifest.productCommit; evidence.fixtureHash = manifest.fixtureHash;
  fs.writeFileSync(path.join(generated, 'smoke.json'), JSON.stringify(evidence, null, 2));
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
