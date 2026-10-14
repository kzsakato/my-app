import { useEffect, useRef, useState } from 'react'
import type { CanonicalAppData } from './canonical/types'
import { canonicalStorage, applyTrainerCanonical } from './data'
import { createTrainerContextV11, parseUniqueJson, previewTrainerProposal, trainerMessages as messages, type TrainerProposalPreview } from './canonical/trainerV11'

function download(name: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' }))
  const link = document.createElement('a'); link.href = url; link.download = name
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
type Props = { data: CanonicalAppData; onApplied: (data: CanonicalAppData) => void; onPending: (pending: boolean) => void }

export function TrainerPanel({ data, onApplied, onPending }: Props) {
  const [ready, setReady] = useState(false), [held, setHeld] = useState(false), [pending, setPending] = useState(false)
  const [input, setInput] = useState<unknown>(), [preview, setPreview] = useState<TrainerProposalPreview>()
  const [importMessage, setImportMessage] = useState<string>(messages.unselected), [exportMessage, setExportMessage] = useState('')
  const [diagnostic, setDiagnostic] = useState<object>(), [mapping, setMapping] = useState<Record<string, Record<string, string>>>()
  const generation = useRef(0), busy = useRef(false)
  useEffect(() => {
    let live = true
    canonicalStorage.readCutoverState().then(state => {
      if (!live) return
      if (state.trainerPendingProposalId) { setHeld(true); setImportMessage(messages.inconsistent); setDiagnostic({ stage: 'startup', code: 'UNRESOLVED_AI_APPLY', proposalId: state.trainerPendingProposalId }) }
      setReady(true)
    }).catch(() => { if (live) { setHeld(true); setReady(true); setImportMessage(messages.inconsistent); setDiagnostic({ stage: 'startup', code: 'STORAGE_READ_FAILED' }) } })
    return () => { live = false; generation.current++ }
  }, [])
  const read = async (file?: File) => {
    if (!file || held || busy.current || !ready) return
    const current = ++generation.current
    setInput(undefined); setPreview(undefined); setMapping(undefined); setDiagnostic(undefined)
    try {
      const state = await canonicalStorage.readCutoverState()
      if (current !== generation.current) return
      if (state.trainerPendingProposalId) { setHeld(true); setImportMessage(messages.inconsistent); setDiagnostic({ stage: 'preview', code: 'UNRESOLVED_AI_APPLY', proposalId: state.trainerPendingProposalId }); return }
      const value = parseUniqueJson(await file.text())
      if (current !== generation.current) return
      if (!value || typeof value !== 'object' || (value as { format?: unknown }).format !== 'training-project.trainer-proposal') { setImportMessage(messages.wrongFormat); return }
      const checked = previewTrainerProposal(value, data)
      setInput(value); setPreview(checked); setImportMessage('')
    } catch {
      if (current !== generation.current) return
      setImportMessage(messages.inconsistent); setDiagnostic({ stage: 'preview', code: 'PROPOSAL_VALIDATION_FAILED', at: new Date().toISOString() })
    }
  }
  const apply = async () => {
    if (busy.current || held || !ready || !preview || !input) return
    if (!confirm('この内容を取り込む')) return
    busy.current = true; setPending(true); onPending(true)
    try {
      const result = await applyTrainerCanonical(input)
      if (result.ok) {
        onApplied(result.value); setMapping(result.mapping); setImportMessage(messages.imported)
        setPreview(undefined); setInput(undefined)
      } else {
        setImportMessage(messages.inconsistent); setHeld(result.unknown)
        setDiagnostic({ stage: 'apply', code: result.unknown ? 'UNKNOWN' : 'REJECTED_ZERO_MUTATION', proposalId: preview.proposalId, at: new Date().toISOString() })
        setPreview(undefined); setInput(undefined)
      }
    } catch {
      setImportMessage(messages.inconsistent); setHeld(true); setPreview(undefined); setInput(undefined)
      setDiagnostic({ stage: 'apply', code: 'STORAGE_UNAVAILABLE_OR_UNKNOWN', at: new Date().toISOString() })
    } finally { busy.current = false; setPending(false); onPending(false) }
  }
  const exportContext = async () => {
    if (busy.current || held || !ready) return
    busy.current = true; setPending(true); onPending(true)
    try {
      const state = await canonicalStorage.readCutoverState()
      if (state.trainerPendingProposalId) { setHeld(true); setImportMessage(messages.inconsistent); setDiagnostic({ stage: 'export', code: 'UNRESOLVED_AI_APPLY', proposalId: state.trainerPendingProposalId }); return }
      const latest = await canonicalStorage.readCanonical()
      if (!latest) throw new Error('Missing canonical')
      const value = createTrainerContextV11(latest, new Date())
      download(`trainer-context-${value.exportedLocalDate}.json`, value)
      setExportMessage(`${value.history.length === 0 ? messages.empty + '\n' : ''}${messages.exported}`)
    } catch {
      setExportMessage(messages.exportFailed); setDiagnostic({ stage: 'export', code: 'CONTEXT_VALIDATION_OR_DOWNLOAD_FAILED', at: new Date().toISOString() })
    } finally { busy.current = false; setPending(false); onPending(false) }
  }
  return <div className="trainer-v11">
    <p className="meta">トレーナーとの相談に使う情報を渡したり、提案を受け取ったりできます。</p>
    <section className="card">
      <h2>提案を受け取る</h2>
      <p>トレーナーから受け取った提案ファイルを選びます。</p>
      <label>提案ファイルを選ぶ<input type="file" accept="application/json,.json" disabled={!ready || pending || held} onChange={event => void read(event.target.files?.[0])} /></label>
      {importMessage && <p role="status">{importMessage}</p>}
      {preview && <section className="trainer-preview">
        <h3>取り込む内容</h3>
        <p>種目 {preview.exercises.length}件／実施項目 {preview.trainingItems.length}件／週メニュー {preview.menus.length}件</p>
        {preview.exercises.map((name, index) => <p key={`ex-${index}`}>{name}</p>)}
        {preview.trainingItems.map((name, index) => <p key={`ti-${index}`}>{name}</p>)}
        {preview.menus.map((menu, index) => <div key={index}><b>{menu.name}</b>{menu.memo && <p>{menu.memo}</p>}{menu.entries.map((entry, index) => <p key={index}>{entry}</p>)}</div>)}
        {preview.settingsTargets.map((name, index) => <p key={`setting-${index}`}>設定を更新：{name}</p>)}
        {preview.washes.map((wash, index) => <p key={`wash-${index}`}>{wash.menu}：{wash.operation === 'MENU_ENTRY_REMOVE' ? '指定の実施項目を外す' : `実施項目を入れ替える（${wash.entryCount}件）`}</p>)}
        {preview.details.map((detail, index) => <section className="trainer-preview-detail" key={index}><h4>{detail.title}</h4><dl>{detail.values.map(([label, value], index) => <div key={index}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>)}
        <p>使用中の週メニューは切り替わりません。</p>
        <button className="primary" disabled={pending || held} onClick={() => void apply()}>この内容を取り込む</button>
      </section>}
      {mapping && <details><summary>保存結果を確認</summary>{Object.entries(mapping).map(([kind, values]) => <div key={kind}><b>{kind}</b>{Object.entries(values).map(([candidate, id]) => <p key={candidate}>{candidate} → {id}</p>)}</div>)}</details>}
    </section>
    <section className="card">
      <h2>トレーニング情報を渡す</h2>
      <p>直近100日分のトレーニング情報を、トレーナーに渡すファイルにまとめます。</p>
      <button className="primary" disabled={!ready || pending || held} onClick={() => void exportContext()}>トレーナー用ファイルを作る</button>
      {exportMessage && <p role="status" style={{ whiteSpace: 'pre-line' }}>{exportMessage}</p>}
    </section>
    {diagnostic && <button className="save-setting" onClick={() => download('trainer-diagnostic.json', diagnostic)}>診断情報を保存</button>}
  </div>
}

/** OFF is a separate Owner operation; never coupled to creating/deleting a Session. */
export function TrainerManagementOff({ data, commit, kind, id }: { data: CanonicalAppData; commit: (data: CanonicalAppData) => Promise<boolean>; kind: 'trainingItems' | 'menus'; id: string }) {
  const value = data[kind].find(value => value.id === id)
  const [pending, setPending] = useState(false), [failed, setFailed] = useState(false)
  if (!value || value.managementMode !== 'TRAINER') return null
  const off = async () => {
    if (pending || !confirm('自分で管理する設定に切り替えますか？')) return
    setPending(true)
    try {
      const next = { ...data, [kind]: data[kind].map(row => row.id === id ? { ...row, managementMode: 'MAN' as const } : row) }
      setFailed(!await commit(next))
    } finally { setPending(false) }
  }
  return <section className="trainer-off">
    <label className="check"><input type="checkbox" checked={false} disabled={pending} onChange={() => void off()} />トレーナー管理をOFFにする</label>
    <small>この版ではトレーナー管理に戻せません。</small>
    {failed && <><p role="alert">管理設定の変更を確認できません。</p><button className="save-setting" onClick={() => download('trainer-off-diagnostic.json', { stage: 'management-off', code: 'NOT_CONFIRMED', kind, id, at: new Date().toISOString() })}>診断情報を保存</button></>}
  </section>
}
