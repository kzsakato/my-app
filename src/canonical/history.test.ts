import { describe, expect, it } from 'vitest'
import { canonicalFixture } from './fixtures'
import { exerciseHistory } from './history'

describe('canonical exerciseHistory', () => {
  it('uses the session snapshot exercise ID and preserves Monday boundaries', () => {
    const sessions = [{ ...canonicalFixture.sessions[0], date: '2026-09-21' }]
    expect(exerciseHistory(sessions, 'exercise-1', new Date('2026-09-27T10:00:00+09:00'))).toBe('○○○○○○○｜●○○○○○○')
  })

  it('does not count a session from another snapshot exercise', () => {
    const sessions = [{ ...canonicalFixture.sessions[0], date: '2026-09-21', snapshot: { ...canonicalFixture.sessions[0].snapshot, exerciseId: 'other' } }]
    expect(exerciseHistory(sessions, 'exercise-1', new Date('2026-09-27T10:00:00+09:00'))).toBe('○○○○○○○｜○○○○○○○')
  })
})

// Fixed calendar oracle: Sep20 (Sunday) through Oct3 (Saturday), 2026.
it.each([
  [0, '○｜○○○○○○○｜○○○○○○'],
  [1, '○○｜○○○○○○○｜○○○○○'],
  [2, '○○○｜○○○○○○○｜○○○○'],
  [3, '○○○○｜○○○○○○○｜○○○'],
  [4, '○○○○○｜○○○○○○○｜○○'],
  [5, '○○○○○○｜○○○○○○○｜○'],
  [6, '○○○○○○○｜○○○○○○○'],
] as const)('OIC-001/015 uses configured weekday %s over the 14-day window', (weekStartsOn, expected) => {
  expect(exerciseHistory([], 'exercise-1', new Date('2026-10-03T12:00:00+09:00'), weekStartsOn)).toBe(expected)
})
