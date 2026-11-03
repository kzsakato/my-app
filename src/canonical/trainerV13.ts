import { createTrainerContextV11, parseUniqueJson } from './trainerV11'
import { contributionError, exactKeys, initialContributionWriteUnavailable, record, safeRevision, validRates, type RatesPercent } from './contributions'
import { validateCanonical } from './validate'
import type { CanonicalAppData } from './types'

export type InitialContribution = { type: 'setInitialContribution'; exerciseId: string; expectedState: 'NO_ENTRY'; rates: RatesPercent; reason: string; expectedRevision?: 0 }
export type TrainerProposalV2 = { format: 'training-project.trainer-proposal'; version: 2; proposalId: string; baseRevision: number; operations: InitialContribution[] }
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0
export function parseTrainerProposalV2(raw: string): TrainerProposalV2 {
  return validateTrainerProposalV2(parseUniqueJson(raw))
}
export function validateTrainerProposalV2(v: unknown): TrainerProposalV2 {
  if (!record(v) || !exactKeys(v, ['format', 'version', 'proposalId', 'baseRevision', 'operations']) || v.format !== 'training-project.trainer-proposal' || v.version !== 2 || !id(v.proposalId) || !safeRevision(v.baseRevision) || !Array.isArray(v.operations) || !v.operations.length) throw new Error('INVALID_V2_ROOT')
  const ids = new Set<string>()
  for (const op of v.operations) {
    if (!record(op) || !exactKeys(op, ['type', 'exerciseId', 'expectedState', 'rates', 'reason'], ['expectedRevision']) || op.type !== 'setInitialContribution' || !id(op.exerciseId) || op.expectedState !== 'NO_ENTRY' || !validRates(op.rates) || !text(op.reason) || (Object.hasOwn(op, 'expectedRevision') && op.expectedRevision !== 0) || ids.has(op.exerciseId)) throw new Error('INVALID_OR_DISABLED_V2_OPERATION')
    ids.add(op.exerciseId)
  }
  return structuredClone(v) as TrainerProposalV2
}
export function previewInitialContributions(v: unknown, data: CanonicalAppData) {
  const proposal = validateTrainerProposalV2(v)
  const error = contributionError(data)
  if (error) throw new Error(error)
  if (validateCanonical(data).errors.length || proposal.baseRevision !== data.trainerDataRevision || data.appliedProposalIds!.includes(proposal.proposalId)) throw new Error('STALE_OR_INVALID_CANONICAL')
  return proposal.operations.map(op => {
    const exercise = data.exercises.find(e => e.id === op.exerciseId)
    if (!exercise || Object.hasOwn(data.contributions!.byExerciseId, op.exerciseId)) throw new Error('TARGET_NOT_NO_ENTRY')
    return { exerciseId: exercise.id, name: exercise.name, before: 'NO_ENTRY' as const, rates: op.rates, reason: op.reason }
  })
}

/** Read-only projection. Caller must independently establish provenance;
 * existence of the new fields is not a provenance attestation. */
export function createTrainerContextV2(data: CanonicalAppData, now: Date, provenanceEstablished: boolean) {
  if (!provenanceEstablished) throw new Error(initialContributionWriteUnavailable)
  const error = contributionError(data)
  if (error || validateCanonical(data).errors.length) throw new Error(error ?? 'INVALID_CANONICAL')
  if (data.sessions.some(s => !data.exercises.some(e => e.id === s.snapshot.exerciseId))) throw new Error('ORPHAN_SESSION_EXERCISE')
  // Keep v1 item shapes and history rules, while including archived masters/TIs.
  // Only this projection copy changes lifecycle to avoid v1's active filter.
  const projection = structuredClone(data)
  projection.exercises.forEach(x => { x.lifecycle = 'active' })
  projection.trainingItems.forEach(x => { x.lifecycle = 'active' })
  const context = createTrainerContextV11(projection, now)
  return { ...context, version: 2 as const, trainingContext: {
    ...context.trainingContext, contractVersion: 2 as const,
    trainerDataRevision: data.trainerDataRevision!,
    contributionStates: data.exercises.map(ex => {
      const entry = Object.hasOwn(data.contributions!.byExerciseId, ex.id) ? data.contributions!.byExerciseId[ex.id] : undefined
      return entry ? { exerciseId: ex.id, state: 'VALID_ENTRY' as const, rates: structuredClone(entry.rates) } : { exerciseId: ex.id, state: 'NO_ENTRY' as const }
    }),
  } }
}
