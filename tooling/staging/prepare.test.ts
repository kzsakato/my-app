import { describe, it, expect, vi } from 'vitest'
vi.mock('idb', () => ({ openDB: () => Promise.resolve({}) }))
import { base } from '../../src/data'
import { prepare, expected, type Receipt, type Dependencies } from './prepare'
import type { CanonicalStorage, CutoverState, LegacyBaseline } from '../../src/canonical/cutover'
import type { CanonicalAppData } from '../../src/canonical/types'
import { loadCanonicalStartup } from '../../src/canonical/cutover'
import { applyManMasterBootstrap } from '../../src/canonical/masterBootstrap'
import { applyMenuProposal } from '../../src/canonical/trainer'

class Memory implements CanonicalStorage {
  state: CutoverState = { authoritative: false }; baseline?: LegacyBaseline; data?: CanonicalAppData
  writes = 0; canonicalWrites = 0; failStage = 0; failMode = ''; damaged = false
  async readCutoverState() { return structuredClone(this.state) }
  async writeCutoverState(v: CutoverState) { this.writes++; this.state = structuredClone(v) }
  async readBaseline() { return structuredClone(this.baseline) }
  async writeBaseline(v: LegacyBaseline) { this.writes++; this.baseline = structuredClone(v) }
  async readCanonical() {
    if (!this.damaged && this.canonicalWrites === this.failStage && this.failStage > 0 && this.failMode !== 'write') {
      this.damaged = true
      if (this.failMode === 'read') throw Error('injected read failure')
      return { ...structuredClone(this.data!), profile: { weight: 99 } }
    }
    return structuredClone(this.data)
  }
  async writeCanonical(v: CanonicalAppData) {
    this.writes++; this.canonicalWrites++
    if (this.canonicalWrites === this.failStage && this.failMode === 'write') throw Error('injected persist failure')
    this.data = structuredClone(v)
  }
}
function setup() {
  const storage = new Memory(); let receipt: Receipt | null = null; let count = 0
  const deps: Dependencies = {
    storage, base, recovery: async () => undefined,
    load: async () => { const s = await loadCanonicalStartup(storage); return s.kind === 'legacy-active' ? { kind: 'ready', data: structuredClone(base) } : s },
    journal: { read: () => structuredClone(receipt), write: r => { receipt = structuredClone(r) } },
    authorize: async () => ({ run: 'test-run' }), now: () => '2026-10-04T10:00:00.000Z', newId: () => `canonical-${++count}`,
  }
  return { storage, deps }
}
describe('bounded staging fixture', () => {
  it('uses genuine default baseline, exact approved fixture, separate activation and zero-write duplicate', async () => {
    const { storage, deps } = setup()
    expect((await prepare(deps)).status).toBe('PREPARED')
    const receipt = deps.journal.read()!
    expect(storage.baseline?.rawJson).toBe(JSON.stringify(base))
    const data = storage.data!
    expect(data.profile).toEqual({ weight: 66 }); expect(data.weekStartsOn).toBe(0)
    expect(data.exercises.map(e => e.name)).toEqual(['ペクトラルフライ（マシン）', 'サイドレイズ', 'レッグレイズ'])
    expect(data.trainingItems.map(i => [i.weight, i.reps, i.sets, i.seat])).toEqual([[22.5,15,4,'2'],[4,12,3,undefined],[undefined,10,4,undefined]])
    expect(data.exercises[2].selfWeightRatio).toBe(30)
    expect(data.sessions).toEqual([]); expect(data.trainingItemSettingChanges).toHaveLength(3)
    expect(data.trainingItemSettingChanges.every(c=>c.isInitial)).toBe(true)
    expect(data.menuEntries.map(e => e.trainingItemId)).toEqual(data.trainingItems.map(i=>i.id))
    expect(data.menuEntries.map(e => e.order)).toEqual([0,1,2]); expect(data.activeMenuId).toBe(data.menus[0].id)
    expect((data as unknown as Record<string, unknown>).categories).toBeUndefined()
    expect(data).toEqual(expected(receipt).final)
    const writes = storage.writes
    expect(await prepare(deps)).toMatchObject({ status: 'PREPARED', trace: ['validation/read-back/restart','duplicate-zero-write'] })
    expect(storage.writes).toBe(writes)
  })
  for (const stage of [1,2,3,4]) for (const mode of ['write','read','mismatch']) it(`STOP at stage ${stage} ${mode}, no later stage or retry repair`, async () => {
    const { storage, deps } = setup(); storage.failStage=stage; storage.failMode=mode
    const result=await prepare(deps); expect(result.status).toBe('STOP')
    expect(result.trace).not.toContain(['cutover','bootstrap','menu-not-implicitly-active','explicit-menu-activation'][stage-1])
    const writes=storage.writes; storage.failStage=0
    expect((await prepare(deps)).status).toBe('STOP'); expect(storage.writes).toBe(writes)
  })
  it('rejects dirty legacy, unexpected canonical, protected baseline and recovery before writes', async () => {
    for (const kind of ['legacy','canonical','baseline','recovery']) {
      const { storage, deps }=setup()
      if(kind==='legacy')deps.load=async()=>({kind:'ready',data:{...base, sessions:[{}]}})
      if(kind==='canonical')storage.data=expected({run:'x',phase:'started',at:deps.now(),ids:Array.from({length:14},deps.newId),baseline:base}).initial
      if(kind==='baseline')storage.baseline={sourceKind:'legacy-v6-payload',rawJson:'{}',capturedAt:deps.now()}
      if(kind==='recovery')deps.recovery=async()=>({id:'old'})
      expect((await prepare(deps)).status).toBe('STOP');expect(storage.writes).toBe(0)
    }
  })
  it('interrupt after final persist but before receipt completion remains STOP on reopen', async()=>{
    const {storage,deps}=setup();const write=deps.journal.write
    deps.journal.write=r=>{if(r.phase==='complete')throw Error('tab interrupted');write(r)}
    expect((await prepare(deps)).status).toBe('STOP');const writes=storage.writes
    deps.journal.write=write;expect((await prepare(deps)).status).toBe('STOP');expect(storage.writes).toBe(writes)
  })
  it('rejects modified completed data without writes', async()=>{
    const {storage,deps}=setup();await prepare(deps);storage.data!.profile.weight=77
    const writes=storage.writes;expect((await prepare(deps)).status).toBe('STOP');expect(storage.writes).toBe(writes)
  })
  it('closed capability fails before mutations; a completed receipt cannot bypass gate',async()=>{
    const {storage,deps}=setup();await prepare(deps);const writes=storage.writes
    deps.authorize=async()=>{throw Error('revoked')};expect((await prepare(deps)).status).toBe('STOP');expect(storage.writes).toBe(writes)
  })
  it('canonical operation collisions and duplicate proposal reject without writes',async()=>{
    const {storage,deps}=setup();await prepare(deps);const writes=storage.writes
    expect((await applyManMasterBootstrap(storage,storage.data!,{includeFrontPlank:false,newId:deps.newId,now:deps.now})).ok).toBe(false)
    expect((await applyMenuProposal(storage,storage.data!,expected(deps.journal.read()!).proposal,deps.newId)).ok).toBe(false)
    expect(storage.writes).toBe(writes)
  })
})
