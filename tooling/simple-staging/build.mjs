import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'vite';
const dir = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(dir, '../..');
const origin = process.argv[2] ?? 'https://my-app-simple-118ff493.kzsakato-lab.workers.dev';
if (origin !== 'https://my-app-simple-118ff493.kzsakato-lab.workers.dev' && !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw Error('Not an approved staging/local origin');
const generated = path.join(dir, '.generated'), site = path.join(generated, 'site'), product = path.join(generated, 'product');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'evidence/h-20261006-09/build-manifest.json')));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
execFileSync('git', ['diff', '--exit-code', manifest.productCommit, '--', 'src', 'vite.config.ts', 'package.json', 'pnpm-lock.yaml'], { cwd: root });
for (const file of manifest.files) {
  const bytes = fs.readFileSync(path.join(root, 'dist', file.path));
  if (hash(bytes) !== file.sha256) throw Error('Accepted artifact mismatch: ' + file.path);
  for (const base of [product, path.join(site, 'app')]) {
    const target = path.join(base, file.path); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes);
  }
}
// Promotion source is allowlisted Product files only, never the Staging site root.
const productFiles = fs.readdirSync(product, { recursive: true }).filter(name => fs.statSync(path.join(product, name)).isFile()).map(name => name.replaceAll('\\', '/')).sort();
if (JSON.stringify(productFiles) !== JSON.stringify(manifest.files.map(f => f.path).sort())) throw Error('Unexpected promotion file');
const fixtureBuild = await build({ configFile: false, publicDir: false, build: { write: false, minify: false, lib: { entry: path.join(dir, 'fixture.ts'), formats: ['es'] } } });
const fixtureModule = path.join(generated, 'fixture.mjs');
fs.writeFileSync(fixtureModule, fixtureBuild[0].output.find(o => o.type === 'chunk').code);
const { fixture, at } = await import(pathToFileURL(fixtureModule).href + '?build=' + Date.now());
const fixtureHash = hash(JSON.stringify(fixture)), fixtureId = 'H17-' + fixtureHash;
fs.writeFileSync(path.join(generated, 'fixture.json'), JSON.stringify(fixture, null, 2));
await build({ configFile: false, publicDir: false, define: { STAGING_ORIGIN: JSON.stringify(origin), FIXTURE: JSON.stringify(fixture), FIXTURE_ID: JSON.stringify(fixtureId), FIXTURE_AT: JSON.stringify(at) }, build: { outDir: site, emptyOutDir: false, minify: true, lib: { entry: path.join(dir, 'entry.ts'), name: 'SimpleStagingEntry', formats: ['iife'], fileName: () => 'entry.js' } } });
fs.writeFileSync(path.join(site, 'index.html'), '<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Simple Staging</title><p id="status">テストを開始しています…</p><script src="/entry.js"></script></html>');
fs.writeFileSync(path.join(site, '_headers'), '/\n  Cache-Control: no-store\n  Content-Security-Policy: default-src \'none\'; script-src \'self\'; frame-ancestors \'none\'; base-uri \'none\'\n/entry.js\n  Cache-Control: no-store\n');
fs.writeFileSync(path.join(generated, 'wrangler.json'), JSON.stringify({ name: 'my-app-simple-118ff493', compatibility_date: '2026-10-07', workers_dev: true, preview_urls: false, assets: { directory: './site', not_found_handling: 'none' } }, null, 2));
fs.writeFileSync(path.join(generated, 'manifest.json'), JSON.stringify({ origin, productCommit: manifest.productCommit, fixtureId, fixtureHash, productFiles: manifest.files }, null, 2));
console.log('Built separate Staging entry and unchanged eight-file Product; no deploy.');
