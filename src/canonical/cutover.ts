import { identifyInput } from './identify'
import type { BackupEnvelope, CanonicalAppData, ValidationIssue } from './types'
import { validateBackupEnvelope, validateCanonical } from './validate'

export type CutoverState = { authoritative: false } | { authoritative: true; establishedAt: string }
export type LegacyBaseline = { sourceKind: 'legacy-v5-payload' | 'legacy-v6-payload' | 'legacy-v5-backup-envelope' | 'legacy-v6-backup-envelope'; rawJson: string; capturedAt: string }
export type StorageDiagnostic = { stage: string; message: string }
export type StorageResult<T> = { ok: true; value: T; diagnostics: StorageDiagnostic[] } | { ok: false; diagnostics: StorageDiagnostic[] }

/** Adapter boundary. Production IndexedDB and in-memory failure injection share this contract. */
export interface CanonicalStorage {
  readCutoverState(): Promise<CutoverState>
  writeCutoverState(value: CutoverState): Promise<void>
  readBaseline(): Promise<LegacyBaseline | undefined>
  writeBaseline(value: LegacyBaseline): Promise<void>
  readCanonical(): Promise<CanonicalAppData | undefined>
  writeCanonical(value: CanonicalAppData): Promise<void>
}

const invalid = (issues: ValidationIssue[]): StorageDiagnostic[] => issues.map(issue => ({ stage: issue.path, message: issue.message }))
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right)
const legacyKinds = new Set(['legacy-v5-payload', 'legacy-v6-payload', 'legacy-v5-backup-envelope', 'legacy-v6-backup-envelope'])

function validateCandidate(candidate: CanonicalAppData): StorageDiagnostic[] { return invalid(validateCanonical(candidate).errors) }
async function readValidCanonical(storage: CanonicalStorage): Promise<StorageResult<CanonicalAppData>> {
  try {
    const value = await storage.readCanonical()
    if (!value) return { ok: false, diagnostics: [{ stage: 'canonical.read', message: 'canonical dataがありません' }] }
    const errors = validateCandidate(value)
    return errors.length ? { ok: false, diagnostics: errors } : { ok: true, value, diagnostics: [] }
  } catch (error) { return { ok: false, diagnostics: [{ stage: 'canonical.read', message: String(error) }] } }
}

async function ensureBaseline(storage: CanonicalStorage, legacySource: unknown, now: string): Promise<StorageResult<void>> {
  const kind = identifyInput(legacySource)
  if (!legacyKinds.has(kind)) return { ok: false, diagnostics: [{ stage: 'baseline.identify', message: 'known-good legacy sourceではありません' }] }
  try {
    if (await storage.readBaseline()) return { ok: true, value: undefined, diagnostics: [] }
    await storage.writeBaseline({ sourceKind: kind as LegacyBaseline['sourceKind'], rawJson: JSON.stringify(legacySource), capturedAt: now })
    const stored = await storage.readBaseline()
    if (!stored || stored.rawJson !== JSON.stringify(legacySource)) return { ok: false, diagnostics: [{ stage: 'baseline.read-back', message: 'baseline read-backが一致しません' }] }
    return { ok: true, value: undefined, diagnostics: [] }
  } catch (error) { return { ok: false, diagnostics: [{ stage: 'baseline.save', message: String(error) }] } }
}

async function rollback(storage: CanonicalStorage, diagnostics: StorageDiagnostic[]): Promise<StorageDiagnostic[]> {
  try { await storage.writeCutoverState({ authoritative: false }); return diagnostics }
  catch (error) { return [...diagnostics, { stage: 'rollback.write', message: String(error) }] }
}

/**
 * Does not delete or overwrite the legacy active state. Before authoritative
 * adoption, every later failure attempts a marker rollback to legacy-active.
 */
export async function cutoverCanonical(storage: CanonicalStorage, legacySource: unknown, candidate: CanonicalAppData, now: string): Promise<StorageResult<CanonicalAppData>> {
  if (identifyInput(candidate) !== 'canonical-payload') return { ok: false, diagnostics: [{ stage: 'candidate.identify', message: 'canonical payloadではありません' }] }
  const candidateErrors = validateCandidate(candidate)
  if (candidateErrors.length) return { ok: false, diagnostics: candidateErrors.map(value => ({ ...value, stage: `candidate.${value.stage}` })) }
  const baseline = await ensureBaseline(storage, legacySource, now)
  if (!baseline.ok) return baseline
  try { await storage.writeCanonical(candidate) }
  catch (error) { return { ok: false, diagnostics: [{ stage: 'canonical.persist', message: String(error) }] } }
  const persisted = await readValidCanonical(storage)
  if (!persisted.ok) return { ok: false, diagnostics: await rollback(storage, persisted.diagnostics) }
  if (!same(persisted.value, candidate)) return { ok: false, diagnostics: await rollback(storage, [{ stage: 'canonical.read-back', message: 'canonical read-backが一致しません' }]) }
  try { await storage.writeCutoverState({ authoritative: true, establishedAt: now }) }
  catch (error) { return { ok: false, diagnostics: await rollback(storage, [{ stage: 'runtime.adoption', message: String(error) }]) } }
  const runtime = await readValidCanonical(storage)
  if (!runtime.ok) return { ok: false, diagnostics: await rollback(storage, runtime.diagnostics.map(value => ({ ...value, stage: `runtime.${value.stage}` }))) }
  const restart = await readValidCanonical(storage)
  if (!restart.ok) return { ok: false, diagnostics: await rollback(storage, restart.diagnostics.map(value => ({ ...value, stage: `restart.${value.stage}` }))) }
  return { ok: true, value: candidate, diagnostics: [] }
}

/** Startup never silently substitutes legacy data after canonical authority. */
export async function loadCanonicalStartup(storage: CanonicalStorage): Promise<{ kind: 'legacy-active' } | { kind: 'canonical-ready'; data: CanonicalAppData } | { kind: 'canonical-recovery-required'; diagnostics: StorageDiagnostic[] }> {
  try {
    const state = await storage.readCutoverState()
    if (!state.authoritative) return { kind: 'legacy-active' }
    const canonical = await readValidCanonical(storage)
    return canonical.ok ? { kind: 'canonical-ready', data: canonical.value } : { kind: 'canonical-recovery-required', diagnostics: canonical.diagnostics }
  } catch (error) { return { kind: 'canonical-recovery-required', diagnostics: [{ stage: 'startup.cutover-state', message: String(error) }] } }
}

/** Explicit post-authority recovery. It cannot fall back to legacy automatically. */
export async function recoverCanonical(storage: CanonicalStorage, envelope: unknown): Promise<StorageResult<CanonicalAppData>> {
  if (identifyInput(envelope) !== 'canonical-backup-envelope') return { ok: false, diagnostics: [{ stage: 'restore.identify', message: 'canonical Backup envelopeではありません' }] }
  const envelopeErrors = validateBackupEnvelope(envelope)
  if (envelopeErrors.errors.length) return { ok: false, diagnostics: invalid(envelopeErrors.errors) }
  const candidate = (envelope as BackupEnvelope).payload
  try { await storage.writeCanonical(candidate) }
  catch (error) { return { ok: false, diagnostics: [{ stage: 'recovery.persist', message: String(error) }] } }
  const readBack = await readValidCanonical(storage)
  if (!readBack.ok) return readBack
  if (!same(readBack.value, candidate)) return { ok: false, diagnostics: [{ stage: 'recovery.read-back', message: 'recovery read-backが一致しません' }] }
  return { ok: true, value: candidate, diagnostics: [] }
}

/**
 * Explicit restore entrypoint. Only canonical backup envelopes are accepted;
 * the legacy format is deliberately not repaired or migrated here.
 */
export function prepareCanonicalBackupRestore(rawJson: string): StorageResult<CanonicalAppData> {
  let parsed: unknown
  try { parsed = JSON.parse(rawJson) }
  catch (error) { return { ok: false, diagnostics: [{ stage: 'restore.parse', message: String(error) }] } }
  if (identifyInput(parsed) !== 'canonical-backup-envelope') return { ok: false, diagnostics: [{ stage: 'restore.identify', message: 'canonical Backup envelopeではありません' }] }
  const checked = validateBackupEnvelope(parsed)
  if (checked.errors.length) return { ok: false, diagnostics: invalid(checked.errors) }
  return { ok: true, value: (parsed as BackupEnvelope).payload, diagnostics: [] }
}
