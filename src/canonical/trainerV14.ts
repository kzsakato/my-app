import { parseUniqueJson } from './trainerV11'
import { createTrainerContextV2 } from './trainerV13'
import { contributionError, exactKeys, record, safeRevision, validRates, type RatesPercent } from './contributions'
import { validateCanonical } from './validate'
import type { CanonicalAppData } from './types'
import type { InitialContribution } from './trainerV13'
export type Correction = { type: 'correctContribution'; exerciseId: string; rates: RatesPercent; reason: string }
export type TrainerProposalV3 = { format: 'training-project.trainer-proposal'; version: 3; proposalId: string; baseRevision?: number; operations: (Correction | InitialContribution)[] }
export function parseTrainerProposalV3(raw: string): TrainerProposalV3 {
  const v = parseUniqueJson(raw)
  if (!record(v) || !exactKeys(v, ['format','version','proposalId','operations'], ['baseRevision']) || v.format !== 'training-project.trainer-proposal' || v.version !== 3 || typeof v.proposalId !== 'string' || !v.proposalId.trim() || (Object.hasOwn(v,'baseRevision') && !safeRevision(v.baseRevision)) || !Array.isArray(v.operations) || !v.operations.length) throw new Error('INVALID_V3_ROOT')
  for (const op of v.operations) {
    if (!record(op) || typeof op.exerciseId !== 'string' || !op.exerciseId || typeof op.reason !== 'string' || !op.reason.trim() || !validRates(op.rates)) throw new Error('INVALID_V3_OPERATION')
    if (op.type === 'correctContribution') {
      if (!exactKeys(op,['type','exerciseId','rates','reason'])) throw new Error('INVALID_V3_CORRECTION')
    } else if (op.type === 'setInitialContribution') {
      if (!exactKeys(op,['type','exerciseId','expectedState','rates','reason'],['expectedRevision']) || op.expectedState !== 'NO_ENTRY' || (Object.hasOwn(op,'expectedRevision') && op.expectedRevision !== 0)) throw new Error('INVALID_V3_INITIAL')
    } else throw new Error('UNSUPPORTED_V3_OPERATION')
  }
  return v as TrainerProposalV3
}
/** Ordered in-memory evaluation, followed by exactly one revision per changed target. */
export function prepareContributionV3(raw: string, data: CanonicalAppData) {
  const proposal = parseTrainerProposalV3(raw)
  if (contributionError(data) || validateCanonical(data).errors.length) throw new Error('INVALID_V3_CANONICAL')
  const candidate = structuredClone(data), entries = candidate.contributions!.byExerciseId
  const targets = new Set<string>()
  for (const op of proposal.operations) {
    if (!data.exercises.some(ex => ex.id === op.exerciseId)) throw new Error('ORPHAN_V3_TARGET')
    const exists = Object.hasOwn(entries,op.exerciseId)
    if ((op.type === 'correctContribution' && !exists) || (op.type === 'setInitialContribution' && exists)) throw new Error('INVALID_V3_TARGET_STATE')
    Object.defineProperty(entries,op.exerciseId,{ value: {rates:structuredClone(op.rates),revision:0},enumerable:true,writable:true,configurable:true })
    targets.add(op.exerciseId)
  }
  let changedCount = 0
  for (const id of targets) {
    const old = Object.hasOwn(data.contributions!.byExerciseId,id) ? data.contributions!.byExerciseId[id] : undefined
    const changed = !old || Object.keys(old.rates).some(key => old.rates[key as keyof RatesPercent] !== entries[id].rates[key as keyof RatesPercent])
    if (changed) {
      if (old?.revision === Number.MAX_SAFE_INTEGER) throw new Error('TARGET_REVISION_EXHAUSTED')
      entries[id].revision = old ? old.revision+1 : 1
      changedCount++
    } else entries[id] = structuredClone(old!)
  }
  if (changedCount) {
    if (data.trainerDataRevision === Number.MAX_SAFE_INTEGER) throw new Error('GLOBAL_REVISION_EXHAUSTED')
    candidate.trainerDataRevision = data.trainerDataRevision!+1
    if (!candidate.appliedProposalIds!.includes(proposal.proposalId)) candidate.appliedProposalIds!.push(proposal.proposalId)
  }
  if (contributionError(candidate) || validateCanonical(candidate).errors.length) throw new Error('INVALID_V3_CANDIDATE')
  return { candidate, changedCount, proposal }
}
export function createTrainerContextV3(data: CanonicalAppData, now: Date, provenanceEstablished: boolean) {
  const v2 = createTrainerContextV2(data,now,provenanceEstablished)
  return {...v2,version:3 as const,trainingContext:{...v2.trainingContext,contractVersion:3 as const,contributionStates:v2.trainingContext.contributionStates.map(entry => entry.state === 'VALID_ENTRY' ? {...entry,revision:data.contributions!.byExerciseId[entry.exerciseId].revision} : entry)}}
}
