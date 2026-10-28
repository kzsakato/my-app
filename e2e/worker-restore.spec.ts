import {test,expect} from '@playwright/test'
import {canonicalBackupFixture} from '../src/canonical/fixtures'
import {previewCanonicalRestore} from '../src/canonical/backup'
import {mkdirSync,writeFileSync} from 'node:fs'
test('canonical V1.1 Backup normal Restore stays local, preserves confirmation and persists offline',async({page,context})=>{
 const origin=process.env.V12_RESTORE_URL??'http://localhost:4182'
 const directory=process.env.V12_RESTORE_EVIDENCE??'evidence/issue30-v12/restore/local'
 mkdirSync(directory,{recursive:true})
 await page.goto(origin+'/');await expect(page.getByRole('heading',{name:'今週の実施メニュー'})).toBeVisible()
 await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload()
 await page.getByRole('button',{name:'共通メニュー'}).click();await page.getByRole('button',{name:'設定',exact:true}).click();await page.getByRole('button',{name:/データ管理/}).click()
 await expect(page.getByText('復元すると全データを置き換えます。',{exact:false})).toBeVisible()
 const nonTarget=()=>page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(ok=>{const r=indexedDB.open('training-check-v12-local-man',7);r.onsuccess=()=>ok(r.result)});const out:Record<string,unknown>={};for(const n of [...db.objectStoreNames].filter(n=>n!=='canonical')){out[n]=await new Promise(ok=>{const r=db.transaction(n).objectStore(n).getAll();r.onsuccess=()=>ok(r.result)})}db.close();return out})
 const before=await nonTarget(),outgoing:{method:string;host:string;hasBody:boolean}[]=[]
 context.on('request',r=>outgoing.push({method:r.method(),host:new URL(r.url()).host,hasBody:!!r.postData()}))
 await context.setOffline(true)
 await page.getByLabel('正規バックアップを選択').setInputFiles({name:'existing-canonical-v11-test-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(canonicalBackupFixture))})
 await expect(page.getByRole('heading',{name:'復元内容の確認'})).toBeVisible()
 if(await page.getByLabel('警告内容を確認しました').count())await page.getByLabel('警告内容を確認しました').check()
 let confirmed=false
 page.once('dialog',async dialog=>{expect(dialog.message()).toContain('現在の正規データ全体を、このバックアップの内容で置き換えます');confirmed=true;await dialog.accept()})
 await page.getByRole('button',{name:'全データを置き換えて復元',exact:true}).click()
 await expect(page.getByRole('status')).toContainText('保存後の読み戻し一致')
 expect(confirmed).toBe(true);expect(await nonTarget()).toEqual(before)
 const read=()=>page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(ok=>{const r=indexedDB.open('training-check-v12-local-man',7);r.onsuccess=()=>ok(r.result)});const v=await new Promise(ok=>{const r=db.transaction('canonical').objectStore('canonical').get('app');r.onsuccess=()=>ok(r.result)});db.close();return v})
 const expected=previewCanonicalRestore(JSON.stringify(canonicalBackupFixture)).envelope!.payload
 expect(await read()).toEqual(expected)
 await page.reload();await expect(page.getByRole('heading',{name:'今週の実施メニュー'})).toBeVisible();expect(await read()).toEqual(expected)
 expect(outgoing.filter(r=>r.hasBody||r.method!=='GET'||r.host!==new URL(origin).host)).toEqual([])
 writeFileSync(directory+'/normal-restore.json',JSON.stringify({result:'PASS',usesOwnerData:false,fixture:'existing canonicalBackupFixture (schemaVersion1; optional displayPreferences absent)',offlineRestoreAndReload:true,fullReplacementConfirmation:true,readbackExact:true,nonCanonicalStoresUnchanged:true,dataRequests:outgoing.filter(r=>r.hasBody||r.method!=='GET').length},null,2)+'\n')
 await context.setOffline(false)
})
