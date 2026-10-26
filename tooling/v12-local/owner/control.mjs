import { existsSync,readFileSync,writeFileSync,mkdirSync,openSync,closeSync,unlinkSync } from 'node:fs'
import { join,dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync,spawn } from 'node:child_process'
import { randomUUID,createHash } from 'node:crypto'
import { createServer } from 'node:net'
import { collect } from './collect.mjs'
const root=dirname(fileURLToPath(import.meta.url)),run=join(root,'run'),stateFile=join(run,'session.private.json')
mkdirSync(run,{recursive:true})
const evidence={atUTC:new Date().toISOString(),action:process.argv[2],result:'FAIL',androidMeasured:false}
const save=()=>writeFileSync(join(run,'result.json'),JSON.stringify(evidence,null,2)+'\n')
const fail=message=>{throw Error(message)}
function adbFind(){
  const candidates=[process.env.V12_ADB_PATH,join(root,'platform-tools','adb.exe'),process.env.ANDROID_HOME&&join(process.env.ANDROID_HOME,'platform-tools','adb.exe'),process.env.ANDROID_SDK_ROOT&&join(process.env.ANDROID_SDK_ROOT,'platform-tools','adb.exe'),process.env.LOCALAPPDATA&&join(process.env.LOCALAPPDATA,'Android','Sdk','platform-tools','adb.exe')].filter(Boolean)
  try{candidates.push(...execFileSync('where.exe',['adb'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','ignore']}).trim().split(/\r?\n/))}catch{}
  return candidates.find(p=>existsSync(p))??fail('ADB未検出。READMEの既存ADB/公式Platform-Tools案内を確認してください。自動導入しません。')
}
function call(adb,args){try{return execFileSync(adb,args,{encoding:'utf8',windowsHide:true,timeout:10000,stdio:['ignore','pipe','pipe']}).trim()}catch{fail('ADBコマンド不成立。USB接続/RSA許可/driverを確認して担当へ返してください。自動再試行しません。')}}
const mappings=(adb,serial)=>call(adb,['-s',serial,'reverse','--list']).split(/\r?\n/).filter(Boolean).map(x=>x.trim().split(/\s+/).slice(-2))
const ownedMap=(adb,serial)=>mappings(adb,serial).some(([a,b])=>a==='tcp:4182'&&b==='tcp:4182')
function removeForward(s){
  const rows=call(s.adb,['forward','--list']).split(/\r?\n/).filter(Boolean).map(x=>x.trim().split(/\s+/))
  const row=rows.find(x=>x[1]==='tcp:'+s.forwardPort)
  if(row&&(row[0]!==s.serial||row[2]!=='localabstract:chrome_devtools_remote'))fail('検証forward変更済み。解除しません。')
  if(row)call(s.adb,['-s',s.serial,'forward','--remove','tcp:'+s.forwardPort])
  s.forwardPort=null;persist(s)
}
const health=async()=>{try{const r=await fetch('http://localhost:4182/__session',{signal:AbortSignal.timeout(1200)});return await r.json()}catch{return null}}
const alive=pid=>{try{process.kill(pid,0);return true}catch{return false}}
function persist(s){writeFileSync(stateFile,JSON.stringify(s,null,2))}
function verifyFiles(){
  const manifest=JSON.parse(readFileSync(join(root,'artifact.json'),'utf8'))
  for(const f of manifest.files){const p=join(root,'site',f.path);if(!existsSync(p)||createHash('sha256').update(readFileSync(p)).digest('hex')!==f.sha256)fail('同梱artifact hash不一致。起動せず担当へ返してください。')}
  evidence.sourceSHA=manifest.sourceSHA;evidence.inventorySHA256=manifest.inventorySHA256
}
async function stop(){
  if(!existsSync(stateFile)){evidence.result='ALREADY_STOPPED';return}
  const s=JSON.parse(readFileSync(stateFile,'utf8')),h=await health()
  if(s.pid&&alive(s.pid)){
    if(!h||h.pid!==s.pid||h.session!==s.session)fail('PID/起動session照合不一致。他processは停止しません。')
    process.kill(s.pid)
  }
  if(s.mappingOwned){
    if(ownedMap(s.adb,s.serial)){call(s.adb,['-s',s.serial,'reverse','--remove','tcp:4182']);s.mappingOwned=false;persist(s)}
    else if(mappings(s.adb,s.serial).some(([a])=>a==='tcp:4182'))fail('4182 mappingが変更済み。解除せず担当へ返してください。')
  }
  if(s.forwardPort)removeForward(s)
  unlinkSync(stateFile);evidence.result='STOPPED_OWN_SESSION_ONLY'
}
async function check(){
  verifyFiles()
  if(!existsSync(stateFile))fail('先にSTART.cmdで起動してください')
  const s=JSON.parse(readFileSync(stateFile,'utf8')),h=await health()
  if(!h||h.pid!==s.pid||h.session!==s.session)fail('起動session不一致')
  if(s.forwardPort)fail('前回の検証forwardが残っています。STOP.cmdで照合してください')
  const port=call(s.adb,['-s',s.serial,'forward','--no-rebind','tcp:0','localabstract:chrome_devtools_remote'])
  if(!/^\d+$/.test(port))fail('CDP forward port不明。自動再試行しません')
  s.forwardPort=Number(port);persist(s)
  try{
    const facts=await collect(s.forwardPort)
    evidence.facts=facts
    evidence.result=facts.secure&&facts.db.authoritative&&facts.sw.controller==='http://localhost:4182/sw.js'&&facts.sw.scopes.includes('http://localhost:4182/')?'ANDROID_TAB_SW_DB_READ_PASS':'ANDROID_TAB_SW_DB_READ_FAIL'
    evidence.androidMeasured=true
    writeFileSync(join(run,'android-check-'+Date.now()+'.json'),JSON.stringify(evidence,null,2))
  }finally{removeForward(s)}
}
async function start(){
  if(Number(process.versions.node.split('.')[0])<22)fail('Node.js 22以上が必要です。無断インストールせず担当へ返してください。')
  if(existsSync(stateFile))fail('起動stateあり。先に終了.cmdを実行してください。再起動/上書きしません。')
  verifyFiles()
  await new Promise((ok,no)=>{const server=createServer();server.once('error',()=>no(Error('4182ポート使用中。他processは停止しません。')));server.listen(4182,'127.0.0.1',()=>server.close(ok))})
  const adb=adbFind(),rows=call(adb,['devices']).split(/\r?\n/).filter(x=>x.trim()&&!x.startsWith('List of devices')&&!x.startsWith('*')).map(x=>x.trim().split(/\s+/))
  if(rows.length!==1||rows[0][1]!=='device')fail('対象端末1台のdevice状態が必要です。USB接続/RSA許可、複数台接続を確認してください。')
  const serial=rows[0][0]
  if(call(adb,['-d','get-state'])!=='device')fail('USB端末を確認できません。無線/エミュレータへは設定しません。')
  if(mappings(adb,serial).some(([a])=>a==='tcp:4182'))fail('既存4182 reverseあり。上書き/解除せず停止します。')
  const s={session:randomUUID(),adb,serial,mappingOwned:false,pid:null};persist(s)
  try{
    call(adb,['-s',serial,'reverse','--no-rebind','tcp:4182','tcp:4182']);s.mappingOwned=true;persist(s)
    if(!ownedMap(adb,serial))fail('reverse read-back不一致')
    const log=openSync(join(run,'server.log'),'a')
    const child=spawn(process.execPath,[join(root,'server.mjs')],{cwd:root,env:{...process.env,V12_SESSION_ID:s.session},detached:true,windowsHide:true,stdio:['ignore',log,log]});closeSync(log)
    s.pid=child.pid;persist(s);child.unref()
    let h=null;for(let i=0;i<20;i++){h=await health();if(h?.pid===s.pid&&h.session===s.session)break;await new Promise(r=>setTimeout(r,100))}
    if(!h||h.pid!==s.pid||h.session!==s.session)fail('ローカルserver起動照合不成立')
    const mf=await(await fetch('http://localhost:4182/manifest.webmanifest')).json()
    if(mf.id!=='/v12-local-man'||mf.scope!=='/'||mf.start_url!=='/')fail('manifest不一致')
    evidence.manifest=mf;evidence.mapping='tcp:4182 -> tcp:4182';evidence.url='http://localhost:4182/';evidence.result='PC_SERVE_AND_REVERSE_READY_ANDROID_UNMEASURED'
  }catch(e){try{await stop()}catch{evidence.cleanup='終了.cmdでstate照合が必要'}throw e}
}
try{
  if(process.argv[2]==='start')await start();else if(process.argv[2]==='stop')await stop();else if(process.argv[2]==='check')await check();else fail('start/stop/checkのみ対応')
  console.log(evidence.result)
  if(process.argv[2]==='start')console.log('Android Chromeで http://localhost:4182/ を開き、V1.2 MAN候補・ダミー表示を確認してください。Android/PWA実測・MAN開始は未承認です。')
}catch(e){evidence.message=e.message;console.error(e.message);process.exitCode=1}finally{save()}
