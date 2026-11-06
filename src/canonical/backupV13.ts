import { contributionError, exactKeys, record } from './contributions'
import { normalizeDisplayPreferences } from './displayPreferences'
import { parseUniqueJson } from './trainerV11'
import { validateBackupEnvelope } from './validate'
import type { CanonicalAppData } from './types'

export function previewInitialV13Restore(raw: string) {
  const input = parseUniqueJson(raw)
  if (!record(input) || !exactKeys(input, ['format', 'schemaVersion', 'createdAt', 'payload']) ||
      input.format !== 'training-check-backup' || input.schemaVersion !== 2 || !record(input.payload)) {
    throw new Error('V13_BACKUP_VERSION_REQUIRED')
  }
  const payload = input.payload as CanonicalAppData
  const normalized = normalizeDisplayPreferences(payload.displayPreferences)
  const candidate = { ...payload, displayPreferences: normalized.value }
  const checked = validateBackupEnvelope({ ...input, schemaVersion: 1, payload: candidate })
  if (checked.errors.length || contributionError(candidate) || candidate.trainerDataRevision !== 0 ||
      Object.keys(candidate.contributions!.byExerciseId).length) throw new Error('INVALID_INITIAL_V13_BACKUP')
  return { candidate, warnings: [...checked.warnings, ...normalized.warnings] }
}
