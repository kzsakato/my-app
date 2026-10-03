import { it, expect } from 'vitest'
import { analysisBucketStart, analysisBucketStarts, type AnalysisPeriod } from './analysis'
import { currentWeekSessions, previousExerciseSession } from './baseline'
import { canonicalFixture } from './fixtures'

// Fixed calendar oracles; no Date/Clock/array/UUID inference repairs Session facts.
it.each([
  ['2026-06-30', 'month', '2026-06-01'], ['2026-07-01', 'month', '2026-07-01'],
  ['2026-06-30', 'quarter', '2026-04-01'], ['2026-07-01', 'quarter', '2026-07-01'],
  ['2026-06-30', 'half', '2026-01-01'], ['2026-07-01', 'half', '2026-07-01'],
  ['2026-12-31', 'year', '2026-01-01'], ['2027-01-01', 'year', '2027-01-01'],
] as const)('%s %s bucket is %s independent of week setting', (date, period, expected) => {
  for (let day = 0; day < 7; day++) expect(analysisBucketStart(date, period, day as 0)).toBe(expected)
})
it.each([
  [0, '2026-09-28'], [1, '2026-09-29'], [2, '2026-09-30'],
  [3, '2026-10-01'], [4, '2026-10-02'], [5, '2026-10-03'], [6, '2026-09-27'],
] as const)('week setting %s starts %s on Oct3', (day, expected) => {
  expect(analysisBucketStart('2026-10-03', 'week', day)).toBe(expected)
  const data = structuredClone(canonicalFixture); data.weekStartsOn = day
  data.sessions[0].date = expected
  expect(currentWeekSessions(data, '2026-10-03')).toHaveLength(1)
  data.sessions[0].date = '2026-09-26'
  expect(currentWeekSessions(data, '2026-10-03')).toHaveLength(0)
})
it('half-year keeps 12 baseline chart buckets and rollover at July/year', () => {
  expect(analysisBucketStarts({ nowDate: '2026-07-01', period: 'half', weekStartsOn: 0, count: 3 })).toEqual(['2025-07-01', '2026-01-01', '2026-07-01'])
})
it('previous actual uses exact fractions across offset representations and shuffled arrays', () => {
  const data = structuredClone(canonicalFixture)
  const first = { ...data.sessions[0], id: 'z-older', performedAt: '2026-09-24T09:00:00.1234+09:00' }
  const next = { ...first, id: 'a-newer', performedAt: '2026-09-24T00:00:00.1235Z' }
  for (const rows of [[next, first], [first, next]]) { data.sessions = rows; expect(previousExerciseSession(data, 'exercise-1')?.id).toBe('a-newer') }
})
