import { describe, expect, it, vi } from 'vitest'
import { canonicalFixture, legacyV5PayloadFixture, legacyV6BackupFixture } from './fixtures'
import { validateCanonical } from './validate'
import { createCanonicalBackup, applyCanonicalRestore, previewCanonicalRestore } from './backup'
import { loadCanonicalStartup, type CanonicalStorage } from './cutover'
import { identifyInput } from './identify'

// Authority: H-20261003-09 minimum acceptance 2–10 / DATA_SPEC §10.9.
function memory(input = canonicalFixture) {
  let saved = structuredClone(input)
  const storage: CanonicalStorage = {
    readCanonical: vi.fn(async () => structuredClone(saved)),
    writeCanonical: vi.fn(async value => { saved = structuredClone(value) }),
    readCutoverState: vi.fn(async () => ({ authoritative: true, establishedAt: '2026-10-03T00:00:00Z' })),
    writeCutoverState: vi.fn(), readBaseline: vi.fn(), writeBaseline: vi.fn(),
  }
  return storage
}
describe('V1R ordering compatibility boundary', () => {
  it.each([{ fields: ['performedAt'] }, { fields: ['performedOrder'] }, { fields: ['performedAt', 'performedOrder'] }])('rejects missing %j at startup and Restore without repair or writes', async ({ fields }) => {
    const old = structuredClone(canonicalFixture)
    for (const field of fields) delete (old.sessions[0] as unknown as Record<string, unknown>)[field]
    const exact = JSON.stringify(old)
    expect(identifyInput(old)).toBe('canonical-payload')
    expect(validateCanonical(old).errors.length).toBeGreaterThan(0)
    const startup = memory(old)
    expect((await loadCanonicalStartup(startup)).kind).toBe('canonical-recovery-required')
    expect(startup.writeCanonical).not.toHaveBeenCalled()
    expect(JSON.stringify(await startup.readCanonical())).toBe(exact)
    const envelope = { format: 'training-check-backup', schemaVersion: 1, createdAt: '2026-10-03T00:00:00Z', payload: old } as const
    expect(previewCanonicalRestore(JSON.stringify(envelope)).envelope).toBeUndefined()
    const current = memory()
    expect((await applyCanonicalRestore(current, envelope, true)).ok).toBe(false)
    expect(current.writeCanonical).not.toHaveBeenCalled()
    expect(await current.readCanonical()).toEqual(canonicalFixture)
    expect(JSON.stringify(old)).toBe(exact)
  })
  it.each(['2026-10-03', '2026-10-03T12:00:00', 'invalid', '2026-02-30T00:00:00Z'])('rejects invalid or offsetless instant %s', value => {
    const data = structuredClone(canonicalFixture); data.sessions[0].performedAt = value
    expect(validateCanonical(data).errors.some(issue => issue.path.endsWith('.performedAt'))).toBe(true)
  })
  it.each([-1, 0.5, Infinity, NaN])('rejects non-negative integer violation %s', value => {
    const data = structuredClone(canonicalFixture); data.sessions[0].performedOrder = value
    expect(validateCanonical(data).errors.some(issue => issue.path.endsWith('.performedOrder'))).toBe(true)
  })
  it('rejects duplicate instants with alternate offsets while allowing distinct order', () => {
    const data = structuredClone(canonicalFixture)
    data.sessions.push({ ...structuredClone(data.sessions[0]), id: 'another', performedAt: '2026-09-24T00:00:00Z' })
    expect(validateCanonical(data).errors.some(issue => issue.message.includes('重複'))).toBe(true)
    data.sessions[1].performedOrder = 1
    expect(validateCanonical(data).errors).toEqual([])
  })
  it('preserves ID/date/exact pair through export/Restore/retry/read-back/reload', async () => {
    const source = structuredClone(canonicalFixture)
    source.sessions[0].performedOrder = 17
    const envelope = createCanonicalBackup(source, '2026-10-03T00:00:00Z')
    const storage = memory()
    for (let attempt = 0; attempt < 2; attempt++) {
      expect((await applyCanonicalRestore(storage, envelope, false)).ok).toBe(true)
      expect(await storage.readCanonical()).toEqual(source)
      expect(await loadCanonicalStartup(storage)).toEqual({ kind: 'canonical-ready', data: source })
    }
    expect(envelope.payload.sessions).toEqual(source.sessions)
  })
  it('identifies v5/v6 separately from unsupported old canonical', () => {
    expect(identifyInput(legacyV5PayloadFixture)).toBe('legacy-v5-payload')
    expect(identifyInput(legacyV6BackupFixture)).toBe('legacy-v6-backup-envelope')
    expect(previewCanonicalRestore(JSON.stringify(legacyV6BackupFixture)).errors[0].message).toContain('legacy-v6')
  })
})

it('RFC3339 fractional instants retain precision and equivalent offset uniqueness', () => {
  const data = structuredClone(canonicalFixture)
  data.sessions[0].performedAt = '2026-09-24T09:00:00.1234+09:00'
  data.sessions.push({ ...structuredClone(data.sessions[0]), id: 'precise', performedAt: '2026-09-24T00:00:00.1235Z' })
  expect(validateCanonical(data).errors).toEqual([])
  data.sessions[1].performedAt = '2026-09-24T00:00:00.12340Z'
  expect(validateCanonical(data).errors.some(issue => issue.message.includes('重複'))).toBe(true)
})
