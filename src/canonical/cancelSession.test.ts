import { expect, it } from 'vitest'
import { cancelSession } from './cancelSession'
import { canonicalFixture } from './fixtures'
import { previousExerciseSession } from './baseline'

it('cancels only the supplied ID even for equal actuals/date/item/entry; retry cannot consume a sibling', () => {
  const data = structuredClone(canonicalFixture)
  const a = { ...data.sessions[0], id: 'A', performedOrder: 0 }
  const b = { ...a, id: 'B', performedOrder: 1 }
  const c = { ...a, id: 'C', performedOrder: 2, menuEntryId: undefined }
  data.sessions = [c, b, a]
  const before = JSON.stringify(data)
  const remaining = cancelSession(data, 'B')
  expect(JSON.stringify(remaining)).toBe(JSON.stringify({ ...data, sessions: [c, a] }))
  expect(JSON.stringify(data)).toBe(before)
  expect(cancelSession(remaining, 'B')).toBe(remaining)
  expect(cancelSession(remaining, a.trainingItemId)).toBe(remaining)
  expect(cancelSession(remaining, a.date)).toBe(remaining)
  expect(previousExerciseSession(remaining, a.snapshot.exerciseId)).toEqual(c)
  expect(cancelSession(cancelSession(remaining, 'C'), 'A').sessions).toEqual([])
})
