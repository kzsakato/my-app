// Oracle: training-project app-design 05 §7.1, 05_JSON §3.1, 06 V1.2 §4.
import { describe, expect, it, vi } from 'vitest'
import { bodyRegions, compareBodyRegions, defaultDisplayPreferences, exerciseBodyRegion, normalizeDisplayPreferences, recentlyPerformedExercises, sortDisplayRows, type DisplaySortRow } from './displayPreferences'
import { canonicalFixture } from './fixtures'
import { applyCanonicalRestore, createCanonicalBackup, previewCanonicalRestore } from './backup'
import { rebaseOwnerChange } from './management'
import type { CanonicalStorage } from './cutover'

describe('V1.2 approved display projection', () => {
  it('uses independent defaults, skips absent concepts and fixes name/ID at the end without mutating inputs', () => {
    const rows: DisplaySortRow[] = [
      { id: 'z', name: 'アーム', bodyRegion: '胸', recommendedDay: 1, completed: false },
      { id: 'b', name: 'プレス', bodyRegion: '背中', recommendedDay: 0, completed: true },
      { id: 'a', name: 'アーム', bodyRegion: '胸', recommendedDay: 1, completed: false },
      { id: 'c', name: 'カール', bodyRegion: '腕', completed: false },
    ]
    const snapshot = structuredClone(rows), prefs = structuredClone(defaultDisplayPreferences)
    const ids = (option: boolean, keys: Parameters<typeof sortDisplayRows>[4]) => sortDisplayRows(rows, row => row, prefs, option, keys).map(row => row.id)
    expect(ids(false, ['recommendedDay', 'completion', 'bodyRegion'])).toEqual(['b', 'a', 'z', 'c'])
    expect(ids(true, ['recommendedDay', 'completion', 'bodyRegion'])).toEqual(['a', 'z', 'c', 'b'])
    expect(ids(false, ['bodyRegion'])).toEqual(['a', 'z', 'b', 'c'])
    prefs.defaultSort = { priority: ['bodyRegion', 'recommendedDay', 'completion'], completionDirection: 'completeFirst' }
    expect(ids(false, ['bodyRegion'])).toEqual(['a', 'z', 'b', 'c'])
    expect(rows).toEqual(snapshot)
  })
  it('honors custom priority and completion direction within each preceding key', () => {
    const prefs = structuredClone(defaultDisplayPreferences)
    prefs.defaultSort = { priority: ['recommendedDay', 'bodyRegion', 'completion'], completionDirection: 'completeFirst' }
    const rows: DisplaySortRow[] = [
      { id: 'a', name: 'ア', recommendedDay: 0, bodyRegion: '腕', completed: false },
      { id: 'b', name: 'イ', recommendedDay: 0, bodyRegion: '腕', completed: true },
      { id: 'c', name: 'ウ', recommendedDay: 0, bodyRegion: '肩', completed: true },
      { id: 'd', name: 'エ', recommendedDay: 1, bodyRegion: '胸', completed: true },
    ]
    expect(sortDisplayRows(rows, row => row, prefs, false, ['recommendedDay', 'bodyRegion', 'completion']).map(row => row.id)).toEqual(['b', 'a', 'c', 'd'])
    prefs.defaultSort.completionDirection = 'incompleteFirst'
    expect(sortDisplayRows(rows, row => row, prefs, false, ['recommendedDay', 'bodyRegion', 'completion']).map(row => row.id)).toEqual(['a', 'b', 'c', 'd'])
  })
  it('keeps open labels, sorts unknowns after configured labels, and never guesses an ambiguous region', () => {
    const order = defaultDisplayPreferences.bodyRegionOrder
    expect(['肩', '独自B', 'その他', '胸', '独自A'].sort((a,b) => compareBodyRegions(a,b,order))).toEqual(['胸', '肩', 'その他', '独自A', '独自B'])
    for (const classifications of [undefined, [], [{ kind: 'bodyRegion' as const, label: ' 胸' }], [{ kind: 'bodyRegion' as const, label: '胸' }, { kind: 'bodyRegion' as const, label: '背中' }]]) expect(exerciseBodyRegion({ classifications })).toBeUndefined()
    expect(exerciseBodyRegion(canonicalFixture.exercises[0])).toBe('胸')
    const data = structuredClone(canonicalFixture)
    data.exercises.push({ ...data.exercises[0], id: 'custom', classifications: [{ kind: 'bodyRegion', label: '独自' }] })
    expect(bodyRegions(data)).toEqual(['胸', '独自'])
  })
  it.each([2, 4, 6, 10])('excludes Exercise across all TIs for N=%i, both date endpoints, never future or boundary-outside facts', n => {
    const sessions = ['2026-10-24', '2026-10-22', '2026-10-20', '2026-10-18', '2026-10-14', '2026-10-13', '2026-10-25'].map((date, i) => ({ ...structuredClone(canonicalFixture.sessions[0]), id: `${i}`, date, snapshot: { ...canonicalFixture.sessions[0].snapshot, exerciseId: date } }))
    const before = structuredClone(sessions)
    expect([...recentlyPerformedExercises(sessions, '2026-10-24', n)]).toEqual(sessions.filter(row => row.date >= `2026-10-${24-n}` && row.date <= '2026-10-24').map(row => row.date))
    expect(sessions).toEqual(before)
  })
  it('uses stored calendar date across leap-month and year boundaries, ignoring performedAt/timezone', () => {
    const sessions = ['2024-02-28', '2024-02-29', '2024-03-01', '2024-03-02'].map(date => ({ ...canonicalFixture.sessions[0], date, performedAt: '2000-01-01T00:00:00-05:00', snapshot: { ...canonicalFixture.sessions[0].snapshot, exerciseId: date } }))
    expect([...recentlyPerformedExercises(sessions, '2024-03-01', 2)]).toEqual(['2024-02-28', '2024-02-29', '2024-03-01'])
    const year = ['2025-12-30','2025-12-31','2026-01-01'].map(date => ({ ...sessions[0], date, snapshot: { ...sessions[0].snapshot, exerciseId: date } }))
    expect(recentlyPerformedExercises(year, '2026-01-01', 2).size).toBe(3)
  })
})

describe('V1.2 optional preferences normalization and restore', () => {
  it('falls back per whole setting while preserving valid independent settings', () => {
    const valid = { priority: ['bodyRegion','completion','recommendedDay'], completionDirection: 'completeFirst' }
    const result = normalizeDisplayPreferences({ defaultSort: valid, optionSort: { priority: ['completion','completion','bodyRegion'], completionDirection: 'incompleteFirst' }, bodyRegionOrder: ['独自','胸'] })
    expect(result.value.defaultSort).toEqual(valid)
    expect(result.value.optionSort).toEqual(defaultDisplayPreferences.optionSort)
    expect(result.value.bodyRegionOrder).toEqual(['独自','胸'])
    expect(result.warnings.map(row => row.path)).toEqual(['displayPreferences.optionSort'])
  })
  it.each([undefined, null, [], {}, { bodyRegionOrder: ['胸','胸'] }, { bodyRegionOrder: [' 胸'] }, { bodyRegionOrder: [] }, { defaultSort: { priority: ['x','completion','bodyRegion'], completionDirection: 'unknown' } }])('reports defaults for missing or invalid settings: %j', input => {
    const result = normalizeDisplayPreferences(input)
    expect(result.value).toEqual(defaultDisplayPreferences)
    expect(result.warnings.length).toBe(3)
  })
  it('normalizes old Backup for preview, requires that candidate at apply, replaces and reads back exactly; no fact repair', async () => {
    let saved = structuredClone(canonicalFixture)
    const storage = { readCanonical: vi.fn(async () => structuredClone(saved)), writeCanonical: vi.fn(async value => { saved = structuredClone(value) }) } as unknown as CanonicalStorage
    const raw = { format: 'training-check-backup', schemaVersion: 1, createdAt: '2026-10-24T00:00:00Z', payload: structuredClone(canonicalFixture) } as const
    const preview = previewCanonicalRestore(JSON.stringify(raw))
    expect(preview.errors).toEqual([])
    expect(preview.warnings).toHaveLength(3)
    expect(preview.envelope!.payload.displayPreferences).toEqual(defaultDisplayPreferences)
    expect(raw.payload).toEqual(canonicalFixture)
    expect((await applyCanonicalRestore(storage, raw, false)).ok).toBe(false)
    expect(storage.writeCanonical).not.toHaveBeenCalled()
    expect((await applyCanonicalRestore(storage, preview.envelope!, true)).ok).toBe(true)
    expect(saved).toEqual(preview.envelope!.payload)
    const { displayPreferences: _prefs, ...facts } = saved
    expect(facts).toEqual(canonicalFixture)
    expect(createCanonicalBackup(saved, raw.createdAt).payload).toEqual(saved)
    for (const corrupt of [(d: typeof saved) => { d.trainingItems[0].sets = 0 }, (d: typeof saved) => { d.menuEntries[0].trainingItemId = 'missing' }]) {
      const broken = structuredClone(raw); corrupt(broken.payload)
      expect(previewCanonicalRestore(JSON.stringify(broken)).envelope).toBeUndefined()
    }
    vi.mocked(storage.readCanonical).mockResolvedValue(canonicalFixture)
    expect((await applyCanonicalRestore(storage, preview.envelope!, true)).ok).toBe(false)
  })
  it('rebases only explicit preferences changes and preserves latest unrelated sessions and unchanged preferences', () => {
    const base = structuredClone(canonicalFixture), next = structuredClone(base), latest = structuredClone(base)
    next.displayPreferences = structuredClone(defaultDisplayPreferences)
    latest.sessions = []
    const changed = rebaseOwnerChange(base, next, latest)
    expect(changed.sessions).toEqual([])
    expect(changed.displayPreferences).toEqual(defaultDisplayPreferences)
    latest.displayPreferences = { ...structuredClone(defaultDisplayPreferences), bodyRegionOrder: ['独自','胸'] }
    expect(rebaseOwnerChange(base, base, latest).displayPreferences).toEqual(latest.displayPreferences)
  })
})
