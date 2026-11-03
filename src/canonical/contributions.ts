import type { CanonicalAppData } from './types'

// Authority: Data Contract v1.0 683d40a + supplement 01 c1fec8d.
export const contributionKeys = ['chest', 'back', 'arms', 'shoulders', 'lowerBody', 'core'] as const
export const contributionLabels = ['胸', '背中', '腕', '肩', '下半身', '体幹'] as const
export type ContributionKey = typeof contributionKeys[number]
export type RatesPercent = Record<ContributionKey, number>
export type Contributions = { version: 1; byExerciseId: Record<string, { rates: RatesPercent; revision: number }> }
export const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
export const safeRevision = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0
export function exactKeys(x: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []) {
  return required.every(k => Object.hasOwn(x, k)) && Object.keys(x).every(k => required.includes(k) || optional.includes(k))
}
export function validRates(x: unknown): x is RatesPercent {
  return record(x) && exactKeys(x, contributionKeys) && contributionKeys.every(k => typeof x[k] === 'number' && Number.isInteger(x[k]) && x[k] >= 0 && x[k] <= 100 && x[k] % 5 === 0) && contributionKeys.reduce((sum, k) => sum + (x[k] as number), 0) === 100
}
export function contributionError(data: Pick<CanonicalAppData, 'exercises' | 'contributions' | 'trainerDataRevision' | 'appliedProposalIds'>): string | undefined {
  if (!Array.isArray(data.exercises) || data.exercises.some(e => !record(e) || typeof e.id !== 'string' || !e.id) || new Set(data.exercises.map(e => e.id)).size !== data.exercises.length) return 'MASTER_UNAVAILABLE'
  if (!safeRevision(data.trainerDataRevision)) return 'REVISION_OR_PROVENANCE_UNAVAILABLE'
  const c: unknown = data.contributions
  if (!record(c) || !exactKeys(c, ['version', 'byExerciseId']) || c.version !== 1 || !record(c.byExerciseId)) return 'MASTER_UNAVAILABLE'
  const ids = new Set(data.exercises.map(e => e.id))
  if (!Array.isArray(data.appliedProposalIds) || data.appliedProposalIds.some(id => typeof id !== 'string' || !id) || new Set(data.appliedProposalIds).size !== data.appliedProposalIds.length) return 'PROPOSAL_HISTORY_UNAVAILABLE'
  for (const [id, entry] of Object.entries(c.byExerciseId)) {
    if (!ids.has(id) || !record(entry) || !exactKeys(entry, ['rates', 'revision']) || !validRates(entry.rates) || !safeRevision(entry.revision)) return 'INVALID_ENTRY'
  }
}

/** No shape/timestamp-only legacy migration. The current cutover record cannot
 * attest that a later Restore did not replace the root. No writer is enabled
 * by this read-only validator. */
export const initialContributionWriteUnavailable = 'LEGACY_PROVENANCE_AND_ALL_WRITERS_NOT_ESTABLISHED'
export function rejectUnintegratedV13Write(...values: unknown[]): void {
  if (values.some(v => record(v) && (Object.hasOwn(v, 'contributions') || Object.hasOwn(v, 'trainerDataRevision')))) throw new Error(initialContributionWriteUnavailable)
}
