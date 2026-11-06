import { previewInitialV13Restore } from './backupV13'
import { describe, expect, it } from 'vitest'
import { canonicalFixture } from './fixtures'
import { projectAnalysisV13 } from './analysisV13'
import { createTrainerContextV2, parseTrainerProposalV2 } from './trainerV13'
import type { RatesPercent } from './contributions'
import type { CanonicalAppData, Session } from './types'

const chest: RatesPercent = { chest: 100, back: 0, arms: 0, shoulders: 0, lowerBody: 0, core: 0 }
const zero: RatesPercent = { ...chest, chest: 0 }
const today = '2026-11-06'
const now = new Date(today + 'T12:00:00')
function base(): CanonicalAppData & { contributions: NonNullable<CanonicalAppData['contributions']> } {
  return { ...structuredClone(canonicalFixture), trainerDataRevision: 3, contributions: { version: 1 as const, byExerciseId: { 'exercise-1': { rates: chest, revision: 1 } } } }
}

describe('V13 QA data projections', () => {
  it('CTX-01 / IDX-01 input: preserves archived IDs and optional active menu without mutating the source', () => {
    const data = base()
    data.exercises.push({ ...data.exercises[0], id: 'ex-archived', lifecycle: 'archived' })
    data.trainingItems.push({ ...data.trainingItems[0], id: 'ti-archived', exerciseId: 'ex-archived', lifecycle: 'archived' })
    data.trainingItemSettingChanges.push({ ...data.trainingItemSettingChanges[0], id: 'change-archived', trainingItemId: 'ti-archived' })
    const before = structuredClone(data)
    const value = createTrainerContextV2(data, now, true)
    expect(value).toMatchObject({ version: 2, fromDate: '2026-07-30', toDate: today, trainingContext: { contractVersion: 2, trainerDataRevision: 3, activeMenuId: 'menu-1' } })
    expect(value.trainingContext.exercises.map(({ id, lifecycle }) => [id, lifecycle])).toEqual([['exercise-1', 'active'], ['ex-archived', 'archived']])
    expect(value.trainingContext.trainingItems.map(({ id, lifecycle }) => [id, lifecycle])).toEqual([['item-1', 'active'], ['ti-archived', 'archived']])
    expect(value.trainingContext.contributionStates).toEqual([{ exerciseId: 'exercise-1', state: 'VALID_ENTRY', rates: chest }, { exerciseId: 'ex-archived', state: 'NO_ENTRY' }])
    expect(data).toEqual(before)
    const { activeMenuId: _, ...unselected } = data
    expect(createTrainerContextV2(unselected, now, true).trainingContext).not.toHaveProperty('activeMenuId')
  })

  it('CTX-02 / PR-03: rejects all-zero rates, missing provenance and raw duplicate keys', () => {
    const data = base()
    expect(() => createTrainerContextV2(data, now, false)).toThrow('CONTRIBUTION_PROVENANCE_UNAVAILABLE')
    data.contributions.byExerciseId['exercise-1'].rates = zero
    expect(() => createTrainerContextV2(data, now, true)).toThrow('INVALID_ENTRY')
    expect(() => parseTrainerProposalV2('{"version":2,"version":2}')).toThrow()
  })

  it('AN-G01/G03/G04/G06: reproduces the independent AX-01 amounts without writing sessions', () => {
    const data = base()
    data.weekStartsOn = 0
    data.exercises = ['A', 'B', 'C', 'Z'].map(id => ({ ...data.exercises[0], id }))
    data.contributions.byExerciseId = {
      A: { rates: { ...zero, chest: 50, shoulders: 50 }, revision: 1 },
      B: { rates: { ...zero, back: 50, lowerBody: 50 }, revision: 1 },
      Z: { rates: chest, revision: 1 },
    }
    const session = (id: string, date: string, exerciseId: string, values: Partial<Session>, snapshot: Partial<Session['snapshot']>): Session => ({
      ...data.sessions[0], ...values, id, date, snapshot: { ...data.sessions[0].snapshot, ...snapshot, exerciseId },
    })
    data.sessions = [
      session('S-A1', '2026-11-02', 'A', { weight: 10, reps: 5, sets: 2, bodyWeight: 60 }, { selfWeightRatio: 10 }),
      session('S-B1', '2026-11-03', 'B', { weight: 0, reps: 10, sets: 4, bodyWeight: 60 }, { selfWeightRatio: 5 }),
      session('S-C1', '2026-11-04', 'C', { weight: 5, reps: 10, sets: 3, bodyWeight: 0 }, { weightMode: 'total' }),
      session('S-A0', '2026-10-26', 'A', { seconds: 30, sets: 1, bodyWeight: 60 }, { measureType: 'time', secondsLoadRatio: 2 }),
    ]
    const before = structuredClone(data.sessions)
    const week = projectAnalysisV13(data, 'week', today)
    if (week.state !== 'AVAILABLE') throw new Error(week.reason)
    expect(week.buckets.map(bucket => bucket.pt)).toEqual([...Array(10).fill(0), 36, 530])
    expect(week.regions).toEqual([1.5, 2, 0, 1.5, 2, 0])
    expect([week.allocated, week.unallocated, week.total]).toEqual([7, 3, 10])
    expect(week.byExercise.has('Z')).toBe(false)
    for (const period of ['month', 'quarter', 'half', 'year'] as const) {
      const projection = projectAnalysisV13(data, period, today)
      if (projection.state !== 'AVAILABLE') throw new Error(projection.reason)
      expect(projection.buckets.map(bucket => bucket.pt)).toEqual(period === 'month' ? [...Array(10).fill(0), 36, 530] : [...Array(11).fill(0), 566])
    }
    data.contributions.byExerciseId = { ...data.contributions.byExerciseId, C: { rates: { ...zero, arms: 100 }, revision: 1 } }
    const after = projectAnalysisV13(data, 'week', today)
    expect(after).toMatchObject({ allocated: 10, unallocated: 0, regions: [1.5, 2, 3, 1.5, 2, 0] })
    expect(data.sessions).toEqual(before)
  })
})

describe('MIG-01 isolated initial Backup preview', () => {
  const envelope = () => ({
    format: 'training-check-backup', schemaVersion: 2, createdAt: '2026-11-06T09:00:00+09:00',
    payload: { ...base(), trainerDataRevision: 0, contributions: { version: 1, byExerciseId: {} } },
  })

  it('preserves all existing facts, including replay IDs and array order', () => {
    const input = envelope()
    input.payload.appliedProposalIds = ['accepted-b', 'accepted-a']
    const { candidate, warnings } = previewInitialV13Restore(JSON.stringify(input))
    const { displayPreferences, ...facts } = candidate
    expect(facts).toEqual(input.payload)
    expect(displayPreferences?.defaultSort.priority).toEqual(['recommendedDay', 'completion', 'bodyRegion'])
    expect(warnings.map(warning => warning.path)).toEqual([
      'displayPreferences.defaultSort', 'displayPreferences.optionSort', 'displayPreferences.bodyRegionOrder',
    ])
  })

  it.each([
    ['old outer version', (input: ReturnType<typeof envelope>) => { input.schemaVersion = 1 }],
    ['wrong inner version', (input: ReturnType<typeof envelope>) => { Object.assign(input.payload, { schemaVersion: 2 }) }],
    ['noninitial revision', (input: ReturnType<typeof envelope>) => { input.payload.trainerDataRevision = 1 }],
    ['duplicate replay ID', (input: ReturnType<typeof envelope>) => { input.payload.appliedProposalIds = ['same', 'same'] }],
    ['pre-existing contribution', (input: ReturnType<typeof envelope>) => {
      input.payload.contributions.byExerciseId = { 'exercise-1': { rates: chest, revision: 1 } }
    }],
  ] as const)('refuses %s before preview', (_, mutate) => {
    const input = envelope()
    mutate(input)
    expect(() => previewInitialV13Restore(JSON.stringify(input))).toThrow()
  })

  it('refuses duplicate raw JSON keys before preview', () => {
    const raw = JSON.stringify(envelope()).replace('"schemaVersion":2', '"schemaVersion":1,"schemaVersion":2')
    expect(() => previewInitialV13Restore(raw)).toThrow()
  })
})
describe('V1.3 analysis and Context calendar boundaries', () => {
  const dates = [
    ['week', '2026-08-17', '2026-08-16', '2026-11-02'],
    ['month', '2025-12-01', '2025-11-30', '2026-11-01'],
    ['quarter', '2024-01-01', '2023-12-31', '2026-10-01'],
    ['half', '2021-01-01', '2020-12-31', '2026-07-01'],
    ['year', '2015-01-01', '2014-12-31', '2026-01-01'],
  ] as const

  it.each(dates)('AN-G06 %s includes the left edge and today, excludes adjacent dates', (period, first, before, last) => {
    const data = base()
    const original = data.sessions[0]
    data.sessions = [before, first, today, '2026-11-07'].map((date, i) => ({
      ...original, id: 'edge-' + i, date, performedAt: date + 'T12:00:00+09:00',
      weight: 2, reps: 3, sets: 1,
    }))
    const projection = projectAnalysisV13(data, period, today)
    if (projection.state !== 'AVAILABLE') throw new Error(projection.reason)
    expect(projection.buckets).toHaveLength(12)
    expect(projection.buckets[0].start).toBe(first)
    expect(projection.buckets[11].start).toBe(last)
    // 2 kg × two sides × 3 reps × one set per included record.
    expect(projection.buckets.map(bucket => bucket.pt)).toEqual([12, ...Array(10).fill(0), 12])
    expect(projection.regions).toEqual([2, 0, 0, 0, 0, 0])
    expect(projection.shares).toEqual([1, 0, 0, 0, 0, 0])
    expect(projection.byExercise.get('exercise-1')).toEqual([2, 0, 0, 0, 0, 0])
    expect([projection.allocated, projection.unallocated, projection.total]).toEqual([2, 0, 2])
  })

  it('AN-G05 keeps legal zero, unallocated records and invalid rates distinct', () => {
    const data = base()
    const session = data.sessions[0]
    data.sessions = []
    expect(projectAnalysisV13(data, 'week', today)).toMatchObject({
      state: 'AVAILABLE', allocated: 0, unallocated: 0, total: 0, shares: undefined,
    })
    data.sessions = [{ ...session, date: today }]
    delete data.contributions.byExerciseId['exercise-1']
    expect(projectAnalysisV13(data, 'week', today)).toMatchObject({
      state: 'AVAILABLE', allocated: 0, unallocated: 5, total: 5, shares: undefined,
    })
    data.contributions.byExerciseId['exercise-1'] = { rates: zero, revision: 1 }
    expect(projectAnalysisV13(data, 'week', today)).toEqual({ state: 'UNAVAILABLE', reason: 'INVALID_ENTRY' })
  })

  it('CTX-01 exports both ends of the inclusive 100-day history window in source order', () => {
    const data = base()
    const original = data.sessions[0]
    data.sessions = ['2026-11-06', '2026-07-29', '2026-07-30', '2026-11-07'].map((date, i) => ({
      ...original, id: 'ctx-edge-' + i, date, performedAt: date + 'T12:00:00+09:00',
    }))
    const output = createTrainerContextV2(data, now, true)
    expect(output.history.map(row => [row.id, row.date])).toEqual([
      ['ctx-edge-0', '2026-11-06'], ['ctx-edge-2', '2026-07-30'],
    ])
  })
})
