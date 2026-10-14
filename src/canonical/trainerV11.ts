import type { CanonicalAppData, ClassificationMeaning } from './types'
import { localDate } from './runtime'
import { shiftLocalDate } from './baseline'
import { compareInstants } from './instant'
import { validateCanonical } from './validate'
import { addTrainingItem, updateTrainingItem } from './operations'
import type { Exercise, TrainingItem, TrainingItemSettingSnapshot, MenuEntry } from './types'

export const trainerMessages = {
  unselected: '提案ファイルを選んでください。',
  wrongFormat: 'トレーナーからの提案ファイルではありません。',
  inconsistent: 'ファイルに不整合があります。診断情報を保存してください。',
  imported: 'トレーナーからの提案を取り込みました。',
  empty: '直近100日にトレーニング履歴はありません。',
  exported: 'トレーナー用ファイルを作成しました。',
  exportFailed: 'トレーナー用ファイル作成失敗。診断情報を保存してください。',
} as const

/** Preserve internal failure classes without copying raw input or arbitrary error text into diagnostics. */
export function trainerDiagnosticCategory(error: unknown): string {
  const reason = String(error)
  if (/managementMode|protected MAN|authority|権限/.test(reason)) return 'AUTHORITY'
  if (/already applied|proposalId/.test(reason)) return 'REPLAY'
  if (/collision|duplicate candidate|duplicate retained|duplicate order|ambiguous duplicate|重複/.test(reason)) return 'COLLISION'
  if (/missing|archived|unresolved|reference|参照/.test(reason)) return 'REFERENCE'
  if (/duplicate key|JSON|Unexpected|unterminated|colon|comma|trailing/.test(reason)) return 'JSON'
  if (/readback|read-back|帰属|読み戻し/.test(reason)) return 'READBACK'
  return 'SCHEMA_OR_STORAGE'
}

type RecordValue = Record<string, unknown>
const fail = (path: string, reason: string): never => { throw new Error(`${path}: ${reason}`) }
function object(value: unknown, path: string, required: string[], optional: string[] = []): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail(path, 'object required')
  const row = value as RecordValue
  for (const key of required) if (!Object.hasOwn(row, key)) fail(`${path}.${key}`, 'required')
  for (const key of Object.keys(row)) {
    if (![...required, ...optional].includes(key)) fail(`${path}.${key}`, 'unknown key')
    if (row[key] === null) fail(`${path}.${key}`, 'null is not supported')
  }
  return row
}
function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) return fail(path, 'nonempty string required')
  return value
}
function number(value: unknown, path: string, integer = false, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || (integer && !Number.isInteger(value))) return fail(path, 'invalid number')
  return value
}
function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) return fail(path, 'array required')
  return value
}
function optionalText(row: RecordValue, key: string, path: string) {
  if (Object.hasOwn(row, key) && typeof row[key] !== 'string') fail(`${path}.${key}`, 'string required')
}

/** JSON.parse alone discards duplicate keys. Scan all nested objects before parsing. */
export function parseUniqueJson(source: string): unknown {
  let cursor = 0
  const space = () => { while (/\s/.test(source[cursor] ?? '') && cursor < source.length) cursor++ }
  const string = (): string => {
    const start = cursor++
    while (cursor < source.length) {
      const char = source[cursor++]
      if (char === '\\') cursor++
      else if (char === '"') return JSON.parse(source.slice(start, cursor)) as string
    }
    return fail('$', 'unterminated string')
  }
  const value = (): void => {
    space()
    if (source[cursor] === '{') {
      cursor++; space()
      const keys = new Set<string>()
      if (source[cursor] === '}') { cursor++; return }
      while (cursor < source.length) {
        space()
        if (source[cursor] !== '"') fail('$', 'object key required')
        const key = string()
        if (keys.has(key)) fail('$', `duplicate key: ${key}`)
        keys.add(key); space()
        if (source[cursor++] !== ':') fail('$', 'colon required')
        value(); space()
        const end = source[cursor++]
        if (end === '}') return
        if (end !== ',') fail('$', 'comma required')
      }
      fail('$', 'unterminated object')
    } else if (source[cursor] === '[') {
      cursor++; space()
      if (source[cursor] === ']') { cursor++; return }
      while (cursor < source.length) {
        value(); space()
        const end = source[cursor++]
        if (end === ']') return
        if (end !== ',') fail('$', 'comma required')
      }
      fail('$', 'unterminated array')
    } else if (source[cursor] === '"') string()
    else {
      const start = cursor
      while (cursor < source.length && !/[\s,}\]]/.test(source[cursor])) cursor++
      if (cursor === start) fail('$', 'value required')
      JSON.parse(source.slice(start, cursor))
    }
  }
  value(); space()
  if (cursor !== source.length) fail('$', 'trailing input')
  return JSON.parse(source) as unknown
}

export type TrainerProposalPreview = {
  proposalId: string
  baseRevision: string
  exercises: string[]
  trainingItems: string[]
  menus: Array<{ name: string; memo?: string; entries: string[] }>
  settingsTargets: string[]
  washes: Array<{ menu: string; operation: string; entryCount: number }>
  details: Array<{ title: string; values: Array<[string, string]> }>
}

/** Read-only wire validation. No App IDs, persisted fields, or authority are invented. */
export function previewTrainerProposal(input: unknown, data: CanonicalAppData): TrainerProposalPreview {
  const details: TrainerProposalPreview['details'] = []
  const describeSettings = (row: RecordValue): Array<[string, string]> => [
    ['重量', Object.hasOwn(row, 'weight') ? `${row.weight} kg` : 'なし'], ['回数', Object.hasOwn(row, 'reps') ? `${row.reps} 回` : 'なし'],
    ['時間', Object.hasOwn(row, 'seconds') ? `${row.seconds} 秒` : 'なし'], ['セット数', String(row.sets)],
    ['シート位置', Object.hasOwn(row, 'seat') ? String(row.seat) : 'なし'], ['標準メモ', Object.hasOwn(row, 'standardMemo') ? String(row.standardMemo) : 'なし'],
  ]
  const root = object(input, '$', ['format', 'version', 'proposalId', 'baseRevision', 'masterSuggestions', 'trainingItemChanges', 'menuProposals', 'washRequests'])
  if (root.format !== 'training-project.trainer-proposal' || root.version !== 1) fail('$', 'unsupported format/version')
  const proposalId = text(root.proposalId, 'proposalId')
  if (data.appliedProposalIds?.includes(proposalId)) fail('proposalId', 'already applied')
  const baseRevision = text(root.baseRevision, 'baseRevision')
  const master = object(root.masterSuggestions, 'masterSuggestions', ['exercises', 'trainingItems'])
  const exercises = new Map<string, RecordValue>()
  const items = new Map<string, RecordValue>()
  const menuIds = new Set<string>(), entryIds = new Set<string>()
  const unique = (set: Set<string>, id: string, path: string) => { if (set.has(id)) fail(path, 'duplicate candidate ID'); set.add(id) }
  array(master.exercises, 'exercises').forEach((value, index) => {
    const path = `exercises[${index}]`
    const row = object(value, path, ['candidateId', 'name', 'bodyRegion', 'measureType', 'usesWeight', 'selfWeightRatio', 'secondsLoadRatio'], ['weightMode'])
    const id = text(row.candidateId, `${path}.candidateId`)
    if (exercises.has(id)) fail(path, 'duplicate candidate ID')
    text(row.name, `${path}.name`); text(row.bodyRegion, `${path}.bodyRegion`)
    if (row.measureType !== 'reps' && row.measureType !== 'time') fail(path, 'invalid measureType')
    if (typeof row.usesWeight !== 'boolean') fail(path, 'boolean usesWeight required')
    if (row.usesWeight ? !['total', 'perSide'].includes(String(row.weightMode)) : Object.hasOwn(row, 'weightMode')) fail(path, 'invalid weightMode')
    number(row.selfWeightRatio, `${path}.selfWeightRatio`); number(row.secondsLoadRatio, `${path}.secondsLoadRatio`)
    exercises.set(id, row)
    details.push({ title: `新しい種目：${row.name}`, values: [['部位', String(row.bodyRegion)], ['計測', row.measureType === 'reps' ? '回数' : '時間'], ['重量使用', row.usesWeight ? 'あり' : 'なし'], ['重量方式', row.weightMode === 'perSide' ? '片側' : row.weightMode === 'total' ? '合計' : 'なし'], ['自重寄与係数', String(row.selfWeightRatio)], ['時間負荷係数', String(row.secondsLoadRatio)]] })
  })
  const exerciseRef = (value: unknown, path: string): RecordValue => {
    const kind = (value as RecordValue | null)?.kind
    const row = object(value, path, kind === 'existing' ? ['kind', 'exerciseId'] : ['kind', 'candidateId'])
    if (kind === 'existing') {
      const exercise = data.exercises.find(value => value.id === text(row.exerciseId, path) && value.lifecycle === 'active')
      if (!exercise) return fail(path, 'missing/archived Exercise')
      return exercise as unknown as RecordValue
    }
    if (kind !== 'candidate') return fail(path, 'invalid reference kind')
    return exercises.get(text(row.candidateId, path)) ?? fail(path, 'unknown Exercise candidate')
  }
  const standard = (row: RecordValue, exercise: RecordValue, path: string) => {
    number(row.sets, `${path}.sets`, true, 1)
    const metric = exercise.measureType === 'reps' ? 'reps' : 'seconds'
    number(row[metric], `${path}.${metric}`, true, 1)
    if (Object.hasOwn(row, metric === 'reps' ? 'seconds' : 'reps')) fail(path, 'exclusive measurement')
    if (Object.hasOwn(row, 'weight')) { if (!exercise.usesWeight) fail(path, 'weight forbidden'); number(row.weight, `${path}.weight`) }
    optionalText(row, 'seat', path); optionalText(row, 'standardMemo', path)
  }
  array(master.trainingItems, 'trainingItems').forEach((value, index) => {
    const path = `trainingItems[${index}]`
    const row = object(value, path, ['candidateId', 'exerciseRef', 'name', 'sets'], ['reps', 'seconds', 'weight', 'seat', 'standardMemo'])
    const id = text(row.candidateId, path)
    if (items.has(id)) fail(path, 'duplicate candidate ID')
    text(row.name, `${path}.name`); standard(row, exerciseRef(row.exerciseRef, `${path}.exerciseRef`), path)
    items.set(id, row)
    const exercise = exerciseRef(row.exerciseRef, `${path}.exerciseRef`)
    details.push({ title: `新しい実施項目：${row.name}`, values: [['種目', String(exercise.name)], ...describeSettings(row)] })
  })
  const itemRef = (value: unknown, path: string): string => {
    const kind = (value as RecordValue | null)?.kind
    const row = object(value, path, kind === 'existing' ? ['kind', 'trainingItemId'] : ['kind', 'candidateId'])
    if (kind === 'existing') {
      const item = data.trainingItems.find(value => value.id === text(row.trainingItemId, path) && value.lifecycle === 'active')
      if (!item || !data.exercises.some(value => value.id === item.exerciseId && value.lifecycle === 'active')) return fail(path, 'missing/archived TrainingItem or Exercise')
      return item.displayName
    }
    if (kind !== 'candidate') return fail(path, 'invalid reference kind')
    return String((items.get(text(row.candidateId, path)) ?? fail(path, 'unknown TrainingItem candidate')).name)
  }
  const order = (row: RecordValue, seen: Set<number>, path: string) => {
    const value = number(row.order, `${path}.order`, true)
    if (seen.has(value)) fail(path, 'duplicate order')
    seen.add(value)
    if (Object.hasOwn(row, 'recommendedDay')) number(row.recommendedDay, `${path}.recommendedDay`, true)
    if (Number(row.recommendedDay) > 6) fail(path, 'invalid day')
  }
  const menus = array(root.menuProposals, 'menuProposals').map((value, index) => {
    const path = `menuProposals[${index}]`
    const row = object(value, path, ['candidateId', 'name', 'entries'], ['memo'])
    unique(menuIds, text(row.candidateId, path), path); optionalText(row, 'memo', path)
    const seen = new Set<number>()
    const entries = array(row.entries, `${path}.entries`).slice().sort((a, b) => Number((a as RecordValue)?.order) - Number((b as RecordValue)?.order)).map((value, index) => {
      const pathEntry = `${path}.entries[${index}]`
      const entry = object(value, pathEntry, ['candidateId', 'trainingItemRef', 'order'], ['recommendedDay'])
      unique(entryIds, text(entry.candidateId, pathEntry), pathEntry); order(entry, seen, pathEntry)
      return `${Number(entry.order) + 1}. ${itemRef(entry.trainingItemRef, pathEntry)}（推奨：${entry.recommendedDay === undefined ? '任意' : ['月', '火', '水', '木', '金', '土', '日'][Number(entry.recommendedDay)]}）`
    })
    return { name: text(row.name, `${path}.name`), ...(Object.hasOwn(row, 'memo') ? { memo: String(row.memo) } : {}), entries }
  })
  const targets = new Set<string>()
  const settingsTargets = array(root.trainingItemChanges, 'trainingItemChanges').map((value, index) => {
    const path = `trainingItemChanges[${index}]`
    const row = object(value, path, ['operation', 'targetTrainingItemId', 'settings'])
    if (row.operation !== 'TRAINER_TI_SETTINGS_UPDATE') fail(path, 'invalid operation')
    const id = text(row.targetTrainingItemId, path)
    if (targets.has(id)) fail(path, 'ambiguous duplicate target')
    targets.add(id)
    const item = data.trainingItems.find(value => value.id === id && value.lifecycle === 'active')
    if (!item) return fail(path, 'missing/archived TrainingItem')
    authority(item, path, 'TRAINER')
    const exercise = data.exercises.find(value => value.id === item.exerciseId)
    if (!exercise) return fail(path, 'missing Exercise')
    standard(object(row.settings, `${path}.settings`, ['sets'], ['reps', 'seconds', 'weight', 'seat', 'standardMemo']), exercise as unknown as RecordValue, path)
    details.push({ title: `変更後の設定：${item.displayName}`, values: describeSettings(row.settings as RecordValue) })
    return item.displayName
  })
  const washTargets = new Set<string>()
  const washes = array(root.washRequests, 'washRequests').map((value, index) => {
    const path = `washRequests[${index}]`
    const operation = (value as RecordValue | null)?.operation
    if (operation !== 'MENU_ENTRY_REMOVE' && operation !== 'MENU_ENTRY_REPLACE') return fail(path, 'unsupported wash operation')
    const row = object(value, path, operation === 'MENU_ENTRY_REMOVE' ? ['operation', 'targetMenuId', 'entryId'] : ['operation', 'targetMenuId', 'entries'])
    const id = text(row.targetMenuId, path)
    const menu = data.menus.find(value => value.id === id && value.lifecycle === 'active')
    if (!menu) return fail(path, 'missing/archived Menu')
    authority(menu, path, 'TRAINER')
    const existingEntry = (id: string) => data.menuEntries.find(value => value.id === id && value.menuId === menu.id && value.lifecycle === 'active') ?? fail(path, 'missing/archived Entry in target Menu')
    if (washTargets.has(id)) fail(path, 'ambiguous duplicate Menu wash')
    washTargets.add(id)
    if (operation === 'MENU_ENTRY_REMOVE') {
      const entry = existingEntry(text(row.entryId, path))
      details.push({ title: `外す実施項目：${menu.name}`, values: [['実施項目', data.trainingItems.find(value => value.id === entry.trainingItemId)?.displayName ?? fail(path, 'missing TrainingItem')], ['項目ID', entry.id]] })
      return { menu: menu.name, operation, entryCount: 1 }
    }
    const seen = new Set<number>(), retained = new Set<string>()
    const entries = array(row.entries, `${path}.entries`)
    entries.forEach((value, index) => {
      const pathEntry = `${path}.entries[${index}]`
      const kind = (value as RecordValue | null)?.kind
      const entry = object(value, pathEntry, kind === 'existing' ? ['kind', 'entryId', 'order'] : ['kind', 'candidateId', 'trainingItemRef', 'order'], ['recommendedDay'])
      order(entry, seen, pathEntry)
      if (kind === 'existing') {
        const id = text(entry.entryId, pathEntry); existingEntry(id)
        if (retained.has(id)) fail(pathEntry, 'duplicate retained Entry')
        retained.add(id)
      } else if (kind === 'candidate') { unique(entryIds, text(entry.candidateId, pathEntry), pathEntry); itemRef(entry.trainingItemRef, pathEntry) }
      else fail(pathEntry, 'invalid Entry kind')
    })
    const kept = new Set(entries.filter(value => (value as RecordValue).kind === 'existing').map(value => String((value as RecordValue).entryId)))
    const removed = data.menuEntries.filter(value => value.menuId === menu.id && value.lifecycle === 'active' && !kept.has(value.id))
    details.push({ title: `入れ替え後：${menu.name}`, values: entries.map(value => {
      const row = value as RecordValue
      const name = row.kind === 'existing' ? data.trainingItems.find(value => value.id === existingEntry(String(row.entryId)).trainingItemId)?.displayName ?? fail(path, 'missing TrainingItem') : itemRef(row.trainingItemRef, path)
      return [`${Number(row.order) + 1}. ${name}`, `推奨：${row.recommendedDay === undefined ? '任意' : ['月', '火', '水', '木', '金', '土', '日'][Number(row.recommendedDay)]}`] as [string, string]
    }).concat(removed.map(entry => ['外す実施項目', `${data.trainingItems.find(value => value.id === entry.trainingItemId)?.displayName ?? entry.trainingItemId}（${entry.id}）`] as [string, string])) })
    return { menu: menu.name, operation, entryCount: entries.length }
  })
  return { proposalId, baseRevision, exercises: [...exercises.values()].map(value => String(value.name)), trainingItems: [...items.values()].map(value => String(value.name)), menus, settingsTargets, washes, details }
}

function authority(value: object, path: string, required?: 'TRAINER'): 'TRAINER' | 'MAN' {
  const mode = (value as RecordValue).managementMode
  if (mode !== 'TRAINER' && mode !== 'MAN') return fail(path, 'missing/unknown canonical managementMode')
  if (required && mode !== required) return fail(path, 'protected MAN authority')
  return mode
}
function bodyRegion(values: ClassificationMeaning[] | undefined, path: string): string | undefined {
  const labels = values?.filter(value => value.kind === 'bodyRegion').map(value => value.label.trim()) ?? []
  if (labels.length > 1 || labels.some(value => !value)) return fail(path, 'ambiguous bodyRegion')
  return labels[0]
}

/** Exact 100-local-calendar-day context projection; never writes or repairs canonical input. */
export function createTrainerContextV11(data: CanonicalAppData, now: Date) {
  const checked = validateCanonical(data)
  if (checked.errors.length) fail('canonical', checked.errors.map(value => `${value.path}: ${value.message}`).join('; '))
  const toDate = localDate(now), fromDate = shiftLocalDate(toDate, -99)
  const start = new Date(`${fromDate}T00:00:00`).toISOString()
  const endExclusive = new Date(`${shiftLocalDate(toDate, 1)}T00:00:00`).toISOString()
  const history = data.sessions.filter(value => value.date >= fromDate && value.date <= toDate).map(value => {
    const snapshot = value.snapshot
    const region = bodyRegion(snapshot.classifications, `Session.${value.id}.snapshot`)
    return { id: value.id, trainingItemId: value.trainingItemId, menuEntryId: value.menuEntryId, date: value.date, performedAt: value.performedAt, performedOrder: value.performedOrder, sets: value.sets, reps: value.reps, seconds: value.seconds, weight: value.weight, bodyWeight: value.bodyWeight, seat: value.seat, memo: value.memo,
      snapshot: { exerciseId: snapshot.exerciseId, exerciseName: snapshot.exerciseName, trainingItemDisplayName: snapshot.trainingItemDisplayName, measureType: snapshot.measureType, weightMode: snapshot.weightMode, selfWeightRatio: snapshot.selfWeightRatio, secondsLoadRatio: snapshot.secondsLoadRatio, ...(region === undefined ? {} : { bodyRegion: region }) } }
  })
  const relevant = new Set([...data.trainingItems.filter(value => value.lifecycle === 'active').map(value => value.id), ...history.map(value => value.trainingItemId)])
  const baseline = new Map<string, CanonicalAppData['trainingItemSettingChanges'][number]>()
  const inWindow = data.trainingItemSettingChanges.filter(value => relevant.has(value.trainingItemId) && compareInstants(value.changedAt, start) >= 0 && compareInstants(value.changedAt, endExclusive) < 0)
  const orderedChanges = new Map<string, Set<string>>()
  data.trainingItemSettingChanges.filter(value => relevant.has(value.trainingItemId) && compareInstants(value.changedAt, endExclusive) < 0).forEach(value => {
    const earlier = orderedChanges.get(value.trainingItemId) ?? new Set<string>()
    if ([...earlier].some(time => compareInstants(time, value.changedAt) === 0)) fail('settingChanges', 'ambiguous equal timestamps')
    earlier.add(value.changedAt); orderedChanges.set(value.trainingItemId, earlier)
    if (compareInstants(value.changedAt, start) >= 0) return
    const previous = baseline.get(value.trainingItemId)
    if (!previous || compareInstants(value.changedAt, previous.changedAt) > 0) baseline.set(value.trainingItemId, value)
  })
  const items = data.trainingItems.filter(value => value.lifecycle === 'active')
  const menus = data.menus.filter(value => value.lifecycle === 'active')
  const menuEntries = data.menuEntries.filter(value => value.lifecycle === 'active' && menus.some(menu => menu.id === value.menuId))
  return {
    format: 'training-project.trainer-context', version: 1, exportedLocalDate: toDate, fromDate, toDate, history,
    trainingContext: {
      contractVersion: 1, generatedAt: now.toISOString(), profile: { weight: data.profile.weight },
      exercises: data.exercises.filter(value => value.lifecycle === 'active').map(value => {
        const region = bodyRegion(value.classifications, `Exercise.${value.id}`)
        if (region === undefined) fail(`Exercise.${value.id}`, 'missing bodyRegion')
        return { id: value.id, name: value.name, bodyRegion: region, measureType: value.measureType, usesWeight: value.usesWeight, weightMode: value.weightMode, selfWeightRatio: value.selfWeightRatio, secondsLoadRatio: value.secondsLoadRatio }
      }),
      trainingItems: items.map(value => ({ id: value.id, exerciseId: value.exerciseId, name: value.displayName, sets: value.sets, reps: value.reps, seconds: value.seconds, weight: value.weight, seat: value.seat, standardMemo: value.standardMemo, authority: authority(value, `TrainingItem.${value.id}`) })),
      menus: menus.map(value => ({ id: value.id, name: value.name, memo: value.memo, authority: authority(value, `Menu.${value.id}`) })),
      menuEntries: menuEntries.map(value => ({ id: value.id, menuId: value.menuId, trainingItemId: value.trainingItemId, order: value.order, recommendedDay: value.recommendedDay, authority: authority(menus.find(menu => menu.id === value.menuId)!, `Menu.${value.menuId}`) })),
      settingChanges: [...baseline.values(), ...inWindow].map(value => ({ trainingItemId: value.trainingItemId, changedAt: value.changedAt, snapshot: { sets: value.snapshot.sets, reps: value.snapshot.reps, seconds: value.snapshot.seconds, weight: value.snapshot.weight, seat: value.snapshot.seat, standardMemo: value.snapshot.standardMemo }, changeReason: value.changeReason })),
    },
  }
}

export type TrainerApplyCandidate = { data: CanonicalAppData; mapping: Record<string, Record<string, string>>; touched: Record<string, string[]> }

/** Called inside the same readwrite transaction as latest-root read and the eventual put. */
export function createTrainerApplyCandidate(input: unknown, latest: CanonicalAppData, issueId: () => string, now: string): TrainerApplyCandidate {
  previewTrainerProposal(input, latest)
  const root = input as RecordValue
  const master = root.masterSuggestions as { exercises: RecordValue[]; trainingItems: RecordValue[] }
  let data = structuredClone(latest)
  const mapping: Record<string, Record<string, string>> = { exercises: Object.create(null), trainingItems: Object.create(null), menus: Object.create(null), menuEntries: Object.create(null) }
  const touched: Record<string, string[]> = { exercises: [], trainingItems: [], menus: [], menuEntries: [], trainingItemSettingChanges: [] }
  const used = new Set([data.exercises, data.trainingItems, data.menus, data.menuEntries, data.sessions, data.trainingItemSettingChanges].flatMap(values => values.map(value => value.id)))
  const fresh = () => { const id = issueId(); if (!id.trim() || used.has(id)) return fail('id', 'App ID collision'); used.add(id); return id }
  const settings = (row: RecordValue): TrainingItemSettingSnapshot => ({ sets: Number(row.sets), ...(Object.hasOwn(row, 'reps') ? { reps: Number(row.reps) } : {}), ...(Object.hasOwn(row, 'seconds') ? { seconds: Number(row.seconds) } : {}), ...(Object.hasOwn(row, 'weight') ? { weight: Number(row.weight) } : {}), ...(Object.hasOwn(row, 'seat') ? { seat: String(row.seat) } : {}), ...(Object.hasOwn(row, 'standardMemo') ? { standardMemo: String(row.standardMemo) } : {}) })
  const resolve = (ref: unknown, kind: 'exercises' | 'trainingItems'): string => {
    const row = ref as RecordValue
    return row.kind === 'candidate' ? mapping[kind][String(row.candidateId)] ?? fail('reference', 'candidate unresolved') : String(row[kind === 'exercises' ? 'exerciseId' : 'trainingItemId'])
  }
  master.exercises.forEach(row => {
    const id = fresh(); mapping.exercises[String(row.candidateId)] = id; touched.exercises.push(id)
    const exercise: Exercise = { id, lifecycle: 'active', name: String(row.name), measureType: row.measureType as Exercise['measureType'], usesWeight: Boolean(row.usesWeight), ...(row.usesWeight ? { weightMode: row.weightMode as Exercise['weightMode'] } : {}), selfWeightRatio: Number(row.selfWeightRatio), secondsLoadRatio: Number(row.secondsLoadRatio), classifications: [{ kind: 'bodyRegion', label: String(row.bodyRegion).trim() }] }
    data.exercises.push(exercise)
  })
  master.trainingItems.forEach(row => {
    const id = fresh(); mapping.trainingItems[String(row.candidateId)] = id; touched.trainingItems.push(id)
    const item: TrainingItem = { id, lifecycle: 'active', managementMode: 'TRAINER', displayName: String(row.name), exerciseId: resolve(row.exerciseRef, 'exercises'), ...settings(row) }
    data = addTrainingItem(data, item, { newId: fresh, now: () => now })
  })
  ;(root.trainingItemChanges as RecordValue[]).forEach(row => {
    const id = String(row.targetTrainingItemId)
    const old = data.trainingItems.find(value => value.id === id)!
    const item = { ...old }
    for (const key of ['sets', 'reps', 'seconds', 'weight', 'seat', 'standardMemo'] as const) delete (item as unknown as RecordValue)[key]
    Object.assign(item, settings(row.settings as RecordValue))
    data = updateTrainingItem(data, item, { newId: fresh, now: () => now })
    touched.trainingItems.push(id)
  })
  const newEntry = (row: RecordValue, menuId: string): MenuEntry => {
    const id = fresh(); mapping.menuEntries[String(row.candidateId)] = id; touched.menuEntries.push(id)
    return { id, menuId, lifecycle: 'active', trainingItemId: resolve(row.trainingItemRef, 'trainingItems'), order: Number(row.order), ...(Object.hasOwn(row, 'recommendedDay') ? { recommendedDay: row.recommendedDay as MenuEntry['recommendedDay'] } : {}) }
  }
  ;(root.menuProposals as RecordValue[]).forEach(row => {
    const id = fresh(); mapping.menus[String(row.candidateId)] = id; touched.menus.push(id)
    data.menus.push({ id, lifecycle: 'active', managementMode: 'TRAINER', name: String(row.name), ...(Object.hasOwn(row, 'memo') ? { memo: String(row.memo) } : {}) })
    data.menuEntries.push(...(row.entries as RecordValue[]).map(entry => newEntry(entry, id)))
  })
  ;(root.washRequests as RecordValue[]).forEach(row => {
    const menuId = String(row.targetMenuId)
    if (row.operation === 'MENU_ENTRY_REMOVE') {
      data.menuEntries = data.menuEntries.map(entry => entry.id === row.entryId ? { ...entry, lifecycle: 'archived' } : entry)
      touched.menuEntries.push(String(row.entryId)); return
    }
    const retained = new Map((row.entries as RecordValue[]).filter(value => value.kind === 'existing').map(value => [String(value.entryId), value]))
    data.menuEntries = data.menuEntries.map(entry => {
      if (entry.menuId !== menuId || entry.lifecycle !== 'active') return entry
      touched.menuEntries.push(entry.id)
      const after = retained.get(entry.id)
      if (!after) return { ...entry, lifecycle: 'archived' }
      const result = { ...entry, order: Number(after.order) }; delete result.recommendedDay
      if (Object.hasOwn(after, 'recommendedDay')) result.recommendedDay = after.recommendedDay as MenuEntry['recommendedDay']
      return result
    })
    data.menuEntries.push(...(row.entries as RecordValue[]).filter(value => value.kind === 'candidate').map(value => newEntry(value, menuId)))
  })
  touched.trainingItemSettingChanges = data.trainingItemSettingChanges.filter(value => !latest.trainingItemSettingChanges.some(old => old.id === value.id)).map(value => value.id)
  data.appliedProposalIds = [...(data.appliedProposalIds ?? []), String(root.proposalId)]
  const checked = validateCanonical(data)
  if (checked.errors.length) fail('candidate', checked.errors.map(value => `${value.path}: ${value.message}`).join('; '))
  return { data, mapping, touched }
}

/** Independent positive comparison of affected records and replay ID, never whole-root JSON equality. */
export function trainerReadbackMatches(candidate: TrainerApplyCandidate, readback: CanonicalAppData, proposalId: string): boolean {
  if (validateCanonical(readback).errors.length || !readback.appliedProposalIds?.includes(proposalId)) return false
  const stable = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
    if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => `${JSON.stringify(key)}:${stable(v)}`).join(',')}}`
    return JSON.stringify(value)
  }
  return Object.entries(candidate.touched).every(([key, ids]) => {
    const before = candidate.data[key as keyof CanonicalAppData] as Array<{ id: string }>
    const after = readback[key as keyof CanonicalAppData] as Array<{ id: string }>
    return ids.every(id => stable(before.find(value => value.id === id)) === stable(after.find(value => value.id === id)))
  })
}
