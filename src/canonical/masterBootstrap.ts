import type { CanonicalStorage } from './cutover'
import { addTrainingItem } from './operations'
import type { CanonicalAppData, Exercise, ID, TrainingItem, ValidationIssue } from './types'
import { validateCanonical } from './validate'

export type ManMasterBootstrapEntry = {
  sourceExerciseId: string
  sourceTrainingItemId: string
  exercise: Omit<Exercise, 'id' | 'lifecycle'>
  trainingItem: Omit<TrainingItem, 'id' | 'lifecycle' | 'exerciseId'>
}

export type ManMasterBootstrapMapping = {
  sourceExerciseId: string
  sourceTrainingItemId: string
  exerciseId: ID
  trainingItemId: ID
}

export type ManMasterBootstrapResult =
  | { ok: true; value: CanonicalAppData; mappings: ManMasterBootstrapMapping[] }
  | { ok: false; errors: ValidationIssue[] }

const issue = (path: string, message: string): ValidationIssue => ({ path, message })
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right)

/**
 * DATA_SPEC §10.16's explicitly approved Android MAN package.
 * It is an approved canonical input definition, not a legacy-data parser.
 */
export const MAN_MASTER_BOOTSTRAP_PACKAGE: readonly ManMasterBootstrapEntry[] = [
  {
    sourceExerciseId: 'seed-fly',
    sourceTrainingItemId: 'seed-item-7',
    exercise: {
      name: 'ペクトラルフライ（マシン）', measureType: 'reps', usesWeight: true, weightMode: 'total',
      selfWeightRatio: 0, secondsLoadRatio: 0, classifications: [{ kind: 'bodyRegion', label: '胸' }],
    },
    trainingItem: { displayName: 'ペクトラルフライ（マシン）', weight: 22.5, reps: 15, sets: 4, seat: '2' },
  },
  {
    sourceExerciseId: 'seed-side',
    sourceTrainingItemId: 'seed-item-10',
    exercise: {
      name: 'サイドレイズ', measureType: 'reps', usesWeight: true, weightMode: 'perSide',
      selfWeightRatio: 0, secondsLoadRatio: 0, classifications: [{ kind: 'bodyRegion', label: '肩' }],
    },
    trainingItem: { displayName: 'サイドレイズ', weight: 4, reps: 12, sets: 3 },
  },
  {
    sourceExerciseId: 'seed-raise',
    sourceTrainingItemId: 'seed-item-12',
    exercise: {
      name: 'レッグレイズ', measureType: 'reps', usesWeight: false,
      selfWeightRatio: 30, secondsLoadRatio: 0, classifications: [{ kind: 'bodyRegion', label: '体幹' }],
    },
    trainingItem: { displayName: 'レッグレイズ', reps: 10, sets: 4 },
  },
  {
    sourceExerciseId: 'seed-front',
    sourceTrainingItemId: 'seed-item-14',
    exercise: {
      name: 'フロントプランク', measureType: 'time', usesWeight: false,
      selfWeightRatio: 0, secondsLoadRatio: 0, classifications: [{ kind: 'bodyRegion', label: '体幹' }],
    },
    trainingItem: { displayName: 'フロントプランク', seconds: 30, sets: 3 },
  },
]

function selectedPackage(includeFrontPlank: boolean) {
  return MAN_MASTER_BOOTSTRAP_PACKAGE.filter((entry) => includeFrontPlank || entry.sourceExerciseId !== 'seed-front')
}

function collisionErrors(data: CanonicalAppData, entries: readonly ManMasterBootstrapEntry[]): ValidationIssue[] {
  const targetExerciseNames = new Set(entries.map((entry) => entry.exercise.name))
  const targetItemNames = new Set(entries.map((entry) => entry.trainingItem.displayName))
  const errors: ValidationIssue[] = []
  data.exercises.filter((exercise) => targetExerciseNames.has(exercise.name)).forEach((exercise) =>
    errors.push(issue('bootstrap', `既存Exercise「${exercise.name}」(${exercise.id})と衝突するため投入できません`)))
  data.trainingItems.filter((item) => targetItemNames.has(item.displayName)).forEach((item) =>
    errors.push(issue('bootstrap', `既存TrainingItem「${item.displayName}」(${item.id})と衝突するため投入できません`)))
  return errors
}

/** Builds a validated all-or-nothing candidate. It never reads or converts legacy payload data. */
export function createManMasterBootstrapCandidate(
  data: CanonicalAppData,
  options: { includeFrontPlank: boolean; newId: () => string; now: () => string },
): { value: CanonicalAppData; mappings: ManMasterBootstrapMapping[] } {
  const entries = selectedPackage(options.includeFrontPlank)
  const collisions = collisionErrors(data, entries)
  if (collisions.length) throw new Error(collisions.map((entry) => entry.message).join(' / '))
  const usedIds = new Set<string>([
    ...data.exercises.map((value) => value.id), ...data.trainingItems.map((value) => value.id),
    ...data.menus.map((value) => value.id), ...data.menuEntries.map((value) => value.id),
    ...data.sessions.map((value) => value.id), ...data.trainingItemSettingChanges.map((value) => value.id),
  ])
  const freshId = () => {
    const id = options.newId()
    if (!id || usedIds.has(id)) throw new Error('App-issued IDが重複しています')
    usedIds.add(id)
    return id
  }
  let value = structuredClone(data)
  const mappings: ManMasterBootstrapMapping[] = []
  entries.forEach((entry) => {
    const exercise: Exercise = { id: freshId(), lifecycle: 'active', ...structuredClone(entry.exercise) }
    // `weightMode` is absent by definition for `usesWeight=false` canonical Exercise records.
    if (!exercise.usesWeight) delete exercise.weightMode
    const trainingItem: TrainingItem = { id: freshId(), lifecycle: 'active', exerciseId: exercise.id, ...structuredClone(entry.trainingItem) }
    value = { ...value, exercises: [...value.exercises, exercise] }
    value = addTrainingItem(value, trainingItem, { newId: freshId, now: options.now })
    mappings.push({
      sourceExerciseId: entry.sourceExerciseId,
      sourceTrainingItemId: entry.sourceTrainingItemId,
      exerciseId: exercise.id,
      trainingItemId: trainingItem.id,
    })
  })
  return { value, mappings }
}

/** Persists the full bootstrap candidate only after validation, then verifies read-back. */
export async function applyManMasterBootstrap(
  storage: CanonicalStorage,
  data: CanonicalAppData,
  options: { includeFrontPlank: boolean; newId: () => string; now: () => string },
): Promise<ManMasterBootstrapResult> {
  let candidate: { value: CanonicalAppData; mappings: ManMasterBootstrapMapping[] }
  try {
    candidate = createManMasterBootstrapCandidate(data, options)
  } catch (error) {
    return { ok: false, errors: [issue('bootstrap', String(error))] }
  }
  const validation = validateCanonical(candidate.value)
  if (validation.errors.length) return { ok: false, errors: validation.errors }
  try {
    await storage.writeCanonical(candidate.value)
    const readBack = await storage.readCanonical()
    if (!readBack || !same(readBack, candidate.value) || validateCanonical(readBack).errors.length) {
      throw new Error('保存後のread-back検証に失敗しました')
    }
    return { ok: true, value: readBack, mappings: candidate.mappings }
  } catch (error) {
    try { await storage.writeCanonical(data) } catch { /* Report the original persistence error. */ }
    return { ok: false, errors: [issue('bootstrap', `MAN用マスターを投入できません: ${String(error)}`)] }
  }
}
