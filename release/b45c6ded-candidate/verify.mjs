// Reference archive verification only. This does not authorize Pages deployment.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
assert.equal(manifest.sourceCommit, 'b45c6ded5e7457d80018d1cc6986a4f591739f8a');
assert.equal(manifest.status, 'REFERENCE ONLY — NOT PAGES DEPLOYABLE');
const product = path.join(root, 'product');
const actual = fs.readdirSync(product, { recursive: true })
  .filter(p => fs.statSync(path.join(product, p)).isFile()).map(p => p.replaceAll('\\', '/')).sort();
assert.equal(manifest.productFiles.length, 3);
assert.deepEqual(actual, manifest.productFiles.map(f => f.path).sort());
for (const f of manifest.productFiles) {
  const bytes = fs.readFileSync(path.join(product, f.path));
  assert.equal(bytes.length, f.bytes, f.path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), f.sha256, f.path);
}
console.log('PASS: three-file candidate reference archive. NOT PAGES DEPLOYABLE.');
