// HTTP only: never opens an Owner preparation URL or executes its initializer.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const [state, artifact] = process.argv.slice(2);
assert.ok(['open', 'closed'].includes(state) && ['temporary', 'accepted'].includes(artifact));
const dir = new URL('./', import.meta.url);
const cap = JSON.parse(fs.readFileSync(new URL('recovery-capability.local.json', dir)));
const origin = new URL(cap.url).origin;
assert.equal(origin, 'https://my-app-staging.kzsakato-lab.workers.dev');
const manifest = JSON.parse(fs.readFileSync(new URL(artifact === 'temporary' ? '.generated/recovery-manifest.json' : '../../evidence/h-20261006-09/build-manifest.json', dir)));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const headers = { Origin: origin, Authorization: `Bearer ${cap.token}` };
let stable = 0, ready = false, attempts = 0;
for (; attempts < 15; attempts++) {
  try {
    for (const file of manifest.files) {
      const response = await fetch(`${origin}/${file.path}`); assert.equal(response.status, 200);
      assert.equal(hash(Buffer.from(await response.arrayBuffer())), file.sha256);
    }
    for (const endpoint of ['authorize', 'initializer']) {
      const response = await fetch(`${origin}/__staging/${endpoint}`, { method: 'POST', headers });
      assert.equal(response.status, state === 'open' ? 200 : 403);
      if (state === 'open') {
        if (endpoint === 'authorize') assert.deepEqual(await response.json(), { run: cap.run, purpose: 'h14-recovery' });
        else assert.equal(hash(Buffer.from(await response.arrayBuffer())), hash(fs.readFileSync(new URL('.generated/initializer.txt', dir))));
      }
    }
    stable++;
  } catch { stable = 0; }
  if (stable === 2) { ready = true; break; }
  await new Promise(resolve => setTimeout(resolve, 2000));
}
assert.ok(ready, 'STOP: bounded HTTP artifact/gate readiness not confirmed');
const evidence = { result: 'PASS', at: new Date().toISOString(), state, artifact, run: cap.run, purpose: cap.purpose, expires: cap.expires, origin, attempts: attempts + 1, initializerExecuted: false, ownerPartitionAccessed: false };
fs.writeFileSync(new URL(`.generated/recovery-owner-${state}-${artifact}.json`, dir), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence));
