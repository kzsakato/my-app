import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, extname } from 'node:path'
import { chromium, expect } from '@playwright/test'
const root=resolve('dist')
const server=createServer((req,res)=>{
 const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname)
 const file=resolve(root,path.replace(/^\/my-app\//,'')||'index.html')
 if(!file.startsWith(root)||!existsSync(file)){res.writeHead(404).end();return}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.webmanifest':'application/manifest+json'})[extname(file)]||'application/octet-stream')
 res.end(readFileSync(file))
})
await new Promise(r=>server.listen(4199,'127.0.0.1',r))
const browser=await chromium.launch()
try{
 const page=await browser.newPage()
 await page.goto('http://127.0.0.1:4199/my-app/')
 await page.waitForFunction(async()=> (await indexedDB.databases()).some(db=>db.name==='training-check'))
 const latest=JSON.parse(readFileSync('evidence/issue35-v13/synthetic-initial-backup.json','utf8'))
 const seed=structuredClone(latest.payload)
 await page.evaluate(async data=>{
  const r=indexedDB.open('training-check',7)
  const db=await new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})
  const tx=db.transaction(['canonical','cutover'],'readwrite')
  tx.objectStore('canonical').put(data,'app');tx.objectStore('cutover').put({authoritative:true},'state')
  await new Promise((ok,no)=>{tx.oncomplete=ok;tx.onabort=()=>no(tx.error)})
  db.close()
 },seed)
 const read=()=>page.evaluate(async()=>{
  const r=indexedDB.open('training-check',7)
  const db=await new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})
  try{const tx=db.transaction(['canonical','cutover']);return await Promise.all(['canonical','cutover'].map(name=>{
   const q=tx.objectStore(name).get(name==='canonical'?'app':'state')
   return new Promise((ok,no)=>{q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)})
  }))}finally{db.close()}
 })
 const settings=async()=>{await page.getByRole('button',{name:'共通メニュー'}).click();await page.getByRole('button',{name:'設定',exact:true}).click()}
 const route=async name=>{await settings();await page.getByRole('button',{name}).click()}
 await page.reload()
 await route(/^データ管理/)
 latest.payload.trainerDataRevision=7;latest.payload.appliedProposalIds=['prior-one','prior-two']
 latest.payload.contributions.byExerciseId['ex-A']={revision:2,rates:{chest:100,back:0,arms:0,shoulders:0,lowerBody:0,core:0}}
 await page.getByLabel('正規バックアップを選択').setInputFiles({name:'latest.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(latest))})
 await page.getByRole('heading',{name:'復元内容の確認'}).waitFor()
 if(await page.getByLabel('警告内容を確認しました').count())await page.getByLabel('警告内容を確認しました').check()
 page.once('dialog',d=>d.accept())
 await page.getByRole('button',{name:'全データを置き換えて復元'}).click()
 await page.getByRole('status').filter({hasText:'復元しました。'}).waitFor()
 const restored=await read()
 expect(restored[0]).toEqual(latest.payload)
 const exportFile=async name=>{const event=page.waitForEvent('download');await page.getByRole('button',{name,exact:true}).click();return JSON.parse(readFileSync(await (await event).path(),'utf8'))}
 const backup=await exportFile('バックアップを作成')
 expect(backup.schemaVersion).toBe(2);expect(backup.payload).toEqual(latest.payload)
 await route(/^分析/);await page.getByRole('heading',{name:'6部位の推移',exact:true}).waitFor()
 await route(/^トレーナー連携/)
 const context=await exportFile('トレーナー用ファイルを作る')
 expect(context.version).toBe(2);expect(context.trainingContext.trainerDataRevision).toBe(7)
 const proposal=JSON.parse(readFileSync('evidence/issue35-v13/synthetic-initial-proposal.json','utf8'))
 proposal.proposalId='root-initial';proposal.baseRevision=7;proposal.operations=[proposal.operations[1]]
 await page.getByLabel('提案ファイルを選ぶ').setInputFiles({name:'initial.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(proposal))})
 await page.getByText('初回寄与率を登録しました。',{exact:true}).waitFor()
 const expected=structuredClone(latest.payload)
 expected.trainerDataRevision=8;expected.appliedProposalIds.push(proposal.proposalId)
 expected.contributions.byExerciseId['ex-B']={revision:1,rates:proposal.operations[0].rates}
 const afterProposal=await read();expect(afterProposal[0]).toEqual(expected)
 const invalid={...proposal,proposalId:'root-valid-overwrite',baseRevision:8,operations:[{
   ...proposal.operations[0],exerciseId:'ex-A'
 }]}
 await page.getByLabel('提案ファイルを選ぶ').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(invalid))})
 await page.getByRole('button',{name:'診断情報を保存'}).waitFor()
 expect(await read()).toEqual(afterProposal)

 await route(/^プロフィール/)
 await page.getByRole('spinbutton',{name:/体重/}).fill('67.5')
 await page.getByRole('button',{name:'保存',exact:true}).click()
 expected.profile.weight=67.5;expected.trainerDataRevision=9
 await expect.poll(read).toEqual([expected,restored[1]])
 await page.reload()
 const continued=await read();expect(continued).toEqual([expected,restored[1]])
 console.log(JSON.stringify({status:'PASS',backupVersion:backup.schemaVersion,contextVersion:context.version,revisions:[7,8,9],restored,afterProposal,continued},null,2))
}finally{await browser.close();await new Promise(r=>server.close(r))}
