/**
 * Stage 0 canonical domain contract.
 *
 * These types deliberately have no dependency on the current React, IndexedDB,
 * or legacy v5/v6 runtime types.  They are not wired into the application yet.
 */
export type ID = string
export type Lifecycle = 'active' | 'archived'
export type MeasureType = 'reps' | 'time'
export type WeightMode = 'total' | 'perSide'
export type RecommendedDay = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type Profile = {
  weight: number
  height?: number
  age?: number
  sex?: string
}

export type ClassificationMeaning = {
  kind: 'bodyRegion'
  label: string
}

export type Exercise = {
  id: ID
  lifecycle: Lifecycle
  name: string
  measureType: MeasureType
  usesWeight: boolean
  weightMode?: WeightMode
  selfWeightRatio?: number
  secondsLoadRatio?: number
  classifications?: ClassificationMeaning[]
}

export type TrainingItem = {
  id: ID
  lifecycle: Lifecycle
  exerciseId: ID
  displayName: string
  weight?: number
  reps?: number
  seconds?: number
  sets: number
  seat?: string
  standardMemo?: string
}

export type Menu = {
  id: ID
  lifecycle: Lifecycle
  name: string
  memo?: string
}

export type MenuEntry = {
  id: ID
  lifecycle: Lifecycle
  menuId: ID
  trainingItemId: ID
  recommendedDay?: RecommendedDay
  order: number
}

export type SessionSnapshot = {
  exerciseId: ID
  exerciseName: string
  trainingItemDisplayName: string
  measureType: MeasureType
  weightMode?: WeightMode
  selfWeightRatio?: number
  secondsLoadRatio?: number
  classifications?: ClassificationMeaning[]
}

export type Session = {
  id: ID
  trainingItemId: ID
  menuEntryId?: ID
  date: string
  weight?: number
  reps?: number
  seconds?: number
  sets: number
  bodyWeight?: number
  seat?: string
  memo?: string
  snapshot: SessionSnapshot
}

export type TrainingItemSettingSnapshot = {
  weight?: number
  reps?: number
  seconds?: number
  sets: number
  seat?: string
  standardMemo?: string
}

export type TrainingItemSettingChange = {
  id: ID
  trainingItemId: ID
  changedAt: string
  /** 作成時に生成される履歴起点。表示順ではなく意味で削除不可を識別する。 */
  isInitial: boolean
  /** 当該設定変更だけの任意の理由。現行設定やSessionへは継承しない。 */
  changeReason?: string
  snapshot: TrainingItemSettingSnapshot
}

export type CanonicalAppData = {
  schemaVersion: 1
  /** 0=月曜 … 6=日曜。週境界と集計表示の規則。 */
  weekStartsOn: RecommendedDay
  activeMenuId?: ID
  profile: Profile
  exercises: Exercise[]
  trainingItems: TrainingItem[]
  menus: Menu[]
  menuEntries: MenuEntry[]
  sessions: Session[]
  trainingItemSettingChanges: TrainingItemSettingChange[]
  /** Ver1 MenuProposalで正常に適用済みとなった外部proposalId。 */
  appliedProposalIds?: ID[]
}

export type BackupEnvelope = {
  format: 'training-check-backup'
  schemaVersion: 1
  createdAt: string
  payload: CanonicalAppData
}

export type ValidationIssue = { path: string; message: string }
export type ValidationResult = { errors: ValidationIssue[]; warnings: ValidationIssue[] }
