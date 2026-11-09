import { useEffect, useState } from 'react'
import { CanonicalApp, downloadJson } from './CanonicalApp'
import { previewInitialV13Restore } from './canonical/backupV13'
import { readV13Canonical, restoreInitialV13 } from './data'
import type { CanonicalAppData } from './canonical/types'

export const v13UnknownMessage = '保存結果を確認できません。再実行せず、診断情報を保存してください。'

export function IsolatedV13App() {
  const [data, setData] = useState<CanonicalAppData>()
  const [ready, setReady] = useState(false)
  const [held, setHeld] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<{ raw: string } & ReturnType<typeof previewInitialV13Restore>>()
  useEffect(() => {
    readV13Canonical().then(value => { setData(value); setReady(true) }, error => {
      setMessage(String(error)); setHeld(true)
    })
  }, [])
  if (data) return <CanonicalApp initial={data} />
  return <main className="app">
    <h1>データ管理</h1>
    {held ? <>
      <p role="alert">{v13UnknownMessage}</p>
      <button className="save-setting" onClick={() => downloadJson('v13-restore-diagnostic.json', { stage: 'initial-restore', code: 'UNKNOWN_HELD', message })}>診断情報を保存</button>
    </> : ready && <>
      <label>正規バックアップを選択<input type="file" accept=".json,application/json" disabled={busy} onChange={async event => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return
        setPreview(undefined)
        setMessage('')
        setBusy(true)
        try {
          const raw = await file.text()
          setPreview({ raw, ...previewInitialV13Restore(raw) })
        } catch (error) { setMessage(String(error)) }
        finally { setBusy(false) }
      }} /></label>
      {preview && <section>
        <h2>復元内容の確認</h2>
        <p>復元するとV1.3検証環境の全データを置き換えます。V1.2の元のバックアップは保管してください。初回寄与率は未設定です。</p>
        <p>種目 {preview.candidate.exercises.length} 件 ／ 実施記録 {preview.candidate.sessions.length} 件</p>
        <ul>{preview.warnings.map(issue => <li key={issue.path}>{issue.message}</li>)}</ul>
        <button disabled={busy} onClick={() => setPreview(undefined)}>取消</button>
        <button className="primary" disabled={busy} onClick={async () => {
          setBusy(true)
          const result = await restoreInitialV13(preview.raw, preview.candidate)
          setPreview(undefined)
          setBusy(false)
          if (result.status === 'SUCCESS') setData(result.value)
          else { setMessage(result.reason); setHeld(result.status === 'UNKNOWN_HELD') }
        }}>復元する</button>
      </section>}
    </>}
    {message && <p role="status">{message}</p>}
  </main>
}
