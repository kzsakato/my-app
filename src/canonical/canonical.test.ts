import { describe, expect, it } from 'vitest'
import { canonicalBackupFixture, canonicalFixture, legacyV5PayloadFixture, legacyV6BackupFixture, legacyV6PayloadFixture } from './fixtures'
import { identifyInput } from './identify'
import { addTrainingItem, createSessionSnapshot, updateTrainingItem } from './operations'
import { validateBackupEnvelope, validateCanonical } from './validate'

const clone = <T>(value: T): T => structuredClone(value)

describe('core invariant: payload identification', () => {
  it.each([
    [legacyV5PayloadFixture, 'legacy-v5-payload'],
    [legacyV6PayloadFixture, 'legacy-v6-payload'],
    [legacyV6BackupFixture, 'legacy-v6-backup-envelope'],
    [canonicalFixture, 'canonical-payload'],
    [canonicalBackupFixture, 'canonical-backup-envelope'],
  ] as const)('identifies %s without unwrapping it', (input, expected) => expect(identifyInput(input)).toBe(expected))
})

describe('core invariant: canonical validation', () => {
  it('accepts a complete canonical fixture and its backup envelope', () => {
    expect(validateCanonical(canonicalFixture).errors).toEqual([])
    expect(validateBackupEnvelope(canonicalBackupFixture).errors).toEqual([])
  })

  it('requires an active menu when activeMenuId is set', () => {
    const invalid = clone(canonicalFixture)
    invalid.menus[0].lifecycle = 'archived'
    expect(validateCanonical(invalid).errors.map(value => value.path)).toContain('activeMenuId')
  })

  it('requires snapshots to retain the measurement discriminator and copied classification meaning', () => {
    const invalid = clone(canonicalFixture)
    invalid.sessions[0].snapshot.classifications = [{ kind: 'bodyRegion', label: '胸' }, { kind: 'bodyRegion', label: '胸' }]
    expect(validateCanonical(invalid).errors.map(value => value.path)).toContain('sessions[0].snapshot.classifications[1]')
  })

  it('rejects a time field on a reps item', () => {
    const invalid = clone(canonicalFixture)
    invalid.trainingItems[0].seconds = 30
    expect(validateCanonical(invalid).errors.map(value => value.path)).toContain('trainingItems[0].seconds')
  })

  it('requires an initial setting history record for every TrainingItem', () => {
    const invalid = clone(canonicalFixture)
    invalid.trainingItemSettingChanges = []
    expect(validateCanonical(invalid).errors.map(value => value.path)).toContain('trainingItemSettingChanges')
  })
})

describe('core invariant: canonical operations', () => {
  it('writes the initial full setting snapshot at item creation', () => {
    const base = clone(canonicalFixture); base.trainingItems = []; base.trainingItemSettingChanges = []
    const result = addTrainingItem(base, canonicalFixture.trainingItems[0], { newId: () => 'change-new', now: () => '2026-09-24T10:00:00+09:00' })
    expect(result.trainingItemSettingChanges).toEqual([{ id: 'change-new', trainingItemId: 'item-1', changedAt: '2026-09-24T10:00:00+09:00', snapshot: { weight: 18, reps: 15, seconds: undefined, sets: 5, seat: undefined, standardMemo: undefined } }])
  })

  it('keeps same-day material changes as separate full-snapshot records', () => {
    const first = updateTrainingItem(canonicalFixture, { ...canonicalFixture.trainingItems[0], weight: 20 }, { newId: () => 'change-2', now: () => '2026-09-24T10:00:00+09:00' })
    const second = updateTrainingItem(first, { ...first.trainingItems[0], weight: 22 }, { newId: () => 'change-3', now: () => '2026-09-24T11:00:00+09:00' })
    expect(second.trainingItemSettingChanges.map(value => value.id)).toEqual(['change-1', 'change-2', 'change-3'])
  })

  it('copies classifications into the Session snapshot instead of retaining Exercise references', () => {
    const snapshot = createSessionSnapshot(canonicalFixture.trainingItems[0], canonicalFixture.exercises[0])
    canonicalFixture.exercises[0].classifications![0].label = '変更後'
    expect(snapshot.classifications).toEqual([{ kind: 'bodyRegion', label: '胸' }])
    canonicalFixture.exercises[0].classifications![0].label = '胸'
  })
})

describe('provisional policy boundary', () => {
  it('does not encode numeric plausibility thresholds as canonical errors', () => {
    const unusual = clone(canonicalFixture)
    unusual.trainingItems[0].weight = 9999
    unusual.sessions[0].weight = 9999
    expect(validateCanonical(unusual).errors).toEqual([])
  })

  it('does not decide cutover storage, rollback, or runtime import behavior', () => {
    expect(identifyInput(canonicalBackupFixture)).toBe('canonical-backup-envelope')
  })
})
