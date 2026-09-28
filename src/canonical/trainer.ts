import type { CanonicalStorage } from './cutover'
import type {
  CanonicalAppData, ID, Menu, MenuEntry, RecommendedDay, TrainingItem,
  ValidationIssue,
} from './types'
import { validateCanonical } from './validate'

export const MENU_PROPOSAL_CONTRACT_VERSION = '1.0'
export const TRAINER_HISTORY_CONTRACT_VERSION = '1.0'

export type MenuProposalEntry = {
  trainingItemId: ID
  recommendedDay?: RecommendedDay
  order: number
}

export type MenuProposal = {
  contractVersion: typeof MENU_PROPOSAL_CONTRACT_VERSION
  proposalId: string
  menu: { name: string; memo?: string }
  entries: MenuProposalEntry[]
}

export type ProposalCheck = {
  proposal?: MenuProposal
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}

export type TrainerHistoryRange =
  | { kind: 'range'; fromDate: string; toDate: string; inclusive: true }
  | { kind: 'full-history' }

export type TrainerHistory = {
  contractVersion: typeof TRAINER_HISTORY_CONTRACT_VERSION
  generatedAt: string
  range: TrainerHistoryRange
  profile: CanonicalAppData['profile']
  trainingItems: Array<{
    id: ID
    lifecycle: TrainingItem['lifecycle']
    exerciseId: ID
    displayName: string
    standard: {
      weight?: number
      reps?: number
      seconds?: number
      sets: number
      seat?: string
      standardMemo?: string
    }
  }>
  sessions: CanonicalAppData['sessions']
  trainingItemSettingChanges: CanonicalAppData['trainingItemSettingChanges']
}

export type TrainerHistoryResult =
  | { ok: true; value: TrainerHistory }
  | { ok: false; errors: ValidationIssue[] }

export type ProposalApplyResult =
  | { ok: true; value: CanonicalAppData; menu: Menu }
  | { ok: false; errors: ValidationIssue[] }

const issue = (path: string, message: string): ValidationIssue => ({ path, message })
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const isDay = (value: unknown): value is RecommendedDay =>
  Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 6
const isLocalDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const candidate = new Date(Date.UTC(year, month - 1, day))
  return candidate.getUTCFullYear() === year && candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day
}
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right)

/** Validates the transport-independent MenuProposal contract without mutating AppData. */
export function validateMenuProposal(input: unknown, data: CanonicalAppData): ProposalCheck {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []
  if (!isRecord(input)) return { errors: [issue('$', 'MenuProposalはオブジェクトである必要があります')], warnings }
  const allowed = new Set(['contractVersion', 'proposalId', 'menu', 'entries'])
  Object.keys(input).filter(key => !allowed.has(key)).forEach(key =>
    errors.push(issue(key, 'Ver1 MenuProposalでは未対応のフィールドです。Master更新や既存Menu更新は受け付けません')))
  if (input.contractVersion !== MENU_PROPOSAL_CONTRACT_VERSION) errors.push(issue('contractVersion', '対応していないMenuProposal contractVersionです'))
  if (!isText(input.proposalId)) errors.push(issue('proposalId', '空でない文字列が必要です'))
  if (isText(input.proposalId) && (data.appliedProposalIds ?? []).includes(input.proposalId)) errors.push(issue('proposalId', 'このproposalIdは既に適用済みです'))
  const menuInput = input.menu
  const menuName = isRecord(menuInput) && isText(menuInput.name) ? menuInput.name.trim() : undefined
  if (!isRecord(menuInput)) errors.push(issue('menu', 'オブジェクトが必要です'))
  else {
    if (!menuName) errors.push(issue('menu.name', '空でない文字列が必要です'))
    if (menuInput.memo !== undefined && typeof menuInput.memo !== 'string') errors.push(issue('menu.memo', '文字列ではありません'))
    if (menuName && data.menus.some(menu => menu.name === menuName)) warnings.push(issue('menu.name', '同名の既存Menuがあります'))
  }
  if (!Array.isArray(input.entries)) errors.push(issue('entries', '配列が必要です'))
  const validEntries: MenuProposalEntry[] = []
  if (Array.isArray(input.entries)) input.entries.forEach((entry, index) => {
    const path = `entries[${index}]`
    if (!isRecord(entry)) { errors.push(issue(path, 'オブジェクトが必要です')); return }
    const allowedEntry = new Set(['trainingItemId', 'recommendedDay', 'order'])
    Object.keys(entry).filter(key => !allowedEntry.has(key)).forEach(key => errors.push(issue(`${path}.${key}`, 'Ver1 MenuProposalでは未対応のフィールドです')))
    if (!isText(entry.trainingItemId)) errors.push(issue(`${path}.trainingItemId`, '空でない文字列が必要です'))
    if (!Number.isInteger(entry.order) || Number(entry.order) < 0) errors.push(issue(`${path}.order`, '0以上の整数が必要です'))
    if (entry.recommendedDay !== undefined && !isDay(entry.recommendedDay)) errors.push(issue(`${path}.recommendedDay`, '0..6の整数が必要です'))
    if (isText(entry.trainingItemId)) {
      const item = data.trainingItems.find(value => value.id === entry.trainingItemId)
      if (!item) errors.push(issue(`${path}.trainingItemId`, '参照先TrainingItemがありません'))
      else if (item.lifecycle !== 'active') errors.push(issue(`${path}.trainingItemId`, 'archived TrainingItemは参照できません'))
    }
    if (isText(entry.trainingItemId) && Number.isInteger(entry.order) && Number(entry.order) >= 0 && (entry.recommendedDay === undefined || isDay(entry.recommendedDay))) validEntries.push({ trainingItemId: entry.trainingItemId, order: Number(entry.order), ...(entry.recommendedDay === undefined ? {} : { recommendedDay: entry.recommendedDay }) })
  })
  const seenOrder = new Set<number>()
  validEntries.forEach((entry, index) => {
    if (seenOrder.has(entry.order)) errors.push(issue(`entries[${index}].order`, 'orderが重複しています'))
    seenOrder.add(entry.order)
  })
  const seenItems = new Set<string>()
  validEntries.forEach((entry, index) => {
    if (seenItems.has(entry.trainingItemId)) warnings.push(issue(`entries[${index}].trainingItemId`, '同じTrainingItemが複数Entryに含まれています'))
    seenItems.add(entry.trainingItemId)
    if (entry.recommendedDay === undefined) warnings.push(issue(`entries[${index}].recommendedDay`, '推奨曜日が未指定です'))
  })
  if (errors.length || !isText(input.proposalId) || !isRecord(menuInput) || !menuName || !Array.isArray(input.entries)) return { errors, warnings }
  return { proposal: { contractVersion: MENU_PROPOSAL_CONTRACT_VERSION, proposalId: input.proposalId.trim(), menu: { name: menuName, ...(typeof menuInput.memo === 'string' && menuInput.memo.trim() ? { memo: menuInput.memo } : {}) }, entries: validEntries }, errors, warnings }
}

/** Creates a candidate only. It does not persist or change the active Menu. */
export function createMenuProposalCandidate(data: CanonicalAppData, proposal: MenuProposal, newId: () => string): { data: CanonicalAppData; menu: Menu } {
  if ((data.appliedProposalIds ?? []).includes(proposal.proposalId)) throw new Error('proposalId is already applied')
  const menu: Menu = { id: newId(), lifecycle: 'active', name: proposal.menu.name, ...(proposal.menu.memo ? { memo: proposal.menu.memo } : {}) }
  const entries: MenuEntry[] = proposal.entries.map(entry => ({ id: newId(), lifecycle: 'active', menuId: menu.id, trainingItemId: entry.trainingItemId, order: entry.order, ...(entry.recommendedDay === undefined ? {} : { recommendedDay: entry.recommendedDay }) }))
  return { menu, data: { ...data, menus: [...data.menus, menu], menuEntries: [...data.menuEntries, ...entries], appliedProposalIds: [...(data.appliedProposalIds ?? []), proposal.proposalId] } }
}

/** Persists one all-or-nothing proposal candidate and verifies canonical read-back. */
export async function applyMenuProposal(storage: CanonicalStorage, data: CanonicalAppData, proposal: MenuProposal, newId: () => string): Promise<ProposalApplyResult> {
  let candidate: { data: CanonicalAppData; menu: Menu }
  try { candidate = createMenuProposalCandidate(data, proposal, newId) }
  catch (error) { return { ok: false, errors: [issue('proposalId', String(error))] } }
  const validation = validateCanonical(candidate.data)
  if (validation.errors.length) return { ok: false, errors: validation.errors }
  try {
    await storage.writeCanonical(candidate.data)
    const readBack = await storage.readCanonical()
    if (!readBack || !same(readBack, candidate.data) || validateCanonical(readBack).errors.length) throw new Error('保存後のread-back検証に失敗しました')
    return { ok: true, value: readBack, menu: candidate.menu }
  } catch (error) {
    try { await storage.writeCanonical(data) } catch { /* rollback failure is reported with the original persistence error */ }
    return { ok: false, errors: [issue('apply', `MenuProposalを適用できません: ${String(error)}`)] }
  }
}

/** Builds a read-only Trainer History projection. It never changes canonical data. */
export function createTrainerHistory(data: CanonicalAppData, options: { fullHistory: boolean; fromDate?: string; toDate?: string; generatedAt: string }): TrainerHistoryResult {
  if (!options.fullHistory) {
    if (!options.fromDate || !isLocalDate(options.fromDate)) return { ok: false, errors: [issue('fromDate', '有効な開始日が必要です')] }
    if (!options.toDate || !isLocalDate(options.toDate)) return { ok: false, errors: [issue('toDate', '有効な終了日が必要です')] }
    if (options.fromDate > options.toDate) return { ok: false, errors: [issue('range', '開始日は終了日以前にしてください')] }
  }
  const inRange = (date: string) => options.fullHistory || (date >= options.fromDate! && date <= options.toDate!)
  const sessions = data.sessions.filter(session => inRange(session.date)).map(session => structuredClone(session))
  const sessionItemIds = new Set(sessions.map(session => session.trainingItemId))
  const changesInRange = data.trainingItemSettingChanges.filter(change => options.fullHistory || inRange(change.changedAt.slice(0, 10)))
  const baseline = new Map<string, CanonicalAppData['trainingItemSettingChanges'][number]>()
  if (!options.fullHistory) data.trainingItemSettingChanges.filter(change => change.changedAt.slice(0, 10) < options.fromDate!).forEach(change => {
    const previous = baseline.get(change.trainingItemId)
    if (!previous || previous.changedAt < change.changedAt) baseline.set(change.trainingItemId, change)
  })
  const changes = [...changesInRange, ...[...baseline.values()].filter(change => !changesInRange.some(value => value.id === change.id))].map(change => structuredClone(change))
  const referencedItemIds = new Set([...sessionItemIds, ...changes.map(change => change.trainingItemId)])
  const trainingItems = data.trainingItems.filter(item => item.lifecycle === 'active' || referencedItemIds.has(item.id)).map(item => ({ id: item.id, lifecycle: item.lifecycle, exerciseId: item.exerciseId, displayName: item.displayName, standard: { weight: item.weight, reps: item.reps, seconds: item.seconds, sets: item.sets, seat: item.seat, standardMemo: item.standardMemo } }))
  return { ok: true, value: { contractVersion: TRAINER_HISTORY_CONTRACT_VERSION, generatedAt: options.generatedAt, range: options.fullHistory ? { kind: 'full-history' } : { kind: 'range', fromDate: options.fromDate!, toDate: options.toDate!, inclusive: true }, profile: structuredClone(data.profile), trainingItems, sessions, trainingItemSettingChanges: changes } }
}
