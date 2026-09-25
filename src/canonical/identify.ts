/** Structural input identification only. It does not validate or unwrap data. */
export type InputKind =
  | 'legacy-v5-payload'
  | 'legacy-v6-payload'
  | 'legacy-v5-backup-envelope'
  | 'legacy-v6-backup-envelope'
  | 'canonical-payload'
  | 'canonical-backup-envelope'
  | 'unsupported'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

export function identifyInput(value: unknown): InputKind {
  if (!isRecord(value)) return 'unsupported'

  if (value.format === 'training-check-backup' && value.schemaVersion === 1) {
    if (!isRecord(value.payload)) return 'unsupported'
    if (value.payload.schemaVersion === 1) return 'canonical-backup-envelope'
    if (value.payload.version === 5) return 'legacy-v5-backup-envelope'
    if (value.payload.version === 6) return 'legacy-v6-backup-envelope'
    return 'unsupported'
  }

  if (value.version === 5) return 'legacy-v5-payload'
  if (value.version === 6) return 'legacy-v6-payload'
  if (value.schemaVersion === 1) return 'canonical-payload'
  return 'unsupported'
}
