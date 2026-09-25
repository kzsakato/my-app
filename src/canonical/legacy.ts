import { identifyInput, type InputKind } from './identify'
import type { Profile } from './types'

export type LegacyInputKind = 'legacy-v5-payload' | 'legacy-v6-payload' | 'legacy-v5-backup-envelope' | 'legacy-v6-backup-envelope'
export type LegacyReferenceCounts = {
  exercises: number
  categories: number
  items: number
  menus: number
  menuItems: number
  sessions: number
  settingHistories: number
}
export type LegacyRecreationPreview = {
  inputKind: InputKind
  isLegacy: boolean
  profileCandidate?: Profile
  referenceCounts?: LegacyReferenceCounts
  excludedFromCanonical: { sessions: number; settingHistories: number }
  messages: string[]
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const finitePositive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0
const positiveInteger = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1
const count = (value: unknown) => Array.isArray(value) ? value.length : 0
const isLegacyKind = (value: InputKind): value is LegacyInputKind => value === 'legacy-v5-payload' || value === 'legacy-v6-payload' || value === 'legacy-v5-backup-envelope' || value === 'legacy-v6-backup-envelope'

function legacyPayload(input: unknown, kind: LegacyInputKind): Record<string, unknown> | undefined {
  if (!isRecord(input)) return undefined
  return kind.endsWith('-backup-envelope') && isRecord(input.payload) ? input.payload : input
}

/**
 * Creates read-only material for later human/Data Integration recreation.
 * It intentionally never maps legacy master, menu, session, or history IDs into
 * canonical entities.
 */
export function createLegacyRecreationPreview(input: unknown): LegacyRecreationPreview {
  const inputKind = identifyInput(input)
  if (!isLegacyKind(inputKind)) {
    return {
      inputKind, isLegacy: false, excludedFromCanonical: { sessions: 0, settingHistories: 0 },
      messages: ['legacy v5/v6入力ではないため、再作成候補は生成しません。'],
    }
  }
  const payload = legacyPayload(input, inputKind)
  if (!payload) {
    return { inputKind, isLegacy: true, excludedFromCanonical: { sessions: 0, settingHistories: 0 }, messages: ['legacy payloadを読み取れません。'] }
  }
  const profile = isRecord(payload.profile) ? payload.profile : undefined
  const profileCandidate = profile && finitePositive(profile.weight)
    ? {
        weight: profile.weight,
        ...(finitePositive(profile.height) ? { height: profile.height } : {}),
        ...(positiveInteger(profile.age) ? { age: profile.age } : {}),
        ...(typeof profile.sex === 'string' ? { sex: profile.sex } : {}),
      }
    : undefined
  const referenceCounts: LegacyReferenceCounts = {
    exercises: count(payload.exercises), categories: count(payload.categories), items: count(payload.items),
    menus: count(payload.menus), menuItems: count(payload.menuItems), sessions: count(payload.sessions), settingHistories: count(payload.settingHistories),
  }
  const messages = [
    profileCandidate ? 'Profileの同義fieldだけを候補として表示します。' : '有効なlegacy Profile.weightがないため、Profile候補は生成しません。',
    'Exercise・Item・Menu・MenuItemは自動でcanonical化せず、後続の再作成用参照材料として扱います。',
    'Session・SettingHistoryはcanonical移行候補に含めません。',
  ]
  return { inputKind, isLegacy: true, profileCandidate, referenceCounts, excludedFromCanonical: { sessions: referenceCounts.sessions, settingHistories: referenceCounts.settingHistories }, messages }
}
