import { describe, expect, it } from 'vitest'
import { applyManMasterBootstrap, createManMasterBootstrapCandidate } from './masterBootstrap'
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

describe('Android MAN Master bootstrap', () => {
  it('creates fresh IDs, approved mappings, and initial setting histories', () => {
    const data = emptyMasterData()
    const result = createManMasterBootstrapCandidate(data, {
      includeFrontPlank: true,
      newId: ids('exercise-fly', 'item-fly', 'change-fly', 'exercise-side', 'item-side', 'change-side', 'exercise-raise', 'item-raise', 'change-raise', 'exercise-front', 'item-front', 'change-front'),
      now: () => '2026-09-28T10:00:00+09:00',
    })
    expect(result.value.exercises.map((value) => value.id)).toEqual(['exercise-fly', 'exercise-side', 'exercise-raise', 'exercise-front'])
    expect(result.mappings).toEqual([
      { sourceExerciseId: 'seed-fly', sourceTrainingItemId: 'seed-item-7', exerciseId: 'exercise-fly', trainingItemId: 'item-fly' },
      { sourceExerciseId: 'seed-side', sourceTrainingItemId: 'seed-item-10', exerciseId: 'exercise-side', trainingItemId: 'item-side' },
      { sourceExerciseId: 'seed-raise', sourceTrainingItemId: 'seed-item-12', exerciseId: 'exercise-raise', trainingItemId: 'item-raise' },
      { sourceExerciseId: 'seed-front', sourceTrainingItemId: 'seed-item-14', exerciseId: 'exercise-front', trainingItemId: 'item-front' },
    ])
    expect(result.value.trainingItems.find((value) => value.id === 'item-fly')).toMatchObject({ weight: 22.5, reps: 15, sets: 4, seat: '2' })
    expect(result.value.trainingItemSettingChanges).toHaveLength(4)
  })

  it('removes weightMode and weight from the no-external-weight approved records', () => {
    const data = emptyMasterData()
    const result = createManMasterBootstrapCandidate(data, { includeFrontPlank: false, newId: ids('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'), now: () => '2026-09-28T10:00:00+09:00' })
    const legRaise = result.value.exercises.find((value) => value.name === 'レッグレイズ')!
    const legRaiseItem = result.value.trainingItems.find((value) => value.displayName === 'レッグレイズ')!
    expect(legRaise).toMatchObject({ usesWeight: false, selfWeightRatio: 30, secondsLoadRatio: 0 })
    expect(legRaise.weightMode).toBeUndefined()
    expect(legRaiseItem.weight).toBeUndefined()
    expect(result.value.exercises).toHaveLength(3)
  })

  it('blocks collisions and repeat insertion without merging or overwriting', () => {
    const data = clone(canonicalFixture)
    data.exercises[0] = { ...data.exercises[0], name: 'サイドレイズ' }
    expect(() => createManMasterBootstrapCandidate(data, { includeFrontPlank: false, newId: ids('new'), now: () => '2026-09-28T10:00:00+09:00' })).toThrow('衝突')
  })

  it('validates, persists, and read-backs all package records before success', async () => {
    const data = emptyMasterData()
    let stored = clone(data)
    const result = await applyManMasterBootstrap({
      writeCanonical: async (value) => { stored = clone(value) },
      readCanonical: async () => clone(stored),
      readCutoverState: async () => ({ authoritative: true }),
      writeCutoverState: async () => {},
      readBaseline: async () => undefined,
      writeBaseline: async () => {},
    }, data, { includeFrontPlank: false, newId: ids('exercise-fly', 'item-fly', 'change-fly', 'exercise-side', 'item-side', 'change-side', 'exercise-raise', 'item-raise', 'change-raise'), now: () => '2026-09-28T10:00:00+09:00' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.trainingItems).toHaveLength(3)
    const proposal = { contractVersion: '1.0', proposalId: 'bootstrap-menu', menu: { name: 'MANメニュー' }, entries: [{ trainingItemId: result.mappings[0].trainingItemId, order: 0 }] }
    const checked = validateMenuProposal(proposal, result.value)
    expect(checked.errors).toEqual([])
    expect(createMenuProposalCandidate(result.value, checked.proposal!, ids('menu', 'entry')).data.menuEntries[0].trainingItemId).toBe(result.mappings[0].trainingItemId)
  })

  it('does not report persistence failure as success and attempts to retain the original dataset', async () => {
    const data = emptyMasterData()
    let writes = 0
    const result = await applyManMasterBootstrap({
      writeCanonical: async () => { writes += 1; if (writes === 1) throw new Error('storage failure') },
      readCanonical: async () => clone(data),
      readCutoverState: async () => ({ authoritative: true }),
      writeCutoverState: async () => {},
      readBaseline: async () => undefined,
      writeBaseline: async () => {},
    }, data, { includeFrontPlank: false, newId: ids('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'), now: () => '2026-09-28T10:00:00+09:00' })
    expect(result.ok).toBe(false)
    expect(writes).toBe(2)
  })
})
