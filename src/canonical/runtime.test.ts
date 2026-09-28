import { describe, expect, it } from 'vitest'
import { canonicalFixture } from './fixtures'
import { createCanonicalSession, createInitialCanonicalCandidate, weekStart } from './runtime'
import { validateCanonical } from './validate'

describe('Stage 3 canonical runtime boundary', () => {
  it('creates an explicit empty candidate and copies only the allowed Profile fields', () => {
    const candidate = createInitialCanonicalCandidate({ weight: 66, height: 170, age: 40, sex: 'male' })
    expect(candidate).toMatchObject({ schemaVersion: 1, weekStartsOn: 0, profile: { weight: 66, height: 170, age: 40, sex: 'male' } })
    expect(candidate.exercises).toEqual([])
    expect(candidate.trainingItems).toEqual([])
    expect(candidate.menus).toEqual([])
    expect(candidate.sessions).toEqual([])
    expect(validateCanonical(candidate).errors).toEqual([])
  })

  it('uses the configured week boundary without modifying session facts', () => {
    expect(weekStart('2026-09-27', 0)).toBe('2026-09-21')
    expect(weekStart('2026-09-27', 6)).toBe('2026-09-27')
  })

  it('persists actual values and a copied snapshot for normal and extra execution', () => {
    const item = canonicalFixture.trainingItems[0]
    const exercise = canonicalFixture.exercises[0]
    const session = createCanonicalSession({ id: 'session-new', item, exercise, date: '2026-09-28', weight: 20, reps: 12, sets: 4, bodyWeight: 66, menuEntryId: 'entry-1' })
    expect(session).toMatchObject({ trainingItemId: item.id, menuEntryId: 'entry-1', weight: 20, reps: 12, sets: 4 })
    expect(session.snapshot).toEqual(expect.objectContaining({ exerciseId: exercise.id, trainingItemDisplayName: item.displayName }))
  })
})
