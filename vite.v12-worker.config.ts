import { defineConfig } from 'vite'
import { makeLocalConfig } from './vite.v12-local.config'
import { execFileSync } from 'node:child_process'
const testOnly=process.env.V12_WORKER_TEST==='1'
const origin=testOnly?'http://localhost:4182':'https://my-app-staging-v1r.kzsakato-lab.workers.dev'
const sourceSHA=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()
const local=makeLocalConfig(true)
export default defineConfig({
  ...local,
  define:{...local.define,'import.meta.env.VITE_V1R11_ORIGIN':JSON.stringify(origin)},
  plugins:[{name:'fixed-worker-origin',enforce:'pre',transform(code,id){
    if(id.replaceAll('\\','/').endsWith('/tooling/v12-local/main.ts'))return code.replaceAll('http://localhost:4182',origin).replace('検証用localhost以外','検証候補origin以外').replace('V1.2 MAN候補・ダミー専用：実データ／実Backupを持ち込まないでください','V1.2 検証版・Restore対応：Backupの復元はこの端末内で行います')
  },generateBundle(){this.emitFile({type:'asset',fileName:'candidate-build.json',source:JSON.stringify({sourceSHA,origin,testOnly,restoreEnabled:true,db:'training-check-v12-local-man',pwaId:'/v12-local-man'})})}},...(local.plugins??[])],
  build:{...local.build,outDir:'dist-v12-worker'},
})
