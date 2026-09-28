import type { ManMasterBootstrapMapping } from './masterBootstrap'
import { MENU_PROPOSAL_CONTRACT_VERSION, validateMenuProposal, type MenuProposal } from './trainer'
import type { CanonicalAppData, ValidationIssue } from './types'

export type AndroidManMenuProposalResult =
  | { ok: true; proposal: MenuProposal; warnings: ValidationIssue[] }
  | { ok: false; errors: ValidationIssue[] }

type RequiredMapping = {
  sourceExerciseId: string
  sourceTrainingItemId: string
}

const requiredMappings: readonly RequiredMapping[] = [
  { sourceExerciseId: 'seed-fly', sourceTrainingItemId: 'seed-item-7' },
  { sourceExerciseId: 'seed-side', sourceTrainingItemId: 'seed-item-10' },
  { sourceExerciseId: 'seed-raise', sourceTrainingItemId: 'seed-item-12' },
]
const frontPlankMapping: RequiredMapping = { sourceExerciseId: 'seed-front', sourceTrainingItemId: 'seed-item-14' }
const issue = (path: string, message: string): ValidationIssue => ({ path, message })

/**
 * Produces the transport-independent H-07 MenuProposal from H-17's structured
 * bootstrap result. Legacy source IDs are used only to select the fresh canonical
 * TrainingItem IDs and are never emitted in the proposal.
 */
export function createAndroidManMenuProposal(
  data: CanonicalAppData,
  mappings: readonly ManMasterBootstrapMapping[],
  options: { includeTime: boolean; newId: () => string },
): AndroidManMenuProposalResult {
  const expected = [...requiredMappings, ...(options.includeTime ? [frontPlankMapping] : [])]
  const errors: ValidationIssue[] = []
  const selected: ManMasterBootstrapMapping[] = []

  expected.forEach((requirement, order) => {
    const matches = mappings.filter((mapping) =>
      mapping.sourceExerciseId === requirement.sourceExerciseId
      && mapping.sourceTrainingItemId === requirement.sourceTrainingItemId)
    if (matches.length !== 1) {
      errors.push(issue(`mappings[${order}]`, `MAN用の対応付けが見つからないか重複しています: ${requirement.sourceTrainingItemId}`))
      return
    }
    const item = data.trainingItems.find((value) => value.id === matches[0].trainingItemId)
    if (!item) errors.push(issue(`mappings[${order}].trainingItemId`, '対応先TrainingItemが正規データにありません'))
    else if (item.lifecycle !== 'active') errors.push(issue(`mappings[${order}].trainingItemId`, 'archived TrainingItemはMAN用メニューにできません'))
    else selected.push(matches[0])
  })
  if (errors.length) return { ok: false, errors }

  const proposal: MenuProposal = {
    contractVersion: MENU_PROPOSAL_CONTRACT_VERSION,
    proposalId: options.newId(),
    menu: { name: 'Android MAN確認メニュー' },
    entries: selected.map((mapping, order) => ({ trainingItemId: mapping.trainingItemId, order })),
  }
  const checked = validateMenuProposal(proposal, data)
  if (checked.errors.length || !checked.proposal) return { ok: false, errors: checked.errors }
  return { ok: true, proposal: checked.proposal, warnings: checked.warnings }
}
