import { shiftLocalDate } from './baseline'
import type { CanonicalAppData, Exercise, Session, ValidationIssue } from './types'

export type SortKey = 'recommendedDay' | 'completion' | 'bodyRegion'
export type SortPreference = { priority: [SortKey, SortKey, SortKey]; completionDirection: 'incompleteFirst' | 'completeFirst' }
export type DisplayPreferences = { defaultSort: SortPreference; optionSort: SortPreference; bodyRegionOrder: string[] }
export const defaultDisplayPreferences: DisplayPreferences = {
  defaultSort: { priority: ['recommendedDay', 'completion', 'bodyRegion'], completionDirection: 'incompleteFirst' },
  optionSort: { priority: ['completion', 'recommendedDay', 'bodyRegion'], completionDirection: 'incompleteFirst' },
  bodyRegionOrder: ['胸', '背中', '腕', '肩', '下半身', '体幹', 'その他'],
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
export function validSort(value: unknown): value is SortPreference {
  return record(value) && Array.isArray(value.priority) && value.priority.length === 3 &&
    new Set(value.priority).size === 3 && value.priority.every(key => ['recommendedDay', 'completion', 'bodyRegion'].includes(key)) &&
    ['incompleteFirst', 'completeFirst'].includes(String(value.completionDirection))
}
function validRegionOrder(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && new Set(value).size === value.length &&
    value.every(label => typeof label === 'string' && label.length > 0 && label === label.trim())
}
/** Only preferences are normalized. Required canonical facts are never repaired. */
export function normalizeDisplayPreferences(value: unknown): { value: DisplayPreferences; warnings: ValidationIssue[] } {
  const input = record(value) ? value : {}
  const result = structuredClone(defaultDisplayPreferences)
  const warnings: ValidationIssue[] = []
  for (const key of ['defaultSort', 'optionSort', 'bodyRegionOrder'] as const) {
    if (key === 'bodyRegionOrder' ? validRegionOrder(input[key]) : validSort(input[key])) {
      Object.assign(result, { [key]: structuredClone(input[key]) })
    // Reuse the existing validation wording (04 prohibits inventing fixed notices).
    } else warnings.push({ path: `displayPreferences.${key}`, message: '入力値を確認してください。' })
  }
  return { value: result, warnings }
}
export const effectiveDisplayPreferences = (data: Pick<CanonicalAppData, 'displayPreferences'>) => normalizeDisplayPreferences(data.displayPreferences).value
export const withDisplayPreferences = (data: CanonicalAppData): CanonicalAppData => ({ ...data, displayPreferences: effectiveDisplayPreferences(data) })

const names = new Intl.Collator('ja')
export const compareNames = (left: string, right: string) => names.compare(left, right)
const compareIds = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0
export function compareBodyRegions(left: string | undefined, right: string | undefined, order: readonly string[]): number {
  const rank = (label: string | undefined) => label === undefined || label === '' ? order.length + 1 : order.includes(label) ? order.indexOf(label) : order.length
  return rank(left) - rank(right) || compareNames(left ?? '', right ?? '')
}
/** Invalid or ambiguous current classifications are never silently assigned a region. */
export function exerciseBodyRegion(exercise: Pick<Exercise, 'classifications'> | undefined): string | undefined {
  const rows = exercise?.classifications
  if (!Array.isArray(rows) || rows.length !== 1) return undefined
  const row = rows[0]
  return row?.kind === 'bodyRegion' && typeof row.label === 'string' && row.label.length > 0 && row.label === row.label.trim() ? row.label : undefined
}
export function bodyRegions(data: CanonicalAppData): string[] {
  const order = effectiveDisplayPreferences(data).bodyRegionOrder
  return [...new Set(data.exercises.flatMap(exercise => { const label = exerciseBodyRegion(exercise); return label ? [label] : [] }))].sort((a, b) => compareBodyRegions(a, b, order))
}
export type DisplaySortRow = { id: string; name: string; bodyRegion?: string; recommendedDay?: number; completed?: boolean }
/** Undefined key concepts are omitted by the caller for the whole list. */
export function sortDisplayRows<T>(rows: readonly T[], project: (row: T) => DisplaySortRow, preferences: DisplayPreferences, option: boolean, keys: readonly SortKey[]): T[] {
  const sort = option ? preferences.optionSort : preferences.defaultSort
  return [...rows].sort((a, b) => {
    const left = project(a), right = project(b)
    for (const key of sort.priority) {
      if (!keys.includes(key)) continue
      const delta = key === 'recommendedDay' ? (left.recommendedDay ?? 7) - (right.recommendedDay ?? 7) :
        key === 'completion' ? (Number(!!left.completed) - Number(!!right.completed)) * (sort.completionDirection === 'incompleteFirst' ? 1 : -1) :
        compareBodyRegions(left.bodyRegion, right.bodyRegion, preferences.bodyRegionOrder)
      if (delta) return delta
    }
    return compareNames(left.name, right.name) || compareIds(left.id, right.id)
  })
}
export function recentlyPerformedExercises(sessions: Session[], today: string, previousDays: number): Set<string> {
  const start = shiftLocalDate(today, -previousDays)
  return new Set(sessions.filter(session => session.date >= start && session.date <= today).map(session => session.snapshot.exerciseId))
}
