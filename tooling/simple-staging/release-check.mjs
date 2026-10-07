import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';

const base = 'https://kzsakato.github.io/my-app/';
const manifest = JSON.parse(fs.readFileSync('release/118ff493/manifest.json'));
const evidence = {
  at: new Date().toISOString(), url: base, productCommit: manifest.productCommit,
  scope: 'Minimal release check; isolated fresh automation partition, not Owner MAN',
  ownerAuthorization: '2026-10-07 direct request: MAN-completed 118ff493 same-artifact Production promotion',
  workflowRun: 'https://github.com/kzsakato/my-app/actions/runs/37550195100',
  productFiles: [],
};
for (const file of manifest.productFiles) {
  const response = await fetch(base + file.path, { cache: 'no-store' });
  assert.equal(response.status, 200, file.path);
  const bytes = Buffer.from(await response.arrayBuffer());
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  assert.equal(sha256, file.sha256, file.path);
  assert.equal(bytes.length, file.bytes, file.path);
  evidence.productFiles.push({ ...file, status: response.status });
}
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  const page = await context.newPage(), errors = [], failures = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => failures.push(request.url()));
  await page.goto(base);
  await page.getByRole('button', { name: '共通メニュー' }).click();
  await page.getByRole('button', { name: '設定', exact: true }).click();
  const build = await page.getByLabel('ビルド識別子').innerText();
  assert.ok(build.includes(manifest.build), build);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  const scopes = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map(r => r.scope));
  assert.deepEqual(scopes, [base]);
  const text = await page.locator('body').innerText();
  evidence.browser = { build, scopes, categoryVisible: text.includes('カテゴリ'), trainerLinkVisible: text.includes('トレーナー連携'), pageErrors: errors, requestFailures: failures };
  assert.deepEqual(errors, []);
  assert.deepEqual(failures, []);
  evidence.result = 'PASS';
  fs.writeFileSync('tooling/simple-staging/evidence/production-release.json', JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({ result: evidence.result, files: evidence.productFiles.length, browser: evidence.browser }, null, 2));
} finally { await browser.close(); }
