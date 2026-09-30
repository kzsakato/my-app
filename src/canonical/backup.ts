import { identifyInput } from './identify'
import { recoverCanonical, type CanonicalStorage, type StorageResult } from './cutover'
import { validateBackupEnvelope } from './validate'
import type { BackupEnvelope, CanonicalAppData, ValidationResult } from './types'

export type BackupPreview = ValidationResult & { envelope?: BackupEnvelope }

export function createCanonicalBackup(data: CanonicalAppData, createdAt: string): BackupEnvelope {
  const envelope: BackupEnvelope = { format: 'training-check-backup', schemaVersion: 1, createdAt, payload: structuredClone(data) }
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
  // schemaVersion 1 is the sole supported canonical version. No migration/repair is inferred.
  const checked = validateBackupEnvelope(input)
  return { ...checked, envelope: checked.errors.length ? undefined : input as BackupEnvelope }
}

export async function applyCanonicalRestore(storage: CanonicalStorage, envelope: BackupEnvelope, warningsAccepted: boolean): Promise<StorageResult<CanonicalAppData>> {
  const candidate = structuredClone(envelope)
  const checked = previewCanonicalRestore(JSON.stringify(candidate))
  if (checked.errors.length || (checked.warnings.length && !warningsAccepted)) return {
    ok: false, diagnostics: [...checked.errors.map(issue => ({ stage: issue.path, message: issue.message })),
      ...(checked.warnings.length && !warningsAccepted ? [{ stage: 'warnings', message: 'Warningの明示確認が必要です' }] : [])],
  }
  // Existing adapter persists the whole AppData in one IndexedDB put, then verifies read-back.
  // Neither legacy state nor the canonical authority marker is changed here.
  return recoverCanonical(storage, candidate)
}
