import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'b45c6ded-production');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
const product = path.join(root, 'product');
assert.equal(manifest.productCommit, 'b45c6ded5e7457d80018d1cc6986a4f591739f8a');
assert.equal(manifest.productFiles.length, 8);
const actual = fs.readdirSync(product, { recursive: true })
  .filter(p => fs.statSync(path.join(product, p)).isFile()).map(p => p.replaceAll('\\', '/')).sort();
assert.deepEqual(actual, manifest.productFiles.map(f => f.path).sort());
for (const file of manifest.productFiles) {
  const bytes = fs.readFileSync(path.join(product, file.path));
  assert.equal(bytes.length, file.bytes, file.path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, file.path);
}
console.log('PASS: exact eight-file V1.1 Production artifact; no rebuild. Deployment requires separate Owner GO.');
