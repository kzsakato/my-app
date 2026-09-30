import { describe, expect, it } from 'vitest'
import { canonicalFixture } from './fixtures'
import { currentWeekSessions, latestRunSession, weeklyLoadSummary } from './baseline'
import type { CanonicalAppData, Session } from './types'

const session = (date: string, load: number): Session => ({ ...structuredClone(canonicalFixture.sessions[0]), id: date, date, weight: load, reps: 1, sets: 1, snapshot: { ...canonicalFixture.sessions[0].snapshot, weightMode: 'total' } })
const data = (sessions: Session[]): CanonicalAppData => ({ ...structuredClone(canonicalFixture), sessions })

describe('H-12/H-13 canonical baseline projections', () => {
  it('uses all completed observed weeks with interior zero weeks and excludes the partial week', () => {
    const value = data([session('2026-08-24', 100), session('2026-09-07', 300), session('2026-09-14', 400), session('2026-09-21', 500), session('2026-09-29', 9000)])
    expect(weeklyLoadSummary(value, '2026-09-30')).toEqual({ current: 9000, average: 260, acwr: 2.5, completedWeeks: 5 })
    expect(value).toEqual(data(value.sessions))
  })
  it('does not pad pre-recording weeks or current-only/empty history', () => {
    expect(weeklyLoadSummary(data([]), '2026-09-30')).toMatchObject({ average: undefined, acwr: undefined, completedWeeks: 0 })
    expect(weeklyLoadSummary(data([session('2026-09-30', 100)]), '2026-09-30')).toMatchObject({ average: undefined, acwr: undefined, completedWeeks: 0 })
    expect(weeklyLoadSummary(data([session('2026-09-07', 300)]), '2026-09-30')).toMatchObject({ average: 100, acwr: undefined, completedWeeks: 3 })
  })
  it('distinguishes unavailable zero denominator from valid zero numerator', () => {
    expect(weeklyLoadSummary(data([session('2026-08-24', 0), session('2026-09-21', 500)]), '2026-09-30').acwr).toBeUndefined()
    expect(weeklyLoadSummary(data([session('2026-08-24', 100)]), '2026-09-30').acwr).toBe(0)
  })
  it('includes history beyond the 12 chart buckets without changing snapshots', () => {
    const value = data([session('2026-06-01', 1700)])
    expect(weeklyLoadSummary(value, '2026-09-30')).toMatchObject({ completedWeeks: 17, average: 100 })
    value.exercises[0].weightMode = 'perSide'
    value.exercises[0].selfWeightRatio = 100
    expect(weeklyLoadSummary(value, '2026-09-30').average).toBe(100)
  })
  it('re-buckets for the configured week boundary and rolls over without mutating Sessions', () => {
    const value = data([session('2026-09-27', 100), session('2026-09-28', 200)])
    expect(weeklyLoadSummary(value, '2026-09-30')).toMatchObject({ current: 200, average: 100 })
    value.weekStartsOn = 6
    expect(weeklyLoadSummary(value, '2026-09-30')).toMatchObject({ current: 300, average: undefined })
    expect(weeklyLoadSummary(value, '2026-10-04')).toMatchObject({ current: 0, average: 300 })
  })
  it('separates membership and extra completion and excludes both adjacent weeks', () => {
    const value = data([session('2026-09-27', 10), session('2026-09-28', 20), { ...session('2026-09-29', 30), menuEntryId: undefined }, session('2026-10-05', 40)])
    expect(currentWeekSessions(value, '2026-09-30')).toHaveLength(2)
    expect(latestRunSession(value, '2026-09-30', 'item-1', 'entry-1')?.date).toBe('2026-09-28')
    expect(latestRunSession(value, '2026-09-30', 'item-1', 'different-entry')).toBeUndefined()
    expect(latestRunSession(value, '2026-09-30', 'item-1')?.date).toBe('2026-09-29')
  })
  it('preserves date-only tie order for cancellation', () => {
    const first = session('2026-09-28', 10)
    const second = { ...first, id: 'second' }
    expect(latestRunSession(data([first, second]), '2026-09-30', 'item-1', 'entry-1')?.id).toBe(first.id)
  })
})
