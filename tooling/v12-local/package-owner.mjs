import { cpSync,mkdirSync,readFileSync,writeFileSync } from 'node:fs'
import { resolve,join } from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
const output=resolve(process.argv[2]??'../../v12-owner-package')
const manifest=JSON.parse(readFileSync('evidence/issue30-v12/local-adb/artifact.json','utf8'))
for(const row of manifest.files)if(createHash('sha256').update(readFileSync(join('dist-v12-local',row.path))).digest('hex')!==row.sha256)throw Error('Pinned candidate artifact mismatch; do not silently rebuild')
mkdirSync(output,{recursive:true});cpSync('tooling/v12-local/owner',output,{recursive:true});cpSync('dist-v12-local',join(output,'site'),{recursive:true})
writeFileSync(join(output,'artifact.json'),JSON.stringify(manifest,null,2)+'\n')
writeFileSync(join(output,'package-info.json'),JSON.stringify({launcherSourceSHA:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),candidateSourceSHA:manifest.sourceSHA,platform:'Windows; Node.js >=22; existing ADB; no runtimes bundled'},null,2)+'\n')
for(const f of ['START.cmd','STOP.cmd','CHECK.cmd']){const p=join(output,f);writeFileSync(p,readFileSync(p,'utf8').replace(/\r?\n/g,'\r\n'))}
console.log(output)
