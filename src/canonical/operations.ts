import type {
  CanonicalAppData, Exercise, MenuEntry, Session, SessionSnapshot, TrainingItem,
  TrainingItemSettingChange, TrainingItemSettingSnapshot,
} from './types'

export type OperationContext = { newId: () => string; now: () => string }

export function toSettingSnapshot(item: TrainingItem): TrainingItemSettingSnapshot {
  return {
    weight: item.weight,
    reps: item.reps,
    seconds: item.seconds,
    sets: item.sets,
    seat: item.seat,
    standardMemo: item.standardMemo,
  }
}

const sameSnapshot = (left: TrainingItemSettingSnapshot, right: TrainingItemSettingSnapshot) =>
  left.weight === right.weight && left.reps === right.reps && left.seconds === right.seconds &&
  left.sets === right.sets && left.seat === right.seat && left.standardMemo === right.standardMemo

function createChange(item: TrainingItem, context: OperationContext): TrainingItemSettingChange {
  return { id: context.newId(), trainingItemId: item.id, changedAt: context.now(), snapshot: toSettingSnapshot(item) }
}

/** New items always receive their initial, full standard-setting snapshot. */
export function addTrainingItem(data: CanonicalAppData, item: TrainingItem, context: OperationContext): CanonicalAppData {
  return { ...data, trainingItems: [...data.trainingItems, item], trainingItemSettingChanges: [...data.trainingItemSettingChanges, createChange(item, context)] }
}

/** A record is appended only when the tracked standard-setting snapshot changes. */
export function updateTrainingItem(data: CanonicalAppData, item: TrainingItem, context: OperationContext): CanonicalAppData {
  const previous = data.trainingItems.find(candidate => candidate.id === item.id)
  if (!previous) throw new Error(`TrainingItem not found: ${item.id}`)
  const changed = !sameSnapshot(toSettingSnapshot(previous), toSettingSnapshot(item))
  return {
    ...data,
    trainingItems: data.trainingItems.map(candidate => candidate.id === item.id ? item : candidate),
    trainingItemSettingChanges: changed ? [...data.trainingItemSettingChanges, createChange(item, context)] : data.trainingItemSettingChanges,
  }
}

export function createSessionSnapshot(item: TrainingItem, exercise: Exercise): SessionSnapshot {
  return {
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    trainingItemDisplayName: item.displayName,
    measureType: exercise.measureType,
    weightMode: exercise.usesWeight ? exercise.weightMode : undefined,
    selfWeightRatio: exercise.selfWeightRatio,
    secondsLoadRatio: exercise.secondsLoadRatio,
    classifications: exercise.classifications?.map(value => ({ ...value })),
  }
}

export function appendMenuEntry(data: CanonicalAppData, entry: Omit<MenuEntry, 'id' | 'order'> & { id?: string }, context: OperationContext): CanonicalAppData {
  const orders = data.menuEntries.filter(value => value.menuId === entry.menuId && value.lifecycle === 'active').map(value => value.order)
  const complete: MenuEntry = { ...entry, id: entry.id ?? context.newId(), order: orders.length ? Math.max(...orders) + 1 : 0 }
  return { ...data, menuEntries: [...data.menuEntries, complete] }
}

/** Only active entries are renumbered. Archived entries retain their prior order. */
export function reorderActiveMenuEntries(data: CanonicalAppData, menuId: string, orderedActiveIds: string[]): CanonicalAppData {
  const expected = data.menuEntries.filter(value => value.menuId === menuId && value.lifecycle === 'active').map(value => value.id)
  if (expected.length !== orderedActiveIds.length || expected.some(id => !orderedActiveIds.includes(id))) throw new Error('Active MenuEntry IDs must match exactly')
  const order = new Map(orderedActiveIds.map((id, index) => [id, index]))
  return { ...data, menuEntries: data.menuEntries.map(value => value.menuId === menuId && value.lifecycle === 'active' ? { ...value, order: order.get(value.id)! } : value) }
}

export function archiveMenuEntry(data: CanonicalAppData, menuEntryId: string): CanonicalAppData {
  return { ...data, menuEntries: data.menuEntries.map(value => value.id === menuEntryId ? { ...value, lifecycle: 'archived' } : value) }
}

export function appendSession(data: CanonicalAppData, session: Session): CanonicalAppData {
  return { ...data, sessions: [...data.sessions, session] }
}
