import { cutoverCanonical, loadCanonicalStartup, type CanonicalStorage } from '../../src/canonical/cutover'
import { createInitialCanonicalCandidate } from '../../src/canonical/runtime'
import { applyManMasterBootstrap, createManMasterBootstrapCandidate } from '../../src/canonical/masterBootstrap'
import { createAndroidManMenuProposal } from '../../src/canonical/manMenuProposal'
import { applyMenuProposal, createMenuProposalCandidate } from '../../src/canonical/trainer'
import { validateCanonical } from '../../src/canonical/validate'
import type { AppData } from '../../src/domain'
import { validateCanonical as validateLegacyV6 } from '../../src/domain'

export const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
export type PreparationPurpose = 'fresh' | 'h14-recovery'
export type Receipt = { run: string; purpose?: PreparationPurpose; phase: 'started' | 'complete'; at: string; ids: string[]; baseline: AppData }
export type Dependencies = {
  storage: CanonicalStorage; base: AppData;
  load: () => Promise<{ kind: string; data?: unknown }>;
  recovery: () => Promise<unknown>;
  journal: { read(): Receipt | null; write(r: Receipt): void };
  authorize: () => Promise<{ run: string; purpose?: PreparationPurpose }>;
  legacySource?: () => Promise<unknown>;
  newId: () => string; now: () => string;
}
export function expected(r: Receipt) {
  if (r.ids.length !== 14 || new Set(r.ids).size !== 14 || r.ids.some(id => !id)) throw Error('IDs')
  let index = 0
  const newId = () => { const id = r.ids[index++]; if (!id) throw Error('ID exhausted'); return id }
  // Both purposes use the approved fixture Profile; no legacy Profile adoption.
  const initial = createInitialCanonicalCandidate({ weight: 66 })
  const bootstrap = createManMasterBootstrapCandidate(initial, { includeFrontPlank: false, newId, now: () => r.at })
  const proposal = createAndroidManMenuProposal(bootstrap.value, bootstrap.mappings, { includeTime: false, newId })
  if (!proposal.ok) throw Error('Proposal')
  const applied = createMenuProposalCandidate(bootstrap.value, proposal.proposal, newId)
  const final = { ...applied.data, activeMenuId: applied.menu.id }
  if (validateCanonical(final).errors.length || final.weekStartsOn !== 0 || final.sessions.length) throw Error('Fixture')
  return { initial, bootstrap, proposal: proposal.proposal, applied, final }
}
/** No direct IndexedDB writes: all product persistence uses the accepted adapter/operations. */
export async function prepare(d: Dependencies): Promise<{ status: 'PREPARED' | 'STOP'; trace: string[] }> {
  const trace: string[] = []
  try {
    const gate = await d.authorize()
    const purpose = gate.purpose ?? 'fresh'
    if (purpose !== 'fresh' && purpose !== 'h14-recovery') throw Error('Unknown purpose')
    const checkGate = async () => {
      const current = await d.authorize()
      if (current.run !== gate.run || (current.purpose ?? 'fresh') !== purpose) throw Error('Run changed')
    }
    const old = d.journal.read()
    const verify = async (r: Receipt) => {
      const plan = expected(r)
      const state = await loadCanonicalStartup(d.storage)
      const baseline = await d.storage.readBaseline()
      const authority = await d.storage.readCutoverState()
      if (state.kind !== 'canonical-ready' || !equal(state.data, plan.final)
        || !authority.authoritative || authority.establishedAt !== r.at
        || baseline?.rawJson !== JSON.stringify(r.baseline)
        || baseline.capturedAt !== r.at || baseline.sourceKind !== 'legacy-v6-payload'
        || (await d.load()).kind !== 'canonical-ready') throw Error('Read-back')
      const restarted = await loadCanonicalStartup(d.storage)
      if (restarted.kind !== 'canonical-ready' || !equal(restarted.data, plan.final)) throw Error('Restart')
      if (purpose === 'h14-recovery' && (!d.legacySource || !equal(await d.legacySource(), r.baseline))) throw Error('Legacy changed')
      await checkGate()
      trace.push('validation/read-back/restart')
    }
    if (old) {
      if (old.run !== gate.run || (old.purpose ?? 'fresh') !== purpose || old.phase !== 'complete') throw Error('Interrupted/other run')
      await verify(old)
      trace.push('duplicate-zero-write')
      return { status: 'PREPARED', trace }
    }
    // Call the accepted ordinary startup, not an invented legacy payload.
    const loaded = await d.load()
    if (loaded.kind !== 'ready' || (await d.storage.readCutoverState()).authoritative !== false
      || (await d.storage.readCanonical()) !== undefined || (await d.storage.readBaseline()) !== undefined
      || (await d.recovery()) !== undefined) throw Error('Unexpected start state')
    if (purpose === 'fresh') {
      if (!equal(loaded.data, d.base)) throw Error('Not pristine')
      trace.push('genuine-initial-startup')
    } else {
      // The real persisted v6 must exist; loadData's default-base fallback alone
      // is not proof of the diagnosed H14 starting state.
      if (!d.legacySource || !equal(await d.legacySource(), loaded.data) || validateLegacyV6(loaded.data).errors.length) throw Error('Legacy baseline invalid')
      trace.push('h14-valid-existing-legacy-v6/no-import')
    }
    await checkGate()
    const receipt: Receipt = { run: gate.run, purpose, phase: 'started', at: d.now(), ids: Array.from({ length: 14 }, d.newId), baseline: structuredClone(loaded.data as AppData) }
    const plan = expected(receipt)
    d.journal.write(receipt) // Interruption at any later point is STOP, never guessed repair.
    const cutover = await cutoverCanonical(d.storage, receipt.baseline, plan.initial, receipt.at)
    if (!cutover.ok) throw Error('Cutover')
    trace.push('cutover')
    let index = 0
    const newId = () => receipt.ids[index++]
    const bootstrap = await applyManMasterBootstrap(d.storage, cutover.value, { includeFrontPlank: false, newId, now: () => receipt.at })
    if (!bootstrap.ok || !equal(bootstrap.value, plan.bootstrap.value)) throw Error('Bootstrap')
    trace.push('bootstrap')
    const proposal = createAndroidManMenuProposal(bootstrap.value, bootstrap.mappings, { includeTime: false, newId })
    if (!proposal.ok || !equal(proposal.proposal, plan.proposal)) throw Error('Proposal')
    const applied = await applyMenuProposal(d.storage, bootstrap.value, proposal.proposal, newId)
    if (!applied.ok || !equal(applied.value, plan.applied.data) || applied.value.activeMenuId !== undefined) throw Error('Menu')
    trace.push('menu-not-implicitly-active')
    // Same explicit selector semantic as CanonicalApp.commit: validate -> write -> read-back.
    await d.storage.writeCanonical(plan.final)
    if (!equal(await d.storage.readCanonical(), plan.final)) throw Error('Activation read-back')
    trace.push('explicit-menu-activation')
    await verify(receipt)
    d.journal.write({ ...receipt, phase: 'complete' })
    return { status: 'PREPARED', trace }
  } catch { return { status: 'STOP', trace } }
}
