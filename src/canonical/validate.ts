import type {
  CanonicalAppData, ClassificationMeaning, Exercise, SessionSnapshot,
  TrainingItem, TrainingItemSettingSnapshot, ValidationIssue, ValidationResult,
} from './types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const isId = (value: unknown): value is string => typeof value === 'string' && value.length > 0
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isNonNegative = (value: unknown): value is number => isNumber(value) && value >= 0
const isPositiveInteger = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0
const isLifecycle = (value: unknown): value is 'active' | 'archived' => value === 'active' || value === 'archived'
const isMeasureType = (value: unknown): value is 'reps' | 'time' => value === 'reps' || value === 'time'
const isOffsetInstant = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && !Number.isNaN(Date.parse(value))
const isLocalDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

const add = (issues: ValidationIssue[], path: string, message: string) => issues.push({ path, message })

function validateClassifications(value: unknown, path: string, errors: ValidationIssue[]) {
  if (value === undefined) return
  if (!Array.isArray(value)) { add(errors, path, '配列ではありません'); return }
  const seen = new Set<string>()
  value.forEach((classification, index) => {
    const itemPath = `${path}[${index}]`
    if (!isRecord(classification) || classification.kind !== 'bodyRegion' || !isText(classification.label)) {
      add(errors, itemPath, 'bodyRegion classification が不正です')
      return
    }
    const key = `${classification.kind}:${classification.label.trim()}`
    if (seen.has(key)) add(errors, itemPath, '同一classificationが重複しています')
    seen.add(key)
  })
}

function validateMeasurement(value: Record<string, unknown>, measureType: 'reps' | 'time', path: string, errors: ValidationIssue[]) {
  if (!isPositiveInteger(value.sets)) add(errors, `${path}.sets`, '正の整数ではありません')
  if (value.weight !== undefined && !isNonNegative(value.weight)) add(errors, `${path}.weight`, '0以上の有限数ではありません')
  if (measureType === 'reps') {
    if (!isPositiveInteger(value.reps)) add(errors, `${path}.reps`, '回数型では正の整数が必要です')
    if (value.seconds !== undefined) add(errors, `${path}.seconds`, '回数型では保持できません')
  } else {
    if (!isPositiveInteger(value.seconds)) add(errors, `${path}.seconds`, '時間型では正の整数が必要です')
    if (value.reps !== undefined) add(errors, `${path}.reps`, '時間型では保持できません')
  }
}

function validateSettingSnapshot(value: unknown, exercise: Exercise | undefined, path: string, errors: ValidationIssue[]) {
  if (!isRecord(value)) { add(errors, path, 'snapshotがオブジェクトではありません'); return }
  if (!exercise) { add(errors, path, '参照Exerciseを解決できません'); return }
  validateMeasurement(value, exercise.measureType, path, errors)
  if (value.seat !== undefined && typeof value.seat !== 'string') add(errors, `${path}.seat`, '文字列ではありません')
  if (value.standardMemo !== undefined && typeof value.standardMemo !== 'string') add(errors, `${path}.standardMemo`, '文字列ではありません')
}

function validateSnapshot(value: unknown, path: string, errors: ValidationIssue[]): value is SessionSnapshot {
  if (!isRecord(value)) { add(errors, path, 'snapshotがオブジェクトではありません'); return false }
  if (!isId(value.exerciseId)) add(errors, `${path}.exerciseId`, 'IDが不正です')
  if (!isText(value.exerciseName)) add(errors, `${path}.exerciseName`, '名前が不正です')
  if (!isText(value.trainingItemDisplayName)) add(errors, `${path}.trainingItemDisplayName`, '表示名が不正です')
  if (!isMeasureType(value.measureType)) add(errors, `${path}.measureType`, '種別が不正です')
  if (value.weightMode !== undefined && value.weightMode !== 'total' && value.weightMode !== 'perSide') add(errors, `${path}.weightMode`, '重量方式が不正です')
  if (value.selfWeightRatio !== undefined && !isNonNegative(value.selfWeightRatio)) add(errors, `${path}.selfWeightRatio`, '0以上の有限数ではありません')
  if (value.secondsLoadRatio !== undefined && !isNonNegative(value.secondsLoadRatio)) add(errors, `${path}.secondsLoadRatio`, '0以上の有限数ではありません')
  validateClassifications(value.classifications, `${path}.classifications`, errors)
  return isMeasureType(value.measureType)
}

function duplicateIds(rows: unknown[], path: string, errors: ValidationIssue[]) {
  const seen = new Set<string>()
  rows.forEach((row, index) => {
    const itemPath = `${path}[${index}].id`
    if (!isRecord(row) || !isId(row.id)) { add(errors, itemPath, '空でないID文字列が必要です'); return }
    if (seen.has(row.id)) add(errors, itemPath, 'IDが重複しています')
    seen.add(row.id)
  })
}

function arrayAt(input: Record<string, unknown>, key: string, errors: ValidationIssue[]): unknown[] {
  if (!Array.isArray(input[key])) { add(errors, key, '配列ではありません'); return [] }
  return input[key] as unknown[]
}

/** Validates only contract-level errors. Product thresholds intentionally remain policy. */
export function validateCanonical(input: unknown): ValidationResult {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []
  if (!isRecord(input)) { add(errors, '$', 'オブジェクトではありません'); return { errors, warnings } }
  if (input.schemaVersion !== 1) add(errors, 'schemaVersion', '対応していないschemaVersionです')

  const exercises = arrayAt(input, 'exercises', errors)
  const trainingItems = arrayAt(input, 'trainingItems', errors)
  const menus = arrayAt(input, 'menus', errors)
  const menuEntries = arrayAt(input, 'menuEntries', errors)
  const sessions = arrayAt(input, 'sessions', errors)
  const changes = arrayAt(input, 'trainingItemSettingChanges', errors)
  ;[ [exercises, 'exercises'], [trainingItems, 'trainingItems'], [menus, 'menus'], [menuEntries, 'menuEntries'], [sessions, 'sessions'], [changes, 'trainingItemSettingChanges'] ].forEach(([rows, path]) => duplicateIds(rows as unknown[], path as string, errors))

  if (!isRecord(input.profile) || !isNumber(input.profile.weight) || input.profile.weight <= 0) add(errors, 'profile.weight', '有限の正数が必要です')
  else {
    if (input.profile.height !== undefined && (!isNumber(input.profile.height) || input.profile.height <= 0)) add(errors, 'profile.height', '有限の正数ではありません')
    if (input.profile.age !== undefined && !isPositiveInteger(input.profile.age)) add(errors, 'profile.age', '1以上の整数ではありません')
    if (input.profile.sex !== undefined && typeof input.profile.sex !== 'string') add(errors, 'profile.sex', '文字列ではありません')
  }

  const exerciseMap = new Map<string, Exercise>()
  exercises.forEach((row, index) => {
    const path = `exercises[${index}]`
    if (!isRecord(row)) { add(errors, path, 'オブジェクトではありません'); return }
    if (!isId(row.id) || !isLifecycle(row.lifecycle) || !isText(row.name) || !isMeasureType(row.measureType) || typeof row.usesWeight !== 'boolean') add(errors, path, '必須フィールドが不正です')
    if (row.usesWeight === true && row.weightMode !== 'total' && row.weightMode !== 'perSide') add(errors, `${path}.weightMode`, 'usesWeight=trueでは重量方式が必要です')
    if (row.usesWeight === false && row.weightMode !== undefined) add(errors, `${path}.weightMode`, 'usesWeight=falseでは保持できません')
    if (row.selfWeightRatio !== undefined && !isNonNegative(row.selfWeightRatio)) add(errors, `${path}.selfWeightRatio`, '0以上の有限数ではありません')
    if (row.secondsLoadRatio !== undefined && !isNonNegative(row.secondsLoadRatio)) add(errors, `${path}.secondsLoadRatio`, '0以上の有限数ではありません')
    validateClassifications(row.classifications, `${path}.classifications`, errors)
    if (isId(row.id) && isLifecycle(row.lifecycle) && isText(row.name) && isMeasureType(row.measureType) && typeof row.usesWeight === 'boolean') exerciseMap.set(row.id, row as Exercise)
  })

  const itemMap = new Map<string, TrainingItem>()
  trainingItems.forEach((row, index) => {
    const path = `trainingItems[${index}]`
    if (!isRecord(row) || !isId(row.id) || !isLifecycle(row.lifecycle) || !isId(row.exerciseId) || !isText(row.displayName)) { add(errors, path, '必須フィールドが不正です'); return }
    const exercise = exerciseMap.get(row.exerciseId)
    if (!exercise) add(errors, `${path}.exerciseId`, '参照先Exerciseがありません')
    else validateMeasurement(row, exercise.measureType, path, errors)
    if (row.seat !== undefined && typeof row.seat !== 'string') add(errors, `${path}.seat`, '文字列ではありません')
    if (row.standardMemo !== undefined && typeof row.standardMemo !== 'string') add(errors, `${path}.standardMemo`, '文字列ではありません')
    itemMap.set(row.id, row as TrainingItem)
  })

  const menuMap = new Map<string, Record<string, unknown>>()
  menus.forEach((row, index) => {
    const path = `menus[${index}]`
    if (!isRecord(row) || !isId(row.id) || !isLifecycle(row.lifecycle) || !isText(row.name)) { add(errors, path, '必須フィールドが不正です'); return }
    if (row.memo !== undefined && typeof row.memo !== 'string') add(errors, `${path}.memo`, '文字列ではありません')
    menuMap.set(row.id, row)
  })
  if (input.activeMenuId !== undefined && (!isId(input.activeMenuId) || menuMap.get(input.activeMenuId)?.lifecycle !== 'active')) add(errors, 'activeMenuId', 'activeなMenuを参照する必要があります')

  const entryMap = new Map<string, Record<string, unknown>>()
  const activeOrders = new Map<string, Set<number>>()
  menuEntries.forEach((row, index) => {
    const path = `menuEntries[${index}]`
    if (!isRecord(row) || !isId(row.id) || !isLifecycle(row.lifecycle) || !isId(row.menuId) || !isId(row.trainingItemId) || !Number.isInteger(row.order) || Number(row.order) < 0) { add(errors, path, '必須フィールドが不正です'); return }
    if (!menuMap.has(row.menuId)) add(errors, `${path}.menuId`, '参照先Menuがありません')
    if (!itemMap.has(row.trainingItemId)) add(errors, `${path}.trainingItemId`, '参照先TrainingItemがありません')
    if (row.recommendedDay !== undefined && (!Number.isInteger(row.recommendedDay) || Number(row.recommendedDay) < 0 || Number(row.recommendedDay) > 6)) add(errors, `${path}.recommendedDay`, '0..6の整数ではありません')
    if (row.lifecycle === 'active') {
      const orders = activeOrders.get(row.menuId) ?? new Set<number>()
      if (orders.has(Number(row.order))) add(errors, `${path}.order`, '同一Menu内のactive Entryで重複しています')
      orders.add(Number(row.order)); activeOrders.set(row.menuId, orders)
    }
    entryMap.set(row.id, row)
  })

  sessions.forEach((row, index) => {
    const path = `sessions[${index}]`
    if (!isRecord(row) || !isId(row.id) || !isId(row.trainingItemId) || !itemMap.has(row.trainingItemId) || !isLocalDate(row.date)) { add(errors, path, '必須フィールドまたは参照が不正です'); return }
    if (row.menuEntryId !== undefined && (!isId(row.menuEntryId) || !entryMap.has(row.menuEntryId))) add(errors, `${path}.menuEntryId`, '参照先MenuEntryがありません')
    const snapshot = row.snapshot
    if (validateSnapshot(snapshot, `${path}.snapshot`, errors)) validateMeasurement(row, snapshot.measureType, path, errors)
    if (row.bodyWeight !== undefined && !isNonNegative(row.bodyWeight)) add(errors, `${path}.bodyWeight`, '0以上の有限数ではありません')
    if (row.seat !== undefined && typeof row.seat !== 'string') add(errors, `${path}.seat`, '文字列ではありません')
    if (row.memo !== undefined && typeof row.memo !== 'string') add(errors, `${path}.memo`, '文字列ではありません')
  })

  const changeCountByItem = new Map<string, number>()
  changes.forEach((row, index) => {
    const path = `trainingItemSettingChanges[${index}]`
    if (!isRecord(row) || !isId(row.id) || !isId(row.trainingItemId) || !isOffsetInstant(row.changedAt)) { add(errors, path, '必須フィールドが不正です'); return }
    const item = itemMap.get(row.trainingItemId)
    if (!item) add(errors, `${path}.trainingItemId`, '参照先TrainingItemがありません')
    else validateSettingSnapshot(row.snapshot, exerciseMap.get(item.exerciseId), `${path}.snapshot`, errors)
    changeCountByItem.set(row.trainingItemId, (changeCountByItem.get(row.trainingItemId) ?? 0) + 1)
  })
  itemMap.forEach((_, id) => { if (!changeCountByItem.has(id)) add(errors, 'trainingItemSettingChanges', `TrainingItem ${id} の初回設定履歴がありません`) })

  return { errors, warnings }
}

export function validateBackupEnvelope(input: unknown): ValidationResult {
  const errors: ValidationIssue[] = []
  if (!isRecord(input) || input.format !== 'training-check-backup') add(errors, 'format', '未対応のバックアップ形式です')
  if (!isRecord(input) || input.schemaVersion !== 1) add(errors, 'schemaVersion', '対応していないschemaVersionです')
  if (!isRecord(input) || !isOffsetInstant(input.createdAt)) add(errors, 'createdAt', 'offset付きRFC3339 instantが必要です')
  const payloadResult = isRecord(input) ? validateCanonical(input.payload) : { errors: [], warnings: [] }
  return { errors: [...errors, ...payloadResult.errors], warnings: payloadResult.warnings }
}
