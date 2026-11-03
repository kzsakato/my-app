// Pre-implementation oracle: Issue #34 #6605006790 F01–F11,
// Contract 683d40a + supplement c1fec8d. Synthetic fixtures, not provenance proof.
import { describe, expect, it } from 'vitest'
import { canonicalFixture } from './fixtures'
import { contributionError, contributionKeys, rejectUnintegratedV13Write, validRates } from './contributions'
import { contributionAnalysis, displayPercentages } from './contributionAnalysis'
import { createTrainerContextV2, parseTrainerProposalV2, previewInitialContributions } from './trainerV13'
import { createCanonicalBackup, previewCanonicalRestore } from './backup'
import { referenceTrainingLoad } from './analysis'
import { createTrainerApplyCandidate, previewTrainerProposal, createTrainerContextV11 } from './trainerV11'
const rates = { chest: 50, back: 25, arms: 15, shoulders: 5, lowerBody: 5, core: 0 }
function data() { return { ...structuredClone(canonicalFixture), trainerDataRevision: 0, contributions: { version: 1 as const, byExerciseId: {} } } }
function proposal() { return { format: 'training-project.trainer-proposal', version: 2, proposalId: 'p-1', baseRevision: 0, operations: [{ type: 'setInitialContribution', exerciseId: 'exercise-1', expectedState: 'NO_ENTRY', rates, reason: '専門提案', expectedRevision: 0 }] } }
describe('F06 strict rates / F04 F07 disabled operations', () => {
  it('accepts the formal six-key example unchanged', () => expect(parseTrainerProposalV2(JSON.stringify(proposal())).operations[0].rates).toEqual(rates))
  const bad: unknown[] = [null, {}, { ...rates, other: 0 }, { ...rates, core: undefined }, { ...rates, chest: '50' }, { ...rates, chest: 50.5 }, { ...rates, chest: 51, back: 24 }, { ...rates, chest: -5, back: 80 }, { ...rates, chest: 105 }, { ...rates, chest: 45 }, Object.fromEntries(contributionKeys.map(k => [k, 0]))]
  it.each(bad)('rejects invalid rates %#', value => {
    expect(validRates(value)).toBe(false)
    const p = proposal(); p.operations[0].rates = value as typeof rates
    expect(() => parseTrainerProposalV2(JSON.stringify(p))).toThrow()
  })
  it('rejects raw and escaped duplicate keys before JSON.parse discards them', () => {
    const raw = JSON.stringify(proposal())
    expect(() => parseTrainerProposalV2(raw.replace('"chest":50', '"chest":50,"chest":50'))).toThrow()
    expect(() => parseTrainerProposalV2(raw.replace('"chest":50', '"chest":50,"\\u0063hest":50'))).toThrow()
  })
  it.each(['addExercise', 'changeMenuOrTI', 'correctContribution', 'unknown'])('rejects disabled operation %s including mixed proposals', type => {
    const p = proposal(); p.operations.push({ ...p.operations[0], type, exerciseId: 'second' })
    expect(() => parseTrainerProposalV2(JSON.stringify(p))).toThrow()
  })
  it.each(['baseRevision', 'version', 'proposalId', 'operations'])('requires root %s', key => {
    const p = proposal() as Record<string, unknown>; delete p[key]
    expect(() => parseTrainerProposalV2(JSON.stringify(p))).toThrow()
  })
  it('rejects unknown fields, string revision, unsafe revision, duplicate targets and old target union', () => {
    for (const p of [{ ...proposal(), extra: 1 }, { ...proposal(), baseRevision: '0' }, { ...proposal(), baseRevision: Number.MAX_SAFE_INTEGER + 1 }, { ...proposal(), operations: [proposal().operations[0], proposal().operations[0]] }, { ...proposal(), operations: [{ ...proposal().operations[0], target: { exerciseId: 'exercise-1' } }] }]) expect(() => parseTrainerProposalV2(JSON.stringify(p))).toThrow()
  })
})
describe('F01 F02 F03 F05 provenance, state, context and preview', () => {
  it('does not infer legacy origin or migrate from missing fields', () => {
    const before = structuredClone(canonicalFixture)
    expect(contributionError(before)).toBeDefined()
    expect(() => createTrainerContextV2(before, new Date(), false)).toThrow()
    expect(before).toEqual(canonicalFixture)
  })
  it('projects all archived Exercise/TI, NO_ENTRY and 100 local days without mutation', () => {
    const d = data(); d.exercises[0].lifecycle = 'archived'; d.trainingItems[0].lifecycle = 'archived'
    const before = structuredClone(d)
    const out = createTrainerContextV2(d, new Date('2026-09-24T12:00:00+09:00'), true)
    expect(out.fromDate).toBe('2026-06-17'); expect(out.toDate).toBe('2026-09-24')
    expect(out.trainingContext.exercises.map(x => x.id)).toEqual(['exercise-1'])
    expect(out.trainingContext.trainingItems.map(x => x.id)).toEqual(['item-1'])
    expect(out.trainingContext.contributionStates).toEqual([{ exerciseId: 'exercise-1', state: 'NO_ENTRY' }])
    expect(out.trainingContext.trainerDataRevision).toBe(0); expect(out.history).toHaveLength(1); expect(d).toEqual(before)
  })
  it('rejects invalid/orphan entries and unknown history without substituting NO_ENTRY', () => {
    for (const d of [ { ...data(), contributions: { version: 1, byExerciseId: { orphan: { rates, revision: 1 } } } }, { ...data(), appliedProposalIds: undefined } ]) expect(() => createTrainerContextV2(d as ReturnType<typeof data>, new Date(), true)).toThrow()
  })
  it('preview permits archived existing IDs but preserves generation revision and rejects stale, duplicate, VALID/deleted targets', () => {
    const d = data(); d.exercises[0].lifecycle = 'archived'
    const p = parseTrainerProposalV2(JSON.stringify(proposal()))
    expect(previewInitialContributions(p, d)[0].before).toBe('NO_ENTRY'); expect(p.baseRevision).toBe(0)
    expect(() => previewInitialContributions(p, { ...d, trainerDataRevision: 1 })).toThrow()
    expect(() => previewInitialContributions(p, { ...d, appliedProposalIds: ['p-1'] })).toThrow()
    expect(() => previewInitialContributions(p, { ...d, contributions: { version: 1, byExerciseId: { 'exercise-1': { rates, revision: 1 } } } })).toThrow()
    expect(() => previewInitialContributions(p, { ...d, exercises: [] })).toThrow()
  })
})
describe('F11 independent numerical oracle, PT separate', () => {
  it('AN-02/03/16/17: preserves QA snapshot PT oracles 1200/1080/960/2160', () => {
    const s = structuredClone(canonicalFixture.sessions[0])
    Object.assign(s, { weight: 10, bodyWeight: 60, reps: 8, sets: 3 })
    Object.assign(s.snapshot, { selfWeightRatio: 50, weightMode: 'perSide' })
    expect(referenceTrainingLoad(s)).toBe(1200)
    s.snapshot.weightMode = 'total'; expect(referenceTrainingLoad(s)).toBe(960)
    Object.assign(s.snapshot, { measureType: 'time', secondsLoadRatio: 20 })
    s.seconds = 30; expect(referenceTrainingLoad(s)).toBe(1080)
    s.seconds = 60; expect(referenceTrainingLoad(s)).toBe(2160)
  })
  it('AN-06: time duration never multiplies the set-equivalent amount', () => {
    const d = data(); d.contributions.byExerciseId = { 'exercise-1': { rates, revision: 1 } }
    d.exercises[0].measureType = 'time'; delete d.trainingItems[0].reps; d.trainingItems[0].seconds = 30
    delete d.trainingItemSettingChanges[0].snapshot.reps; d.trainingItemSettingChanges[0].snapshot.seconds = 30
    d.sessions[0].snapshot.measureType = 'time'; delete d.sessions[0].reps; d.sessions[0].seconds = 30
    const before = contributionAnalysis(d, d.sessions)
    d.sessions[0].seconds = 60
    expect(contributionAnalysis(d, d.sessions).totals).toEqual(before.totals)
  })
  it('allocates sets, not seconds or current bodyRegion; leaves all facts unchanged', () => {
    const d = data(); d.contributions.byExerciseId = { 'exercise-1': { rates, revision: 1 } }
    d.sessions[0].sets = 4
    const before = structuredClone(d), out = contributionAnalysis(d, d.sessions)
    expect(out.D).toBe(4); expect(out.U).toBe(0); expect(out.totals).toEqual({ chest: 2, back: 1, arms: 0.6, shoulders: 0.2, lowerBody: 0.2, core: 0 })
    expect(d).toEqual(before)
  })
  it('distinguishes NO_ENTRY U, normal ZERO and UNAVAILABLE', () => {
    const d = data()
    expect(contributionAnalysis(d, d.sessions)).toMatchObject({ state: 'READY', D: 0, U: 5 })
    expect(contributionAnalysis({ ...d, sessions: [] }, [])).toMatchObject({ state: 'ZERO', T: 0 })
    expect(contributionAnalysis(canonicalFixture, canonicalFixture.sessions).state).toBe('UNAVAILABLE')
    expect(displayPercentages({ chest: 0, back: 0, arms: 0, shoulders: 0, lowerBody: 0, core: 0 }, 0)).toEqual([])
  })
  it('displays D-only 100% with deterministic ties without changing raw amounts', () => {
    const amounts = { chest: 1, back: 1, arms: 1, shoulders: 0, lowerBody: 0, core: 0 }
    expect(displayPercentages(amounts, 3)).toEqual([34, 33, 33, 0, 0, 0]); expect(amounts.chest).toBe(1)
  })
})
describe('F09/F10 limited Backup boundary', () => {
  it('never emits new coefficients disguised as a v1 Backup or accepts them through old Restore', () => {
    expect(() => createCanonicalBackup(data(), '2026-11-03T00:00:00Z')).toThrow()
    for (const version of [1, 2]) expect(previewCanonicalRestore(JSON.stringify({ format: 'training-check-backup', schemaVersion: version, createdAt: '2026-11-03T00:00:00Z', payload: data() })).envelope).toBeUndefined()
  })
  it('recognizes V13 fields for the fail-closed writer guard', () => {
    expect(() => rejectUnintegratedV13Write(data())).toThrow()
    expect(() => rejectUnintegratedV13Write({ contributions: null })).toThrow()
    expect(() => rejectUnintegratedV13Write(canonicalFixture)).not.toThrow()
  })
})
describe('F07 existing Trainer v1 regression', () => {
  it('keeps strict v1 proposal, string baseRevision, normal candidate and v1 Context behavior', () => {
    const d = structuredClone(canonicalFixture)
    const v1 = { format: 'training-project.trainer-proposal', version: 1, proposalId: 'v1-p', baseRevision: 'owner-reference', masterSuggestions: { exercises: [{ candidateId: 'new-e', name: '新種目', bodyRegion: '胸', measureType: 'reps', usesWeight: true, weightMode: 'total', selfWeightRatio: 0, secondsLoadRatio: 0 }], trainingItems: [] }, trainingItemChanges: [], menuProposals: [], washRequests: [] }
    expect(previewTrainerProposal(v1, d).baseRevision).toBe('owner-reference')
    const out = createTrainerApplyCandidate(v1, d, () => 'new-stable-id', '2026-11-03T00:00:00Z')
    expect(out.data.appliedProposalIds).toContain('v1-p'); expect(out.data.exercises.at(-1)?.id).toBe('new-stable-id')
    expect(out.data.sessions).toEqual(d.sessions); expect(out.data.contributions).toBeUndefined()
    expect(() => previewTrainerProposal({ ...v1, rates }, d)).toThrow()
    expect(() => previewTrainerProposal({ ...v1, baseRevision: 0 }, d)).toThrow()
    expect(createTrainerContextV11(d, new Date('2026-09-24T12:00:00+09:00')).version).toBe(1)
  })
})
