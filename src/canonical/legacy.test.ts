import { describe, expect, it } from 'vitest'
import { canonicalBackupFixture, canonicalFixture, legacyV5PayloadFixture, legacyV6BackupFixture } from './fixtures'
import { createLegacyRecreationPreview } from './legacy'

describe('Stage 1 core boundary: legacy recreation preview', () => {
  it('creates only same-meaning Profile fields and reference counts for v5', () => {
    const input = { ...legacyV5PayloadFixture, profile: { weight: 66, height: 170, age: 40, sex: 'male', analysisStartDate: '2026-09-01' }, sessions: [{ id: 'old' }], settingHistories: [{ id: 'old-history' }] }
    expect(createLegacyRecreationPreview(input)).toMatchObject({
      inputKind: 'legacy-v5-payload', isLegacy: true, profileCandidate: { weight: 66, height: 170, age: 40, sex: 'male' },
      referenceCounts: { sessions: 1, settingHistories: 1 }, excludedFromCanonical: { sessions: 1, settingHistories: 1 },
    })
    expect(createLegacyRecreationPreview(input).profileCandidate).not.toHaveProperty('analysisStartDate')
  })

  it('reads legacy envelopes as legacy source material without canonical unwrapping', () => {
    expect(createLegacyRecreationPreview(legacyV6BackupFixture).inputKind).toBe('legacy-v6-backup-envelope')
    expect(createLegacyRecreationPreview(legacyV6BackupFixture).isLegacy).toBe(true)
  })

  it.each([canonicalFixture, canonicalBackupFixture])('does not make recreation candidates for canonical input', input => {
    const preview = createLegacyRecreationPreview(input)
    expect(preview.isLegacy).toBe(false)
    expect(preview.profileCandidate).toBeUndefined()
  })

  it('does not infer a Profile candidate when legacy weight is invalid', () => {
    expect(createLegacyRecreationPreview({ ...legacyV5PayloadFixture, profile: { weight: 0 } }).profileCandidate).toBeUndefined()
  })
})
