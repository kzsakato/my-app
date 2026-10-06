import { expect, it } from 'vitest'
import { canonicalFixture } from './fixtures'
import { completedEntryIds, completedSessionRows } from './topProjection'

it('aggregates Exercise completion across memberships without returning any representative actual', () => {
  const data = structuredClone(canonicalFixture)
  const entry = data.menuEntries[0]
  const entries = [entry, { ...entry, id: 'second-membership' }]
  const extra = { ...data.sessions[0], menuEntryId: undefined }
  expect(completedEntryIds(data, entries, [extra])).toEqual(new Set(entries.map(row => row.id)))
  expect(completedEntryIds(data, entries, [])).toEqual(new Set())
  expect(completedEntryIds(data, entries, [{ ...extra, snapshot: { ...extra.snapshot, exerciseId: 'other' } }])).toEqual(new Set())
})

it('retains every repeated membership and Extra as an independent snapshot row without mutation', () => {
  const data = structuredClone(canonicalFixture)
  const first = data.sessions[0]
  const sessions = [first, { ...first, id: 'repeat' }, { ...first, id: 'extra', menuEntryId: undefined, snapshot: { ...first.snapshot, trainingItemDisplayName: '記録時の別項目', classifications: [{ kind: 'bodyRegion' as const, label: '記録時の部位' }] } }]
  const before = JSON.stringify(sessions)
  const rows = completedSessionRows(sessions)
  expect(rows.map(row => row.session.id)).toEqual([first.id, 'repeat', 'extra'])
  expect(rows[2]).toMatchObject({ label: '記録時の別項目', bodyRegion: '記録時の部位' })
  expect(JSON.stringify(sessions)).toBe(before)
})

it('does not drop compatibility missing from classification-free projection or invent a category', () => {
  const session = structuredClone(canonicalFixture.sessions[0])
  delete session.snapshot.classifications
  const rows = completedSessionRows([session])
  expect(rows).toHaveLength(1)
  expect(rows[0].bodyRegion).toBeUndefined()
  expect(rows[0].label).toBe(session.snapshot.trainingItemDisplayName)
  expect(session.snapshot.classifications).toBeUndefined()
})
