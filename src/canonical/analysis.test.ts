import { describe, expect, it } from 'vitest'
import {
  analysisBucketStart,
  analysisBucketStarts,
  bodyRegionDerivedLoad,
  bodyRegionFrequency,
  exerciseActuals,
  exerciseFrequency,
  overallDerivedLoad,
  referenceTrainingLoad,
} from './analysis'
import { canonicalFixture } from './fixtures'
import type { CanonicalAppData, Session } from './types'

const clone = <T,>(value: T): T => structuredClone(value)

function session(overrides: Partial<Session>): Session {
  return {
    id: 'session-x',
    trainingItemId: 'item-archived',
    date: '2026-09-21',
    weight: 10,
    reps: 3,
    sets: 2,
    bodyWeight: 70,
    snapshot: {
      exerciseId: 'exercise-archived',
      exerciseName: '過去の種目',
      trainingItemDisplayName: '過去の実施項目',
      measureType: 'reps',
      weightMode: 'perSide',
      selfWeightRatio: 50,
      classifications: [{ kind: 'bodyRegion', label: '背中' }],
    },
    ...overrides,
  }
}

describe('canonical analysis', () => {
  it('uses the formal unrounded Session snapshot load formula', () => {
    expect(referenceTrainingLoad(session({}))).toBe(330)
    expect(referenceTrainingLoad(session({
      weight: 1.25,
      reps: 1,
      sets: 1,
      bodyWeight: 63,
      snapshot: { ...session({}).snapshot, selfWeightRatio: 12.5 },
    }))).toBe(10.375)
    expect(referenceTrainingLoad(session({
      weight: undefined,
      reps: undefined,
      seconds: 30,
      sets: 2,
      snapshot: {
        ...session({}).snapshot,
        measureType: 'time',
        secondsLoadRatio: 10,
      },
    }))).toBe(420)
  })

  it('uses configured week boundaries and calendar period starts', () => {
    expect(analysisBucketStart('2026-09-27', 'week', 0)).toBe('2026-09-21')
    expect(analysisBucketStart('2026-09-27', 'week', 6)).toBe('2026-09-27')
    expect(analysisBucketStart('2026-09-27', 'month', 0)).toBe('2026-09-01')
    expect(analysisBucketStart('2026-09-27', 'quarter', 0)).toBe('2026-07-01')
    expect(analysisBucketStart('2026-09-27', 'year', 0)).toBe('2026-01-01')
    expect(analysisBucketStarts({ nowDate: '2026-09-27', period: 'quarter', weekStartsOn: 0, count: 2 })).toEqual(['2026-04-01', '2026-07-01'])
  })

  it('aggregates snapshot facts even after current Master is archived or changed', () => {
    const data = clone(canonicalFixture)
    data.exercises[0] = { ...data.exercises[0], lifecycle: 'archived', name: '現在の別名', classifications: [{ kind: 'bodyRegion', label: '腕' }] }
    data.trainingItems[0] = { ...data.trainingItems[0], lifecycle: 'archived', displayName: '現在の別項目' }
    data.sessions = [
      session({ id: 'archived', menuEntryId: 'entry-missing', date: '2026-09-22' }),
      session({
        id: 'extra-unclassified',
        menuEntryId: undefined,
        date: '2026-09-23',
        snapshot: { ...session({}).snapshot, exerciseId: 'exercise-extra', exerciseName: '追加種目', classifications: undefined },
      }),
    ]
    const overall = overallDerivedLoad(data, 'week', '2026-09-25', 1)
    expect(overall.values).toEqual([660])
    const byRegion = bodyRegionDerivedLoad(data, 'week', '2026-09-25', 1)
    expect(byRegion.series).toEqual([
      { id: '背中', name: '背中', values: [330] },
      { id: '未分類', name: '未分類', values: [330] },
    ])
  })

  it('aggregates exercise actual facts and frequency without MenuEntry dependence', () => {
    const data: CanonicalAppData = clone(canonicalFixture)
    data.sessions = [
      session({ id: 'a', date: '2026-09-21', weight: 10, reps: 3, sets: 2 }),
      session({ id: 'b', date: '2026-09-22', weight: 12, reps: 4, sets: 3, menuEntryId: undefined }),
      session({ id: 'time', date: '2026-09-22', seconds: 30, reps: undefined, sets: 2, snapshot: { ...session({}).snapshot, exerciseId: 'time', exerciseName: 'プランク', measureType: 'time', secondsLoadRatio: 10, classifications: [{ kind: 'bodyRegion', label: '体幹' }] } }),
    ]
    const actual = exerciseActuals(data, 'exercise-archived', 'week', '2026-09-25', 1)
    expect(actual).toMatchObject({ maxWeight: [12], reps: [18], seconds: [0], sets: [5], sessions: [2] })
    expect(exerciseFrequency(data, 'week', '2026-09-25', 1)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'exercise-archived', sessions: 2, reps: 18, sets: 5 }),
      expect.objectContaining({ id: 'time', sessions: 1, seconds: 60, sets: 2 }),
    ]))
    expect(bodyRegionFrequency(data, 'week', '2026-09-25', 1)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: '背中', sessions: 2, reps: 18, sets: 5 }),
      expect.objectContaining({ id: '体幹', sessions: 1, seconds: 60, sets: 2 }),
    ]))
  })
})
