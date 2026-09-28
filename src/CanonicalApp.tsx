import { useMemo, useState } from 'react'
import { canonicalStorage } from './data'
import { addTrainingItem, appendMenuEntry, archiveMenuEntry, createCanonicalSession, createInitialCanonicalCandidate, cutoverCanonical, localDate, prepareCanonicalBackupRestore, prepareCanonicalCutover, recoverCanonical, updateTrainingItem, weekStart } from './canonical'
import type { CanonicalAppData, Exercise, Menu, MenuEntry, RecommendedDay, TrainingItem } from './canonical'
import { validateCanonical } from './canonical'

type Page = 'top' | 'run' | 'extra' | 'settings' | 'history'
const days = ['月', '火', '水', '木', '金', '土', '日']
const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
const clone = <T,>(value: T): T => structuredClone(value)
const active = <T extends { lifecycle: string }>(rows: T[]) => rows.filter(value => value.lifecycle === 'active')

function Header({ title, back, onSettings, onTop }: { title: string; back?: () => void; onSettings: () => void; onTop: () => void }) {
  return <header className="app-header"><button className={`header-back ${back ? '' : 'header-blank'}`} disabled={!back} onClick={back}>‹ 戻る</button><h1>{title}</h1><div className="header-menu"><button className="header-menu-button" aria-label="共通メニュー" onClick={onTop}>≡</button></div></header>
}

function Frame({ title, children, back, onSettings, onTop }: { title: string; children: React.ReactNode; back?: () => void; onSettings: () => void; onTop: () => void }) {
  return <main className="app"><Header title={title} back={back} onSettings={onSettings} onTop={onTop}/>{children}</main>
}

function entryLabel(entry: MenuEntry, item: TrainingItem, exercise: Exercise) {
  return `${item.displayName || exercise.name}${entry.recommendedDay === undefined ? '（任意）' : `（推奨：${days[entry.recommendedDay]}）`}`
}

export function CanonicalApp({ initial }: { initial: CanonicalAppData }) {
  const [data, setData] = useState(initial)
  const [page, setPage] = useState<Page>('top')
  const [runEntryId, setRunEntryId] = useState<string>()
  const [extraItemId, setExtraItemId] = useState<string>()
  const [notice, setNotice] = useState('')
  const commit = async (next: CanonicalAppData) => {
    const checked = validateCanonical(next)
    if (checked.errors.length) { setNotice(`保存できません: ${checked.errors.map(value => `${value.path} ${value.message}`).join(' / ')}`); return false }
    try { await canonicalStorage.writeCanonical(next); setData(next); setNotice('保存しました。'); return true }
    catch (error) { setNotice(`保存に失敗しました: ${String(error)}`); return false }
  }
  const toTop = () => { setPage('top'); setRunEntryId(undefined); setExtraItemId(undefined) }
  const exerciseFor = (item: TrainingItem) => data.exercises.find(value => value.id === item.exerciseId)
  const activeMenu = data.menus.find(value => value.id === data.activeMenuId && value.lifecycle === 'active')
  const finish = async (session: ReturnType<typeof createCanonicalSession>) => {
    if (await commit({ ...data, sessions: [...data.sessions, session] })) toTop()
  }
  const header = { onSettings: () => setPage('settings'), onTop: toTop }

  if (page === 'run' && runEntryId) {
    const entry = data.menuEntries.find(value => value.id === runEntryId)
    const item = entry && data.trainingItems.find(value => value.id === entry.trainingItemId)
    const exercise = item && exerciseFor(item)
    if (entry && item && exercise) return <RunPage data={data} entry={entry} item={item} exercise={exercise} onBack={toTop} onComplete={finish} {...header}/>
    return <Frame title="実行できません" back={toTop} {...header}><p>実施項目または種目を解決できません。</p></Frame>
  }
  if (page === 'extra' && extraItemId) {
    const item = data.trainingItems.find(value => value.id === extraItemId)
    const exercise = item && exerciseFor(item)
    if (item && exercise) return <RunPage data={data} item={item} exercise={exercise} onBack={() => setPage('extra')} onComplete={finish} {...header}/>
  }
  if (page === 'extra') return <ExtraPage data={data} onBack={toTop} onChoose={id => { setExtraItemId(id); setPage('extra') }} {...header}/>
  if (page === 'history') return <HistoryPage data={data} onBack={toTop} {...header}/>
  if (page === 'settings') return <SettingsPage data={data} commit={commit} onBack={toTop} {...header}/>

  const entries = activeMenu ? data.menuEntries.filter(value => value.menuId === activeMenu.id && value.lifecycle === 'active').sort((a, b) => a.order - b.order) : []
  const today = localDate()
  const start = weekStart(today, data.weekStartsOn)
  const completed = new Set(data.sessions.filter(value => value.date >= start && value.menuEntryId).map(value => value.menuEntryId))
  return <Frame title="今週の実施メニュー" {...header}>
    {notice && <p className="week">{notice}</p>}
    <label>週メニュー<select value={activeMenu?.id ?? ''} onChange={async event => { const id = event.target.value || undefined; await commit({ ...data, activeMenuId: id }) }}><option value="">選択してください</option>{active(data.menus).map(menu => <option key={menu.id} value={menu.id}>{menu.name}</option>)}</select></label>
    {!activeMenu && <section className="card"><p>有効な週メニューがありません。</p><button className="primary" onClick={() => setPage('settings')}>設定を開く</button></section>}
    {activeMenu && <><p className="week">{activeMenu.memo || '推奨曜日は目安です。予定外の実施も記録できます。'}</p><h2>実施項目</h2>{entries.map(entry => { const item = data.trainingItems.find(value => value.id === entry.trainingItemId); const exercise = item && exerciseFor(item); if (!item || !exercise || item.lifecycle !== 'active') return null; const done = completed.has(entry.id); return <button className="row" key={entry.id} onClick={() => { setRunEntryId(entry.id); setPage('run') }}><span><b>{entryLabel(entry, item, exercise)}</b><small>{done ? '今週実施済み' : `${exercise.measureType === 'reps' ? `${item.weight ?? 0} kg × ${item.reps ?? 0} 回` : `${item.seconds ?? 0} 秒`} × ${item.sets} セット`}</small></span><span>{done ? '✓' : '›'}</span></button> })}</>}
    <button className="primary" onClick={() => setPage('extra')}>＋ 追加トレーニング</button>
    <button className="save-setting" onClick={() => setPage('history')}>実施履歴を見る</button>
  </Frame>
}

function RunPage({ data, entry, item, exercise, onBack, onComplete, onSettings, onTop }: { data: CanonicalAppData; entry?: MenuEntry; item: TrainingItem; exercise: Exercise; onBack: () => void; onComplete: (session: ReturnType<typeof createCanonicalSession>) => void; onSettings: () => void; onTop: () => void }) {
  const [weight, setWeight] = useState(item.weight ?? 0)
  const [reps, setReps] = useState(item.reps ?? 0)
  const [seconds, setSeconds] = useState(item.seconds ?? 0)
  const [sets, setSets] = useState(item.sets)
  const [seat, setSeat] = useState(item.seat ?? '')
  const [memo, setMemo] = useState('')
  const complete = () => {
    if (!Number.isInteger(sets) || sets <= 0 || (exercise.measureType === 'reps' && (!Number.isInteger(reps) || reps <= 0)) || (exercise.measureType === 'time' && (!Number.isInteger(seconds) || seconds <= 0))) { alert('回数または時間、セット数は1以上で入力してください。'); return }
    onComplete(createCanonicalSession({ id: uid(), item, exercise, date: localDate(), weight: exercise.usesWeight ? weight : undefined, reps: exercise.measureType === 'reps' ? reps : undefined, seconds: exercise.measureType === 'time' ? seconds : undefined, sets, bodyWeight: data.profile.weight, seat: seat || undefined, memo: memo || undefined, menuEntryId: entry?.id }))
  }
  return <Frame title={item.displayName} back={onBack} onSettings={onSettings} onTop={onTop}>
    <p className="week">{entry ? `週メニュー: ${entry.recommendedDay === undefined ? '任意' : `推奨 ${days[entry.recommendedDay]}`}` : '追加トレーニング'}</p>
    {exercise.usesWeight && <label>重量 (kg)<input type="number" step="0.25" min="0" value={weight} onChange={event => setWeight(Number(event.target.value))}/></label>}
    {exercise.measureType === 'reps' ? <label>回数<input type="number" min="1" value={reps} onChange={event => setReps(Number(event.target.value))}/></label> : <label>時間 (秒)<input type="number" min="1" step="10" value={seconds} onChange={event => setSeconds(Number(event.target.value))}/></label>}
    <label>実施セット数<input type="number" min="1" value={sets} onChange={event => setSets(Number(event.target.value))}/></label>
    <label>シート位置<input value={seat} onChange={event => setSeat(event.target.value)}/></label>
    <label>今回メモ<input value={memo} onChange={event => setMemo(event.target.value)}/></label>
    <button className="primary" onClick={complete}>種目を完了</button>
  </Frame>
}

function ExtraPage({ data, onBack, onChoose, onSettings, onTop }: { data: CanonicalAppData; onBack: () => void; onChoose: (id: string) => void; onSettings: () => void; onTop: () => void }) {
  return <Frame title="追加トレーニング" back={onBack} onSettings={onSettings} onTop={onTop}>
    <p className="week">週メニュー外の実施として保存します。</p>{active(data.trainingItems).map(item => { const exercise = data.exercises.find(value => value.id === item.exerciseId); return exercise && <button className="row" key={item.id} onClick={() => onChoose(item.id)}><span><b>{item.displayName}</b><small>{exercise.name}</small></span><span>›</span></button> })}
  </Frame>
}

function HistoryPage({ data, onBack, onSettings, onTop }: { data: CanonicalAppData; onBack: () => void; onSettings: () => void; onTop: () => void }) {
  const rows = [...data.sessions].sort((left, right) => right.date.localeCompare(left.date))
  return <Frame title="実施履歴" back={onBack} onSettings={onSettings} onTop={onTop}>{rows.length === 0 ? <p className="week">実施履歴はまだありません。</p> : rows.map(session => <section className="card" key={session.id}><b>{session.date}　{session.snapshot.trainingItemDisplayName}</b><p className="meta">{session.snapshot.measureType === 'reps' ? `${session.weight ?? 0} kg × ${session.reps} 回` : `${session.seconds} 秒`} × {session.sets} セット{session.seat ? `　シート: ${session.seat}` : ''}</p>{session.memo && <p className="meta">{session.memo}</p>}</section>)}</Frame>
}

function SettingsPage({ data, commit, onBack, onSettings, onTop }: { data: CanonicalAppData; commit: (next: CanonicalAppData) => Promise<boolean>; onBack: () => void; onSettings: () => void; onTop: () => void }) {
  const [tab, setTab] = useState<'profile' | 'exercise' | 'item' | 'menu'>('profile')
  return <Frame title="正規データの設定" back={onBack} onSettings={onSettings} onTop={onTop}>
    <div className="view-toggle"><button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}>プロフィール</button><button className={tab === 'exercise' ? 'active' : ''} onClick={() => setTab('exercise')}>種目</button><button className={tab === 'item' ? 'active' : ''} onClick={() => setTab('item')}>実施項目</button><button className={tab === 'menu' ? 'active' : ''} onClick={() => setTab('menu')}>週メニュー</button></div>
    {tab === 'profile' && <ProfileEditor data={data} commit={commit}/>} {tab === 'exercise' && <ExerciseEditor data={data} commit={commit}/>} {tab === 'item' && <ItemEditor data={data} commit={commit}/>} {tab === 'menu' && <MenuEditor data={data} commit={commit}/>} 
  </Frame>
}

function ProfileEditor({ data, commit }: { data: CanonicalAppData; commit: (next: CanonicalAppData) => Promise<boolean> }) {
  const [profile, setProfile] = useState(data.profile)
  return <section className="card"><label>体重 (kg)<input type="number" min="0.1" value={profile.weight} onChange={event => setProfile({ ...profile, weight: Number(event.target.value) })}/></label><label>身長 (cm)<input type="number" min="0" value={profile.height ?? ''} onChange={event => setProfile({ ...profile, height: event.target.value === '' ? undefined : Number(event.target.value) })}/></label><label>年齢<input type="number" min="1" value={profile.age ?? ''} onChange={event => setProfile({ ...profile, age: event.target.value === '' ? undefined : Number(event.target.value) })}/></label><label>性別<input value={profile.sex ?? ''} onChange={event => setProfile({ ...profile, sex: event.target.value || undefined })}/></label><label>週開始曜日<select value={data.weekStartsOn} onChange={event => commit({ ...data, weekStartsOn: Number(event.target.value) as RecommendedDay })}>{days.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label><button className="primary" onClick={() => commit({ ...data, profile })}>プロフィールを保存</button></section>
}

function ExerciseEditor({ data, commit }: { data: CanonicalAppData; commit: (next: CanonicalAppData) => Promise<boolean> }) {
  const blank = (): Exercise => ({ id: uid(), lifecycle: 'active', name: '', measureType: 'reps', usesWeight: true, weightMode: 'total', classifications: [] })
  const [form, setForm] = useState<Exercise>(blank)
  const edit = (value: Exercise) => setForm(clone(value))
  const save = async () => { if (!form.name.trim()) return; const next = { ...form, name: form.name.trim(), weightMode: form.usesWeight ? form.weightMode ?? 'total' : undefined, classifications: form.classifications?.filter(value => value.label.trim()) }; if (await commit({ ...data, exercises: data.exercises.some(value => value.id === next.id) ? data.exercises.map(value => value.id === next.id ? next : value) : [...data.exercises, next] })) setForm(blank()) }
  return <><section className="card"><label>種目名<input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })}/></label><label>計測方法<select value={form.measureType} onChange={event => setForm({ ...form, measureType: event.target.value as Exercise['measureType'], usesWeight: event.target.value === 'time' ? false : form.usesWeight })}><option value="reps">回数型</option><option value="time">時間型</option></select></label>{form.measureType === 'reps' && <label><input type="checkbox" checked={form.usesWeight} onChange={event => setForm({ ...form, usesWeight: event.target.checked })}/> 重量を記録する</label>}{form.usesWeight && <label>重量の扱い<select value={form.weightMode ?? 'total'} onChange={event => setForm({ ...form, weightMode: event.target.value as Exercise['weightMode'] })}><option value="total">合計重量（×1）</option><option value="perSide">片側重量（×2）</option></select></label>}<label>部位（任意）<input value={form.classifications?.[0]?.label ?? ''} onChange={event => setForm({ ...form, classifications: event.target.value ? [{ kind: 'bodyRegion', label: event.target.value }] : [] })}/></label><button className="primary" disabled={!form.name.trim()} onClick={save}>{data.exercises.some(value => value.id === form.id) ? '種目を更新' : '種目を登録'}</button></section>{active(data.exercises).map(value => <button className="row" key={value.id} onClick={() => edit(value)}><span><b>{value.name}</b><small>{value.measureType === 'reps' ? '回数型' : '時間型'}{value.classifications?.[0] ? `　${value.classifications[0].label}` : ''}</small></span><span>編集</span></button>)}</>
}

function ItemEditor({ data, commit }: { data: CanonicalAppData; commit: (next: CanonicalAppData) => Promise<boolean> }) {
  const exercises = active(data.exercises)
  const initial = (): TrainingItem => ({ id: uid(), lifecycle: 'active', exerciseId: exercises[0]?.id ?? '', displayName: '', weight: 0, reps: 1, sets: 1 })
  const [form, setForm] = useState<TrainingItem>(initial)
  const selected = exercises.find(value => value.id === form.exerciseId)
  const save = async () => { if (!selected || !form.displayName.trim()) return; const normalized: TrainingItem = { ...form, displayName: form.displayName.trim(), weight: selected.usesWeight ? form.weight ?? 0 : undefined, reps: selected.measureType === 'reps' ? form.reps ?? 1 : undefined, seconds: selected.measureType === 'time' ? form.seconds ?? 1 : undefined, sets: form.sets || 1 }; const exists = data.trainingItems.some(value => value.id === normalized.id); const next = exists ? updateTrainingItem(data, normalized, { newId: uid, now: () => new Date().toISOString() }) : addTrainingItem(data, normalized, { newId: uid, now: () => new Date().toISOString() }); if (await commit(next)) setForm(initial()) }
  return <>{exercises.length === 0 ? <p className="week">先に種目を登録してください。</p> : <section className="card"><label>元種目<select value={form.exerciseId} onChange={event => { const exercise = exercises.find(value => value.id === event.target.value); setForm({ ...form, exerciseId: event.target.value, displayName: form.displayName || exercise?.name || '', reps: exercise?.measureType === 'reps' ? form.reps ?? 1 : undefined, seconds: exercise?.measureType === 'time' ? form.seconds ?? 1 : undefined, weight: exercise?.usesWeight ? form.weight ?? 0 : undefined }) }}>{exercises.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label><label>表示名<input value={form.displayName} onChange={event => setForm({ ...form, displayName: event.target.value })}/></label>{selected?.usesWeight && <label>標準重量 (kg)<input type="number" step="0.25" min="0" value={form.weight ?? 0} onChange={event => setForm({ ...form, weight: Number(event.target.value) })}/></label>}{selected?.measureType === 'reps' ? <label>標準回数<input type="number" min="1" value={form.reps ?? 1} onChange={event => setForm({ ...form, reps: Number(event.target.value) })}/></label> : <label>標準時間 (秒)<input type="number" min="1" value={form.seconds ?? 1} onChange={event => setForm({ ...form, seconds: Number(event.target.value) })}/></label>}<label>標準セット数<input type="number" min="1" value={form.sets} onChange={event => setForm({ ...form, sets: Number(event.target.value) })}/></label><label>シート位置<input value={form.seat ?? ''} onChange={event => setForm({ ...form, seat: event.target.value || undefined })}/></label><label>標準メモ<input value={form.standardMemo ?? ''} onChange={event => setForm({ ...form, standardMemo: event.target.value || undefined })}/></label><button className="primary" onClick={save}>{data.trainingItems.some(value => value.id === form.id) ? '実施項目を更新' : '実施項目を登録'}</button></section>}{active(data.trainingItems).map(value => <button className="row" key={value.id} onClick={() => setForm(clone(value))}><span><b>{value.displayName}</b><small>{data.exercises.find(exercise => exercise.id === value.exerciseId)?.name ?? '参照不明'}</small></span><span>編集</span></button>)}</>
}

function MenuEditor({ data, commit }: { data: CanonicalAppData; commit: (next: CanonicalAppData) => Promise<boolean> }) {
  const [menuId, setMenuId] = useState(data.activeMenuId ?? active(data.menus)[0]?.id ?? '')
  const [name, setName] = useState('')
  const [itemId, setItemId] = useState('')
  const [day, setDay] = useState<string>('')
  const menu = data.menus.find(value => value.id === menuId && value.lifecycle === 'active')
  const create = async () => { if (!name.trim()) return; const value: Menu = { id: uid(), lifecycle: 'active', name: name.trim() }; if (await commit({ ...data, menus: [...data.menus, value], activeMenuId: data.activeMenuId ?? value.id })) { setMenuId(value.id); setName('') } }
  const add = async () => { if (!menu || !itemId) return; const next = appendMenuEntry(data, { lifecycle: 'active', menuId: menu.id, trainingItemId: itemId, recommendedDay: day === '' ? undefined : Number(day) as RecommendedDay }, { newId: uid, now: () => new Date().toISOString() }); await commit(next); setItemId(''); setDay('') }
  return <><section className="card"><label>週メニュー<select value={menuId} onChange={event => setMenuId(event.target.value)}><option value="">選択してください</option>{active(data.menus).map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label><label>新しい週メニュー名<input value={name} onChange={event => setName(event.target.value)}/></label><button className="primary" disabled={!name.trim()} onClick={create}>週メニューを登録</button></section>{menu && <section className="card"><h2>{menu.name}</h2><label>実施項目<select value={itemId} onChange={event => setItemId(event.target.value)}><option value="">選択してください</option>{active(data.trainingItems).map(value => <option key={value.id} value={value.id}>{value.displayName}</option>)}</select></label><label>推奨曜日<select value={day} onChange={event => setDay(event.target.value)}><option value="">任意</option>{days.map((value, index) => <option key={value} value={index}>{value}</option>)}</select></label><button className="primary" disabled={!itemId} onClick={add}>実施項目を追加</button>{data.menuEntries.filter(value => value.menuId === menu.id && value.lifecycle === 'active').sort((a, b) => a.order - b.order).map(entry => { const item = data.trainingItems.find(value => value.id === entry.trainingItemId); return <button className="row" key={entry.id} onClick={() => commit(archiveMenuEntry(data, entry.id))}><span><b>{item?.displayName ?? '参照不明'}</b><small>{entry.recommendedDay === undefined ? '任意' : `推奨：${days[entry.recommendedDay]}`}</small></span><span>外す</span></button> })}</section>}</>
}

export function CanonicalCutover({ profile, legacySource, onSuccess, onBack }: { profile: { weight: number; height?: number; age?: number; sex?: string }; legacySource: unknown; onSuccess: (data: CanonicalAppData) => void; onBack: () => void }) {
  const [adoptProfile, setAdoptProfile] = useState(false)
  const [acknowledge, setAcknowledge] = useState(false)
  const [ready, setReady] = useState(false)
  const [message, setMessage] = useState('')
  const candidate = useMemo(() => createInitialCanonicalCandidate(profile), [profile])
  const validation = validateCanonical(candidate)
  const profileFields = [
    ['体重', `${candidate.profile.weight} kg`],
    ...(candidate.profile.height === undefined ? [] : [['身長', `${candidate.profile.height} cm`]] as const),
    ...(candidate.profile.age === undefined ? [] : [['年齢', `${candidate.profile.age}`]] as const),
    ...(candidate.profile.sex === undefined ? [] : [['性別', candidate.profile.sex]] as const),
  ]
  const preflight = async () => {
    setMessage('')
    const result = await prepareCanonicalCutover(canonicalStorage, legacySource, candidate, new Date().toISOString())
    if (result.ok) { setReady(true); setMessage('準備完了: legacy sourceの検証とprotected baselineの保存・read-backを確認しました。') }
    else { setReady(false); setMessage(`準備に失敗しました: ${result.diagnostics.map(value => `${value.stage}: ${value.message}`).join(' / ')}`) }
  }
  const execute = async () => {
    if (!adoptProfile || !acknowledge || !ready || validation.errors.length) return
    if (!confirm('正規データへ切り替えます。旧データへ自動では戻りません。続けますか？')) return
    const result = await cutoverCanonical(canonicalStorage, legacySource, candidate, new Date().toISOString())
    if (result.ok) onSuccess(result.value)
    else setMessage(result.diagnostics.map(value => `${value.stage}: ${value.message}`).join(' / '))
  }
  return <main className="app"><button className="back" onClick={onBack}>‹ データ管理</button><h1>正規データへ切替</h1><section className="card"><p>旧データの種目・実施項目・週メニュー・実施履歴・設定履歴は自動移行しません。</p><p>初期正規データに採用するProfile候補:</p><ul>{profileFields.map(([label, value]) => <li key={label}>{label}: {value}</li>)}</ul><p className="meta">初期candidate: 種目 0件、実施項目 0件、週メニュー 0件、実施履歴 0件</p><h2>切替前の準備</h2><p className="meta">legacy sourceの検証と、切替前baselineの保存・read-backを行います。準備だけではcanonicalを正本に切り替えません。</p><button className="save-setting" disabled={validation.errors.length > 0} onClick={preflight}>切替準備を確認</button>{ready && <p className="meta">baseline / Recovery準備: 確認済み</p>}<label><input type="checkbox" checked={adoptProfile} onChange={event => setAdoptProfile(event.target.checked)}/> 表示したProfile候補を採用する</label><label><input type="checkbox" checked={acknowledge} onChange={event => setAcknowledge(event.target.checked)}/> 切替後は正規データが正本であり、旧データへ自動復帰しないことを確認した</label>{validation.errors.length > 0 && <ul>{validation.errors.map(value => <li key={value.path}>{value.path}: {value.message}</li>)}</ul>}<button className="primary" disabled={!ready || !adoptProfile || !acknowledge || validation.errors.length > 0} onClick={execute}>正規データへ切替</button>{message && <p className="week">{message}</p>}</section></main>
}

export function CanonicalRecovery({ errors, onRecovered }: { errors: string[]; onRecovered: (data: CanonicalAppData) => void }) {
  const [message, setMessage] = useState('')
  const restore = (file?: File) => { if (!file) return; const reader = new FileReader(); reader.onload = async () => { const prepared = prepareCanonicalBackupRestore(String(reader.result)); if (!prepared.ok) { setMessage(prepared.diagnostics.map(value => `${value.stage}: ${value.message}`).join(' / ')); return } const result = await recoverCanonical(canonicalStorage, { format: 'training-check-backup', schemaVersion: 1, createdAt: new Date().toISOString(), payload: prepared.value }); if (result.ok) onRecovered(result.value); else setMessage(result.diagnostics.map(value => `${value.stage}: ${value.message}`).join(' / ')) }; reader.readAsText(file) }
  return <main className="app"><h1>正規データを読み込めません</h1><p>通常画面へ自動復帰していません。正規バックアップから明示的に復旧してください。</p><ul>{errors.map(error => <li key={error}>{error}</li>)}</ul><label>正規バックアップを選択<input type="file" accept="application/json,.json" onChange={event => restore(event.target.files?.[0])}/></label>{message && <p className="week">{message}</p>}</main>
}
