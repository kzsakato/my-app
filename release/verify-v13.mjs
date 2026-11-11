import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'v1.3-production-candidate')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'))
const product = path.join(root, 'product')
const files = fs.readdirSync(product, { recursive: true }).filter(file => fs.statSync(path.join(product,file)).isFile()).map(file => file.split(path.sep).join('/')).sort()
assert.deepEqual(files, manifest.productFiles.map(file=>file.path).sort())
for (const file of manifest.productFiles) {
 const bytes = fs.readFileSync(path.join(product,file.path))
 assert.equal(bytes.length,file.bytes,file.path)
 assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,file.path)
}
console.log('PASS: V1.3 candidate artifact hashes; preserved staging files included')
if (process.argv.includes('--require-ready')) assert.equal(manifest.readyForDeployment,true,manifest.reason)
