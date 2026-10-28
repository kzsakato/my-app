import { identifyInput } from './identify'
import { recoverCanonical, type CanonicalStorage, type StorageResult } from './cutover'
import { validateBackupEnvelope } from './validate'
import { normalizeDisplayPreferences, withDisplayPreferences } from './displayPreferences'
import type { BackupEnvelope, CanonicalAppData, ValidationResult } from './types'

export type BackupPreview = ValidationResult & { envelope?: BackupEnvelope }

export function createCanonicalBackup(data: CanonicalAppData, createdAt: string): BackupEnvelope {
  const envelope: BackupEnvelope = { format: 'training-check-backup', schemaVersion: 1, createdAt, payload: withDisplayPreferences(structuredClone(data)) }
  const checked = validateBackupEnvelope(envelope)
  if (checked.errors.length) throw new Error(checked.errors.map(issue => `${issue.path}: ${issue.message}`).join(' / '))
  return envelope
}

export function previewCanonicalRestore(raw: string): BackupPreview {
  let input: unknown
  try { input = JSON.parse(raw) }
  catch { return { errors: [{ path: 'JSON', message: 'JSONを解析できません' }], warnings: [] } }
  const kind = identifyInput(input)
  if (kind !== 'canonical-backup-envelope') return { errors: [{ path: 'format/schema', message: `正規バックアップではありません (${kind})。rawデータ・旧形式の自動変換には対応していません。` }], warnings: [] }
  // Normalize only the optional settings, before validating all required facts.
  const envelope = input as BackupEnvelope
  const normalized = normalizeDisplayPreferences(envelope.payload?.displayPreferences)
  if (envelope.payload && typeof envelope.payload === 'object' && !Array.isArray(envelope.payload)) {
    envelope.payload.displayPreferences = normalized.value
  }
  const checked = validateBackupEnvelope(envelope)
  return { ...checked, warnings: [...checked.warnings, ...normalized.warnings], envelope: checked.errors.length ? undefined : envelope }
}

export async function applyCanonicalRestore(storage: CanonicalStorage, envelope: BackupEnvelope, warningsAccepted: boolean): Promise<StorageResult<CanonicalAppData>> {
  const candidate = structuredClone(envelope)
  const checked = previewCanonicalRestore(JSON.stringify(candidate))
  // Apply must receive the exact normalized preview, never a raw fallback input.
  if (checked.envelope && JSON.stringify(checked.envelope) !== JSON.stringify(candidate)) return {
    ok: false, diagnostics: [{ stage: 'preview', message: 'Warningの明示確認が必要です' }],
  }
  if (checked.errors.length || (checked.warnings.length && !warningsAccepted)) return {
    ok: false, diagnostics: [...checked.errors.map(issue => ({ stage: issue.path, message: issue.message })),
      ...(checked.warnings.length && !warningsAccepted ? [{ stage: 'warnings', message: 'Warningの明示確認が必要です' }] : [])],
  }
  // Existing adapter persists the whole AppData in one IndexedDB put, then verifies read-back.
  // Neither legacy state nor the canonical authority marker is changed here.
  return recoverCanonical(storage, candidate)
}
