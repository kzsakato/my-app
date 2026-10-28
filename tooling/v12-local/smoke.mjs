import { chromium } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import assert from 'node:assert/strict'
const dir = process.env.V12_SMOKE_DIR ?? 'evidence/issue30-v12/local-adb'
await mkdir(dir, { recursive: true })
const browser = await chromium.launch()
const result = { atUTC: new Date().toISOString(), runtime: await browser.version(), platform: process.platform, tests: [] }
const context = await browser.newContext({ locale: 'ja-JP', timezoneId: 'Asia/Tokyo' })
const page = await context.newPage()
context.setDefaultTimeout(15000)
const dbRead = async (page, name, store, key) => page.evaluate(async ({name,store,key}) => {
  const db = await new Promise((ok,no) => { const r=indexedDB.open(name,7);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error) })
  const v=await new Promise((ok,no)=>{const r=db.transaction(store).objectStore(store).get(key);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error) });db.close();return v
}, {name,store,key})
try {
  await page.goto('http://localhost:4182/')
  await page.getByRole('heading',{name:'今週の実施メニュー'}).waitFor()
  const state = await page.evaluate(async () => {
    const sw = await navigator.serviceWorker.ready
    return { secure: isSecureContext, origin: location.origin, dbs: await indexedDB.databases(), scope: sw.scope }
  })
  assert.equal(state.secure,true);assert.deepEqual(state.dbs.map(x=>x.name),['training-check-v12-local-man'])
  assert.equal(state.scope,'http://localhost:4182/')
  result.tests.push({name:'fresh DB canonical startup / secure context / scoped SW',state})
  const before = await dbRead(page,'training-check-v12-local-man','canonical','app')
  assert.equal(before.menus[0].name,'MANダミーメニュー')
  assert.equal((await dbRead(page,'training-check-v12-local-man','cutover','state')).authoritative,true)
  await page.reload();await page.getByRole('heading',{name:'今週の実施メニュー'}).waitFor()
  assert.deepEqual(await dbRead(page,'training-check-v12-local-man','canonical','app'),before)
  assert.equal(await page.evaluate(()=>!!navigator.serviceWorker.controller),true)
  await page.close();const reopened=await context.newPage();await reopened.goto('http://localhost:4182/')
  await reopened.getByRole('heading',{name:'今週の実施メニュー'}).waitFor()
  assert.deepEqual(await dbRead(reopened,'training-check-v12-local-man','canonical','app'),before)
  await reopened.screenshot({path:dir+'/pc.png',fullPage:true})
  result.tests.push({name:'reload and new tab preserve canonical/authority; SW controls page',pass:true,caches:await reopened.evaluate(()=>caches.keys())})
  const mf=await (await context.request.get('http://localhost:4182/manifest.webmanifest')).json()
  assert.equal(mf.id,'/v12-local-man');assert.equal(mf.scope,'/');assert.equal(mf.start_url,'/')
  result.tests.push({name:'dedicated manifest',manifest:mf})
  await reopened.getByRole('button',{name:'共通メニュー'}).click()
  await reopened.getByRole('button',{name:'設定',exact:true}).click()
  assert.match(await reopened.locator('body').innerText(),/V1.2 MAN候補/)
  await reopened.getByRole('button',{name:/データ管理/}).click()
  const backup=await (await context.request.get('http://localhost:4182/dummy-backup-warning.json')).body()
  await reopened.getByLabel('正規バックアップを選択').setInputFiles({name:'dummy-backup-warning.json',mimeType:'application/json',buffer:backup})
  await reopened.getByRole('button',{name:'全データを置き換えて復元',exact:true}).waitFor()
  assert.equal(await reopened.getByRole('button',{name:'全データを置き換えて復元',exact:true}).isDisabled(),true)
  assert.deepEqual(await dbRead(reopened,'training-check-v12-local-man','canonical','app'),before)
  await reopened.screenshot({path:dir+'/backup-preview.png',fullPage:true})
  result.tests.push({name:'dummy malformed preferences Backup preview only; restore disabled and data unchanged',pass:true})
  const response=await context.request.get('http://127.0.0.1:4182/')
  assert.equal(response.status(),403)
  result.tests.push({name:'HTTP wrong Host rejected',status:response.status()})
  const wrong=await browser.newContext();const wp=await wrong.newPage()
  await wp.route('http://127.0.0.1:4182/**',async route=>{
    const pathname=new URL(route.request().url()).pathname
    const file=resolve(process.env.V12_SMOKE_DIST ?? 'dist-v12-local','.'+(pathname==='/'?'/index.html':pathname))
    await route.fulfill({body:await readFile(file),contentType:extname(file)==='.js'?'text/javascript':'text/html'})
  })
  await wp.goto('http://127.0.0.1:4182/')
  await wp.getByText(/検証.*以外では起動しません/).waitFor()
  assert.deepEqual(await wp.evaluate(()=>indexedDB.databases()),[])
  result.tests.push({name:'wrong-origin artifact execution fails before any DB access',pass:true});await wrong.close()
  const occupied=await browser.newContext();const op=await occupied.newPage()
  await op.route('**/blank',r=>r.fulfill({body:'<html></html>',contentType:'text/html'}));await op.goto('http://localhost:4182/blank')
  await op.evaluate(async()=>{
    for(const name of ['training-check','training-check-v1r11-candidate','training-check-v12-local-man']) {
      const db=await new Promise(ok=>{const r=indexedDB.open(name,7);r.onupgradeneeded=()=>{for(const s of ['state','recovery','canonical','cutover','baseline'])r.result.createObjectStore(s)};r.onsuccess=()=>ok(r.result)})
      await new Promise(ok=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put({dummySentinel:name},'sentinel');tx.oncomplete=ok});db.close()
    }
  })
  await op.goto('http://localhost:4182/');await op.getByText('既存検証DBを変更せず停止しました',{exact:false}).waitFor()
  for(const name of ['training-check','training-check-v1r11-candidate','training-check-v12-local-man'])assert.deepEqual(await dbRead(op,name,'state','sentinel'),{dummySentinel:name})
  assert.equal(await dbRead(op,'training-check-v12-local-man','canonical','app'),undefined)
  result.tests.push({name:'occupied non-authoritative DB fails closed; no seed/clear; other dummy DB sentinels unchanged',pass:true})
  await occupied.close()
  result.result='PASS'
} catch(e) {result.result='FAIL';result.error=String(e);process.exitCode=1}
finally {await context.close();await browser.close();await writeFile(dir+'/smoke.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2))}
