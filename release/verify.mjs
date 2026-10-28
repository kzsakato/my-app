import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'c4fe4514-v1.2-production');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
const product = path.join(root, 'product');
assert.equal(manifest.productCommit, 'c4fe4514ab093a9e2084dc286310d46f81ab8864');
assert.equal(manifest.productFiles.length, 8);
const actual = fs.readdirSync(product, { recursive: true })
  .filter(p => fs.statSync(path.join(product, p)).isFile()).map(p => p.replaceAll('\\', '/')).sort();
assert.deepEqual(actual, manifest.productFiles.map(f => f.path).sort());
for (const file of manifest.productFiles) {
  const bytes = fs.readFileSync(path.join(product, file.path));
  assert.equal(bytes.length, file.bytes, file.path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, file.path);
}
console.log('PASS: exact eight-file V1.2 Production artifact; no rebuild. This verifier does not deploy.');
