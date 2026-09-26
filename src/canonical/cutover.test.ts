import { describe, expect, it } from 'vitest'
import { canonicalBackupFixture, canonicalFixture } from './fixtures'
import { cutoverCanonical, loadCanonicalStartup, prepareCanonicalBackupRestore, recoverCanonical, type CanonicalStorage, type CutoverState, type LegacyBaseline } from './cutover'
import type { CanonicalAppData } from './types'

class MemoryStorage implements CanonicalStorage {
  state: CutoverState = { authoritative: false }; baseline?: LegacyBaseline; canonical?: CanonicalAppData
  fail = new Set<string>(); mismatch = false; canonicalReads = 0
  async readCutoverState(){ if(this.fail.has('state.read')) throw new Error('state read failure'); return this.state }
  async writeCutoverState(value:CutoverState){ if(this.fail.has('state.write')) throw new Error('state write failure'); this.state=value }
  async readBaseline(){ if(this.fail.has('baseline.read')) throw new Error('baseline read failure'); return this.baseline }
  async writeBaseline(value:LegacyBaseline){ if(this.fail.has('baseline.write')) throw new Error('baseline write failure'); this.baseline=value }
  async readCanonical(){ this.canonicalReads++; if(this.fail.has('canonical.read') || this.fail.has(`canonical.read.${this.canonicalReads}`)) throw new Error('canonical read failure'); return this.mismatch ? {...this.canonical!, profile:{...this.canonical!.profile,weight:99}} : this.canonical }
  async writeCanonical(value:CanonicalAppData){ if(this.fail.has('canonical.write')) throw new Error('canonical write failure'); this.canonical=structuredClone(value) }
}
const now='2026-09-26T09:00:00+09:00'
const validLegacyV6={version:6 as const,activeMenuId:'legacy-menu',profile:{weight:66,analysisStartDate:'2026-09-01'},exercises:[],categories:[],items:[],menus:[{id:'legacy-menu',name:'Legacy'}],menuItems:[],sessions:[],settingHistories:[]}

describe('Stage 2 cutover safety',()=>{
 it('persists immutable baseline, verifies canonical, adopts it, and supports restart load',async()=>{const s=new MemoryStorage();const result=await cutoverCanonical(s,validLegacyV6,canonicalFixture,now);expect(result.ok).toBe(true);expect(s.baseline?.rawJson).toBe(JSON.stringify(validLegacyV6));expect((await loadCanonicalStartup(s)).kind).toBe('canonical-ready')})
 it('does not replace an existing baseline',async()=>{const s=new MemoryStorage();await cutoverCanonical(s,validLegacyV6,canonicalFixture,now);const first=s.baseline!.rawJson;await cutoverCanonical(s,{...validLegacyV6,profile:{changed:true}},canonicalFixture,now);expect(s.baseline!.rawJson).toBe(first)})
 it('rejects candidate validation before writing baseline',async()=>{const s=new MemoryStorage();const bad={...canonicalFixture,profile:{weight:0}} as CanonicalAppData;expect((await cutoverCanonical(s,validLegacyV6,bad,now)).ok).toBe(false);expect(s.baseline).toBeUndefined()})
 it('rejects structurally identifiable but invalid legacy data before baseline persistence',async()=>{const s=new MemoryStorage();const result=await cutoverCanonical(s,{version:6},canonicalFixture,now);expect(result.ok).toBe(false);expect(s.baseline).toBeUndefined();if(!result.ok)expect(result.diagnostics.some(x=>x.stage.startsWith('baseline.validate.'))).toBe(true)})
 it('keeps legacy active when baseline or canonical persist fails',async()=>{const baseline=new MemoryStorage();baseline.fail.add('baseline.write');expect((await cutoverCanonical(baseline,validLegacyV6,canonicalFixture,now)).ok).toBe(false);expect(baseline.state.authoritative).toBe(false);const persist=new MemoryStorage();persist.fail.add('canonical.write');expect((await cutoverCanonical(persist,validLegacyV6,canonicalFixture,now)).ok).toBe(false);expect(persist.state.authoritative).toBe(false)})
 it('rolls back on persist read-back mismatch, runtime load failure, and restart-equivalent load failure',async()=>{const mismatch=new MemoryStorage();mismatch.mismatch=true;expect((await cutoverCanonical(mismatch,validLegacyV6,canonicalFixture,now)).ok).toBe(false);expect(mismatch.state.authoritative).toBe(false);const runtime=new MemoryStorage();runtime.fail.add('canonical.read.2');expect((await cutoverCanonical(runtime,validLegacyV6,canonicalFixture,now)).ok).toBe(false);expect(runtime.state.authoritative).toBe(false);const restart=new MemoryStorage();restart.fail.add('canonical.read.3');expect((await cutoverCanonical(restart,validLegacyV6,canonicalFixture,now)).ok).toBe(false);expect(restart.state.authoritative).toBe(false)})
 it('reports rollback write failure instead of hiding it',async()=>{const s=new MemoryStorage();s.mismatch=true;s.fail.add('state.write');const result=await cutoverCanonical(s,validLegacyV6,canonicalFixture,now);expect(result.ok).toBe(false);if(!result.ok)expect(result.diagnostics.some(x=>x.stage==='rollback.write')).toBe(true)})
 it('never silently falls back to legacy after authoritative startup failure',async()=>{const s=new MemoryStorage();s.state={authoritative:true,establishedAt:now};s.fail.add('canonical.read');expect((await loadCanonicalStartup(s)).kind).toBe('canonical-recovery-required')})
 it('reports recovery write and read-back failures',async()=>{const write=new MemoryStorage();write.fail.add('canonical.write');expect((await recoverCanonical(write,canonicalBackupFixture)).ok).toBe(false);const read=new MemoryStorage();read.mismatch=true;expect((await recoverCanonical(read,canonicalBackupFixture)).ok).toBe(false)})
 it('parses only a valid canonical backup envelope for restoration',()=>{expect(prepareCanonicalBackupRestore(JSON.stringify(canonicalBackupFixture)).ok).toBe(true);expect(prepareCanonicalBackupRestore('{').ok).toBe(false);expect(prepareCanonicalBackupRestore(JSON.stringify(canonicalFixture)).ok).toBe(false)})
})
