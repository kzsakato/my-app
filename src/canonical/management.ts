import type { CanonicalAppData } from './types'
import { toSettingSnapshot } from './operations'

/** Owner-approved initialization of existing canonical Owner data, never inferred TRAINER. */
export function initializeOwnerManagement(data: CanonicalAppData): CanonicalAppData {
  return { ...data,
    trainingItems: data.trainingItems.map(value => Object.hasOwn(value, 'managementMode') ? value : { ...value, managementMode: 'MAN' }),
    menus: data.menus.map(value => Object.hasOwn(value, 'managementMode') ? value : { ...value, managementMode: 'MAN' }),
  }
}

const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
/** Rebase only an explicit UI change onto latest storage, preserving unrelated AI results/authority. */
export function rebaseOwnerChange(base: CanonicalAppData, next: CanonicalAppData, latest: CanonicalAppData): CanonicalAppData {
  const result = structuredClone(latest)
  const arrays = ['exercises', 'trainingItems', 'menus', 'menuEntries', 'sessions', 'trainingItemSettingChanges'] as const
  for (const key of arrays) {
    type Row = { id: string; managementMode?: 'TRAINER' | 'MAN' } & Record<string, unknown>
    const before = base[key] as unknown as Row[], after = next[key] as unknown as Row[]
    let rows = result[key] as unknown as Row[]
    for (const old of before) if (!after.some(value => value.id === old.id)) {
      const current = rows.find(value => value.id === old.id)
      if (!equal(current, old)) throw new Error(`削除対象が変更されています: ${key}`)
      rows = rows.filter(value => value.id !== old.id)
    }
    for (const value of after) {
      const old = before.find(row => row.id === value.id)
      const current = rows.find(row => row.id === value.id)
      if (!old) {
        if (current) throw new Error(`IDが重複しています: ${key}`)
        if ((key === 'trainingItems' || key === 'menus') && value.managementMode !== 'MAN') throw new Error('手動作成はMANのみです')
        rows.push(structuredClone(value)); continue
      }
      if (equal(value, old)) continue
      if (!current) throw new Error(`更新対象がありません: ${key}`)
      const merged = { ...current }
      for (const field of new Set([...Object.keys(old), ...Object.keys(value)])) {
        if (equal(old[field], value[field])) continue
        if (field === 'managementMode' && !(current.managementMode === 'TRAINER' && value.managementMode === 'MAN')) throw new Error('管理権限はTRAINERからMANへだけ変更できます')
        // Conflicting identity/reference edits must be confirmed against the latest UI.
        if (['exerciseId', 'trainingItemId', 'menuId', 'lifecycle'].includes(field) && !equal(current[field], old[field])) throw new Error(`参照または状態が変更されています: ${key}.${field}`)
        if (Object.hasOwn(value, field)) merged[field] = value[field]
        else delete merged[field]
      }
      rows = rows.map(row => row.id === value.id ? merged : row)
    }
    Object.assign(result, { [key]: rows })
  }
  for (const key of ['activeMenuId', 'weekStartsOn', 'profile', 'displayPreferences'] as const) {
    if (!equal(base[key], next[key])) Object.assign(result, { [key]: structuredClone(next[key]) })
  }
  result.trainingItemSettingChanges = result.trainingItemSettingChanges.flatMap(change => {
    if (latest.trainingItemSettingChanges.some(value => value.id === change.id)) return [change]
    const item = result.trainingItems.find(value => value.id === change.trainingItemId)
    if (!item) throw new Error('設定履歴の対象がありません')
    const previous = latest.trainingItems.find(value => value.id === item.id)
    const snapshot = toSettingSnapshot(item)
    if (!change.isInitial && previous && equal(toSettingSnapshot(previous), snapshot)) return []
    return [{ ...change, snapshot }]
  })
  // Only Trainer apply appends replay IDs; ordinary writers cannot roll them back.
  result.appliedProposalIds = [...new Set([...(latest.appliedProposalIds ?? []), ...(next.appliedProposalIds ?? [])])]
  return result
}
