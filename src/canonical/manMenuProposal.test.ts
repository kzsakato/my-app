import { describe, expect, it } from 'vitest'
import { createManMasterBootstrapCandidate } from './masterBootstrap'
import { createAndroidManMenuProposal } from './manMenuProposal'
import { canonicalFixture } from './fixtures'
import { createMenuProposalCandidate, validateMenuProposal } from './trainer'

const clone = <T,>(value: T): T => structuredClone(value)
const ids = (...values: string[]) => {
  let index = 0
  return () => values[index++] ?? `generated-${index}`
}
const emptyMasterData = () => {
  const data = clone(canonicalFixture)
  data.exercises = []
  data.trainingItems = []
  data.trainingItemSettingChanges = []
  data.menus = []
  data.menuEntries = []
  data.sessions = []
  data.activeMenuId = undefined
  return data
}
const bootstrapped = (includeFrontPlank = false) => createManMasterBootstrapCandidate(emptyMasterData(), {
  includeFrontPlank,
  newId: ids(
    'exercise-fly', 'item-fly', 'change-fly', 'exercise-side', 'item-side', 'change-side',
    'exercise-raise', 'item-raise', 'change-raise', 'exercise-front', 'item-front', 'change-front',
  ),
  now: () => '2026-09-28T10:00:00+09:00',
})

describe('Android MAN MenuProposal producer', () => {
  it('uses only fresh canonical TrainingItem IDs in the required H-07 proposal order', () => {
    const bootstrap = bootstrapped()
    const result = createAndroidManMenuProposal(bootstrap.value, bootstrap.mappings, { includeTime: false, newId: () => 'proposal-man-1' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.proposal).toEqual({
      contractVersion: '1.0', proposalId: 'proposal-man-1', menu: { name: 'Android MAN確認メニュー' },
      entries: [
        { trainingItemId: 'item-fly', order: 0 },
        { trainingItemId: 'item-side', order: 1 },
        { trainingItemId: 'item-raise', order: 2 },
      ],
    })
    expect(JSON.stringify(result.proposal)).not.toContain('seed-fly')
    expect(JSON.stringify(result.proposal)).not.toContain('seed-item-7')
    expect(result.proposal.entries.every((entry) => entry.recommendedDay === undefined)).toBe(true)
    expect(validateMenuProposal(result.proposal, bootstrap.value).errors).toEqual([])
  })

  it('adds the optional time entry only when requested', () => {
    const bootstrap = bootstrapped(true)
    const withTime = createAndroidManMenuProposal(bootstrap.value, bootstrap.mappings, { includeTime: true, newId: () => 'proposal-man-time' })
    const withoutTime = createAndroidManMenuProposal(bootstrap.value, bootstrap.mappings, { includeTime: false, newId: () => 'proposal-man-no-time' })
    expect(withTime.ok && withTime.proposal.entries[3]).toEqual({ trainingItemId: 'item-front', order: 3 })
    expect(withoutTime.ok && withoutTime.proposal.entries).toHaveLength(3)
  })

  it('rejects missing or archived mapped TrainingItems before a proposal is emitted', () => {
    const bootstrap = bootstrapped()
    const missing = createAndroidManMenuProposal(bootstrap.value, bootstrap.mappings.slice(0, 2), { includeTime: false, newId: () => 'proposal-missing' })
    expect(missing).toMatchObject({ ok: false })
    const archived = clone(bootstrap.value)
    archived.trainingItems = archived.trainingItems.map((item) => item.id === 'item-side' ? { ...item, lifecycle: 'archived' as const } : item)
    const archivedResult = createAndroidManMenuProposal(archived, bootstrap.mappings, { includeTime: false, newId: () => 'proposal-archived' })
    expect(archivedResult).toMatchObject({ ok: false })
  })

  it('can be applied through the existing H-07 candidate without changing the active menu', () => {
    const bootstrap = bootstrapped()
    bootstrap.value.activeMenuId = 'existing-menu'
    bootstrap.value.menus = [{ id: 'existing-menu', lifecycle: 'active', name: '既存メニュー' }]
    const result = createAndroidManMenuProposal(bootstrap.value, bootstrap.mappings, { includeTime: false, newId: () => 'proposal-apply' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const applied = createMenuProposalCandidate(bootstrap.value, result.proposal, ids('new-menu', 'entry-0', 'entry-1', 'entry-2'))
    expect(applied.data.activeMenuId).toBe('existing-menu')
    expect(applied.data.menuEntries.map((entry) => entry.trainingItemId)).toEqual(['item-fly', 'item-side', 'item-raise'])
  })
})
