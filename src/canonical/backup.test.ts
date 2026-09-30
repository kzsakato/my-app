import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyCanonicalRestore, createCanonicalBackup, previewCanonicalRestore } from './backup'
import { canonicalFixture, legacyV6BackupFixture } from './fixtures'
import type { CanonicalStorage } from './cutover'
import * as validation from './validate'

function memory() {
  let saved = structuredClone(canonicalFixture)
  const storage: CanonicalStorage = {
    readCanonical: vi.fn(async () => structuredClone(saved)),
    writeCanonical: vi.fn(async value => { saved = structuredClone(value) }),
    readCutoverState: vi.fn(async () => ({ authoritative: true, establishedAt: '2026-09-01T00:00:00Z' })),
    writeCutoverState: vi.fn(), readBaseline: vi.fn(), writeBaseline: vi.fn(),
  }
  return storage
}
const backup = () => createCanonicalBackup(canonicalFixture, '2026-09-30T01:00:00Z')
afterEach(() => vi.restoreAllMocks())

describe('canonical full backup/restore', () => {
  it('exports all AppData without mutation and replaces instead of merging, then reads back', async () => {
    const source = structuredClone(canonicalFixture)
    source.appliedProposalIds = ['applied']
    source.weekStartsOn = 6
    const exported = createCanonicalBackup(source, '2026-09-30T01:00:00Z')
    expect(exported.payload).toEqual(source)
    exported.payload.profile.weight = 70
    expect(source.profile.weight).toBe(66)
    const storage = memory()
    expect((await applyCanonicalRestore(storage, exported, false)).ok).toBe(true)
    expect(await storage.readCanonical()).toEqual(exported.payload)
    expect(storage.writeCutoverState).not.toHaveBeenCalled()
    expect(storage.writeBaseline).not.toHaveBeenCalled()
  })
  it.each(['{', JSON.stringify(canonicalFixture), JSON.stringify(legacyV6BackupFixture), JSON.stringify({ ...backup(), schemaVersion: 2 })])('rejects malformed/raw/legacy/unsupported input without writes', raw => {
    expect(previewCanonicalRestore(raw).errors.length).toBeGreaterThan(0)
    expect(previewCanonicalRestore(raw).envelope).toBeUndefined()
  })
  it('revalidates duplicate IDs, bad references and domains at apply, leaving storage intact', async () => {
    for (const corrupt of [
      (value: ReturnType<typeof backup>) => { value.payload.exercises.push(value.payload.exercises[0]) },
      (value: ReturnType<typeof backup>) => { value.payload.sessions[0].menuEntryId = 'missing' },
      (value: ReturnType<typeof backup>) => { value.payload.trainingItems[0].sets = 0 },
    ]) {
      const value = backup(); corrupt(value)
      const storage = memory()
      expect((await applyCanonicalRestore(storage, value, true)).ok).toBe(false)
      expect(storage.writeCanonical).not.toHaveBeenCalled()
      expect(await storage.readCanonical()).toEqual(canonicalFixture)
    }
  })
  it('preserves and explicitly gates warnings (injected because current validator defines no warning cases)', async () => {
    const original = validation.validateBackupEnvelope
    vi.spyOn(validation, 'validateBackupEnvelope').mockImplementation(value => ({ ...original(value), warnings: [{ path: 'profile', message: 'test warning' }] }))
    const value = backup(), storage = memory()
    expect(previewCanonicalRestore(JSON.stringify(value)).warnings).toHaveLength(1)
    expect((await applyCanonicalRestore(storage, value, false)).ok).toBe(false)
    expect(storage.writeCanonical).not.toHaveBeenCalled()
    expect((await applyCanonicalRestore(storage, value, true)).ok).toBe(true)
  })
  it('reports persistence failure and read-back mismatch/failure without changing authority', async () => {
    const value = backup(); value.payload.profile.weight = 70
    const failed = memory()
    vi.mocked(failed.writeCanonical).mockRejectedValue(new Error('quota'))
    expect((await applyCanonicalRestore(failed, value, false)).ok).toBe(false)
    expect(await failed.readCanonical()).toEqual(canonicalFixture)
    for (const mismatch of [true, false]) {
      const storage = memory()
      if (mismatch) vi.mocked(storage.readCanonical).mockResolvedValue(canonicalFixture)
      else vi.mocked(storage.readCanonical).mockRejectedValue(new Error('read failure'))
      expect((await applyCanonicalRestore(storage, value, false)).ok).toBe(false)
      expect(storage.writeCutoverState).not.toHaveBeenCalled()
    }
  })
})
