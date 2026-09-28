import { describe, expect, it } from 'vitest'
import { canonicalFixture } from './fixtures'
import { applyMenuProposal, createTrainerHistory, validateMenuProposal } from './trainer'
import type { CanonicalAppData } from './types'

const clone = <T>(value: T): T => structuredClone(value)
const proposal = {
  contractVersion: '1.0', proposalId: 'proposal-1',
  menu: { name: '提案メニュー', memo: '確認用' },
  entries: [{ trainingItemId: 'item-1', recommendedDay: 1, order: 0 }],
} as const

describe('Ver1 MenuProposal contract', () => {
  it('accepts an active TrainingItem proposal and applies app-issued IDs without changing activeMenuId', async () => {
    const data = clone(canonicalFixture)
    const checked = validateMenuProposal(proposal, data)
    expect(checked.errors).toEqual([])
    expect(checked.proposal).toBeDefined()
    let stored = data
    let sequence = 0
    const result = await applyMenuProposal({
      readCutoverState: async () => ({ authoritative: true as const, establishedAt: 'x' }), writeCutoverState: async () => undefined,
      readBaseline: async () => undefined, writeBaseline: async () => undefined,
      readCanonical: async () => stored, writeCanonical: async value => { stored = structuredClone(value) },
    }, data, checked.proposal!, () => `app-${++sequence}`)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.activeMenuId).toBe('menu-1')
    expect(result.value.menus.at(-1)?.id).toBe('app-1')
    expect(result.value.menuEntries.at(-1)?.id).toBe('app-2')
    expect(result.value.appliedProposalIds).toEqual(['proposal-1'])
    expect(validateMenuProposal({ ...proposal, menu: { name: '変更後' } }, result.value).errors.map(value => value.path)).toContain('proposalId')
  })

  it('rejects archived or missing references, duplicate order, unsupported versions, and unsupported master fields', () => {
    const archived = clone(canonicalFixture); archived.trainingItems[0].lifecycle = 'archived'
    expect(validateMenuProposal(proposal, archived).errors.map(value => value.path)).toContain('entries[0].trainingItemId')
    expect(validateMenuProposal({ ...proposal, contractVersion: '2.0' }, canonicalFixture).errors.map(value => value.path)).toContain('contractVersion')
    expect(validateMenuProposal({ ...proposal, entries: [...proposal.entries, { trainingItemId: 'missing', order: 0 }] }, canonicalFixture).errors.map(value => value.path)).toContain('entries[1].trainingItemId')
    expect(validateMenuProposal({ ...proposal, exercises: [] }, canonicalFixture).errors.map(value => value.path)).toContain('exercises')
  })

  it('emits non-blocking warnings for legal duplicated items, no recommendation, and same Menu names', () => {
    const checked = validateMenuProposal({ ...proposal, menu: { name: '通常メニュー' }, entries: [{ trainingItemId: 'item-1', order: 0 }, { trainingItemId: 'item-1', order: 1 }] }, canonicalFixture)
    expect(checked.errors).toEqual([])
    expect(checked.warnings.length).toBeGreaterThanOrEqual(3)
  })

  it('rolls back candidate data when read-back verification fails', async () => {
    const data = clone(canonicalFixture)
    const checked = validateMenuProposal(proposal, data)
    let writes: CanonicalAppData[] = []
    const result = await applyMenuProposal({
      readCutoverState: async () => ({ authoritative: true as const, establishedAt: 'x' }), writeCutoverState: async () => undefined,
      readBaseline: async () => undefined, writeBaseline: async () => undefined,
      readCanonical: async () => data, writeCanonical: async value => { writes.push(structuredClone(value)) },
    }, data, checked.proposal!, () => 'new-id')
    expect(result.ok).toBe(false)
    expect(writes).toHaveLength(2)
    expect(writes[1]).toEqual(data)
  })
})

describe('Ver1 Trainer History projection', () => {
  it('uses an inclusive explicit range and adds one prior baseline setting change', () => {
    const data = clone(canonicalFixture)
    data.trainingItemSettingChanges[0].changedAt = '2026-09-19T09:00:00+09:00'
    data.trainingItemSettingChanges.push({ id: 'change-before', trainingItemId: 'item-1', changedAt: '2026-09-20T09:00:00+09:00', isInitial: false, snapshot: { weight: 17, reps: 15, sets: 5 } })
    data.trainingItemSettingChanges.push({ id: 'change-in', trainingItemId: 'item-1', changedAt: '2026-09-24T10:00:00+09:00', isInitial: false, snapshot: { weight: 19, reps: 15, sets: 5 }, changeReason: '調整' })
    data.sessions.push({ ...data.sessions[0], id: 'session-out', date: '2026-09-25' })
    const result = createTrainerHistory(data, { fullHistory: false, fromDate: '2026-09-24', toDate: '2026-09-24', generatedAt: '2026-09-28T00:00:00+09:00' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.sessions.map(value => value.id)).toEqual(['session-1'])
    expect(result.value.trainingItemSettingChanges.map(value => value.id).sort()).toEqual(['change-before', 'change-in'])
    expect(result.value.range).toEqual({ kind: 'range', fromDate: '2026-09-24', toDate: '2026-09-24', inclusive: true })
  })

  it('supports full history, retains archived contextual items, and rejects invalid ranges', () => {
    const data = clone(canonicalFixture)
    data.trainingItems[0].lifecycle = 'archived'
    const full = createTrainerHistory(data, { fullHistory: true, generatedAt: '2026-09-28T00:00:00+09:00' })
    expect(full.ok).toBe(true)
    if (full.ok) expect(full.value.trainingItems[0].lifecycle).toBe('archived')
    expect(createTrainerHistory(data, { fullHistory: false, fromDate: '2026-09-25', toDate: '2026-09-24', generatedAt: '2026-09-28T00:00:00+09:00' }).ok).toBe(false)
  })
})
