import { execFileSync,spawnSync } from 'node:child_process'
import { mkdirSync,cpSync,readFileSync,writeFileSync,existsSync } from 'node:fs'
import { resolve,join } from 'node:path'
import { createServer } from 'node:net'
import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
const base=resolve('../owner-launcher-test-'+Date.now());mkdirSync(base,{recursive:true})
const compiler=join(process.env.WINDIR,'Microsoft.NET','Framework64','v4.0.30319','csc.exe'),fake=join(base,'fake-adb.exe')
execFileSync(compiler,['/nologo','/out:'+fake,resolve('tooling/v12-local/fake-adb.cs')])
const tests=[]
function setup(name,mode='ok'){
  const dir=join(base,name);cpSync('../v12-owner-package',dir,{recursive:true})
  const env={...process.env,V12_ADB_PATH:fake,FAKE_ADB_DIR:dir,FAKE_ADB_MODE:mode}
  const command=action=>{const r=spawnSync(process.execPath,[join(dir,'control.mjs'),action],{env,encoding:'utf8',timeout:15000,windowsHide:true});return {status:r.status,text:r.stdout+r.stderr}}
  return {dir,env,command}
}
const delay=()=>new Promise(r=>setTimeout(r,300))
for(const mode of ['none','unauthorized','multiple']){
  const t=setup(mode,mode),r=t.command('start');assert.equal(r.status,1);assert(!existsSync(join(t.dir,'session.private.json')));assert(!existsSync(join(t.dir,'run/session.private.json')));assert(!existsSync(join(t.dir,'mapping.txt')));tests.push({name:mode,pass:true})
}
{
  const t=setup('missing-adb');t.env.V12_ADB_PATH=join(base,'not-there');t.env.PATH='';t.env.LOCALAPPDATA=base;t.env.ANDROID_HOME=base;t.env.ANDROID_SDK_ROOT=base
  assert.equal(t.command('start').status,1);assert(!existsSync(join(t.dir,'mapping.txt')));tests.push({name:'ADB missing; no install/mapping',pass:true})
}
{
  const t=setup('existing-mapping');writeFileSync(join(t.dir,'mapping.txt'),'tcp:4182 tcp:9999');assert.equal(t.command('start').status,1);assert.equal(readFileSync(join(t.dir,'mapping.txt'),'utf8'),'tcp:4182 tcp:9999');tests.push({name:'existing mapping unchanged',pass:true})
}
{
  const t=setup('hash-mismatch');writeFileSync(join(t.dir,'site/index.html'),'wrong');assert.equal(t.command('start').status,1);assert(!existsSync(join(t.dir,'mapping.txt')));tests.push({name:'artifact hash mismatch stops before mapping',pass:true})
}
{
  const occupied=createServer();await new Promise(r=>occupied.listen(4182,'127.0.0.1',r));const t=setup('occupied-port');assert.equal(t.command('start').status,1);assert(!existsSync(join(t.dir,'mapping.txt')));await new Promise(r=>occupied.close(r));tests.push({name:'occupied port does not kill unrelated listener',pass:true})
}
{
  const t=setup('success'),r=t.command('start');assert.equal(r.status,0,r.text)
  const path=join(t.dir,'run/session.private.json'),s=JSON.parse(readFileSync(path,'utf8'))
  const health=await(await fetch('http://localhost:4182/__session')).json();assert.equal(health.pid,s.pid)
  const manifest=await(await fetch('http://localhost:4182/manifest.webmanifest')).json();assert.equal(manifest.id,'/v12-local-man')
  const free=createServer();await new Promise((ok,no)=>{free.once('error',no);free.listen(9338,'127.0.0.1',()=>free.close(ok))})
  const browser=await chromium.launch({args:['--remote-debugging-port=9338','--remote-debugging-address=127.0.0.1']})
  try{
    const page=await browser.newPage();await page.goto('http://localhost:4182/');await page.getByRole('heading',{name:'今週の実施メニュー'}).waitFor({timeout:10000});await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload()
    const checked=t.command('check');assert.equal(checked.status,0,checked.text)
    const readback=JSON.parse(readFileSync(join(t.dir,'run/result.json'),'utf8'));assert.equal(readback.facts.db.authoritative,true);assert.equal(readback.facts.sw.controller,'http://localhost:4182/sw.js');assert(!existsSync(join(t.dir,'forward.txt')))
    tests.push({name:'PC CDP read-only candidate collector + synthetic ADB forward cleanup (not Android)',pass:true,facts:readback.facts})
  }finally{await browser.close()}
  assert.equal(t.command('start').status,1);assert.equal(JSON.parse(readFileSync(path,'utf8')).session,s.session)
  writeFileSync(path,JSON.stringify({...s,pid:process.pid}));assert.equal(t.command('stop').status,1);assert.equal((await(await fetch('http://localhost:4182/__session')).json()).pid,s.pid)
  writeFileSync(path,JSON.stringify(s));writeFileSync(join(t.dir,'mapping.txt'),'tcp:4182 tcp:9999');assert.equal(t.command('stop').status,1);assert.equal(readFileSync(join(t.dir,'mapping.txt'),'utf8'),'tcp:4182 tcp:9999')
  writeFileSync(join(t.dir,'mapping.txt'),'tcp:4182 tcp:4182');await delay();assert.equal(t.command('stop').status,0);assert(!existsSync(path));assert(!existsSync(join(t.dir,'mapping.txt')));assert.equal(t.command('stop').status,0)
  tests.push({name:'start/read-back, duplicate start, PID mismatch, changed mapping preservation, owned cleanup and duplicate stop',pass:true})
}
mkdirSync('evidence/issue30-v12/owner-launcher',{recursive:true})
writeFileSync('evidence/issue30-v12/owner-launcher/tests.json',JSON.stringify({atUTC:new Date().toISOString(),platform:process.platform,node:process.version,adb:'synthetic executable; no Android accessed',tests,result:'PASS'},null,2)+'\n')
console.log(JSON.stringify(tests))
