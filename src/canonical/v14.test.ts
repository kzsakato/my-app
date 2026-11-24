import {describe,it,expect} from 'vitest'
import {canonicalFixture} from './fixtures'
import {prepareContributionV3,parseTrainerProposalV3,createTrainerContextV3} from './trainerV14'
import {completedEntryIds} from './topProjection'
import {recentWeeklyComparison} from './analysisV14'
import {projectAnalysisV13} from './analysisV13'
const r={chest:50,back:25,arms:15,shoulders:5,lowerBody:5,core:0},a={...r,chest:40,back:30,lowerBody:10},c={...r,chest:35,back:35,lowerBody:10}
const base=()=>({...structuredClone(canonicalFixture),trainerDataRevision:12,contributions:{version:1 as const,byExerciseId:{'exercise-1':{rates:r,revision:2}}}})
const proposal=(rates=a,id='v3-test')=>JSON.stringify({format:'training-project.trainer-proposal',version:3,proposalId:id,baseRevision:1,operations:[{type:'correctContribution',exerciseId:'exercise-1',rates,reason:'synthetic'}]})
describe('Issue42 approved V14 data boundaries',()=>{
 it('v3 stale diagnostic is accepted, exact whole non-target scope unchanged',()=>{
  const d=base(),before=structuredClone(d),v=prepareContributionV3(proposal(),d)
  expect(v.changedCount).toBe(1);expect(v.candidate.contributions.byExerciseId['exercise-1']).toEqual({rates:a,revision:3});expect(v.candidate.trainerDataRevision).toBe(13)
  const {contributions:_,trainerDataRevision:__,appliedProposalIds:___,...rest}=v.candidate
  const {contributions:____,trainerDataRevision:_____,appliedProposalIds:______,...old}=d
  expect(rest).toEqual(old);expect(d).toEqual(before)
 })
 it('same proposal re-upload applies last intent; same rates are no-op',()=>{
  const d=prepareContributionV3(proposal(),base()).candidate
  const second=prepareContributionV3(proposal(c,'later'),d).candidate
  const third=prepareContributionV3(proposal(),second)
  expect(third.candidate.trainerDataRevision).toBe(15);expect(third.candidate.contributions.byExerciseId['exercise-1'].revision).toBe(5)
  expect(third.candidate.appliedProposalIds).toEqual(['v3-test','later'])
  const no=prepareContributionV3(proposal(),third.candidate);expect(no.changedCount).toBe(0);expect(no.candidate).toEqual(third.candidate)
 })
 it('same target ordered operations count distinct final changed IDs only',()=>{
  const p=JSON.parse(proposal());p.operations.push({...p.operations[0],rates:c})
  const v=prepareContributionV3(JSON.stringify(p),base());expect(v.changedCount).toBe(1);expect(v.candidate.contributions.byExerciseId['exercise-1']).toEqual({rates:c,revision:3})
  p.operations.push({...p.operations[0],rates:r});expect(prepareContributionV3(JSON.stringify(p),base()).changedCount).toBe(0)
 })
 it('initial then correction in one batch has revision1; archived target allowed',()=>{
  const d=base();d.exercises.push({...d.exercises[0],id:'new-target',lifecycle:'archived'})
  const p=JSON.parse(proposal());p.operations=[{type:'setInitialContribution',exerciseId:'new-target',expectedState:'NO_ENTRY',rates:r,reason:'synthetic'},{type:'correctContribution',exerciseId:'new-target',rates:a,reason:'synthetic'}]
  const v=prepareContributionV3(JSON.stringify(p),d);expect(v.candidate.contributions.byExerciseId['new-target']).toEqual({rates:a,revision:1})
 })
 it.each(['{"format":"x","format":"y"}',proposal({...a,chest:41}),proposal().replace('exercise-1','orphan')])('rejects malformed or invalid scope with input unchanged: %s',raw=>{const d=base(),old=structuredClone(d);expect(()=>prepareContributionV3(raw,d)).toThrow();expect(d).toEqual(old)})
 it('v3 Context is read-only and emits target revision with nested version3',()=>{const d=base(),old=structuredClone(d);const out=createTrainerContextV3(d,new Date('2026-11-24T12:00:00+09:00'),true);expect(out.version).toBe(3);expect(out.trainingContext.contractVersion).toBe(3);expect(out.trainingContext.contributionStates[0]).toMatchObject({revision:2,rates:r});expect(d).toEqual(old)})
 it('completion belongs only to active matching Entry ID, never Extra or same Exercise',()=>{const d=base();d.menuEntries.push({...d.menuEntries[0],id:'entry-2',order:1});expect([...completedEntryIds(d,d.menuEntries,d.sessions)]).toEqual(['entry-1']);expect(completedEntryIds(d,d.menuEntries,d.sessions.map(s=>({...s,menuEntryId:undefined}))).size).toBe(0)})
 it('weekly N includes confirmed empty week, excludes current week; source immutable',()=>{
  const d=base();d.contributions.byExerciseId['exercise-1'].rates={...r,chest:100,back:0,arms:0,shoulders:0,lowerBody:0};d.sessions=['2025-12-15','2025-12-29','2026-01-05'].map((date,i)=>({...d.sessions[0],id:'s'+i,date,performedAt:date+'T12:00:00+09:00',sets:[3,2,9][i]}));const before=structuredClone(d)
  const v=recentWeeklyComparison(d,'2026-01-07');expect(v.n).toBe(3);expect(v.rows.map(r=>r.allocated)).toEqual([9,2,0,5/3]);expect(d).toEqual(before)
  const oldPt=projectAnalysisV13(d,'week','2026-01-07');d.contributions.byExerciseId['exercise-1'].rates=a;const newPt=projectAnalysisV13(d,'week','2026-01-07');if(oldPt.state==='AVAILABLE'&&newPt.state==='AVAILABLE')expect(newPt.buckets.map(b=>b.pt)).toEqual(oldPt.buckets.map(b=>b.pt))
 })
 it('N=0 is insufficient, invalid scope is unavailable not zero',()=>{const d=base();expect(recentWeeklyComparison(d,'2026-09-24').rows[3].state).toBe('INSUFFICIENT');d.contributions.byExerciseId['exercise-1'].rates={...r,chest:41};expect(recentWeeklyComparison(d,'2026-09-24').rows.every(r=>r.state==='UNAVAILABLE')).toBe(true)})
})

it('P0 archived two-target batch increments global once and preserves non-target rates/history',()=>{
 const d=base();d.exercises.push({...d.exercises[0],id:'ex-002',lifecycle:'archived'},{...d.exercises[0],id:'ex-004'});Object.assign(d.contributions.byExerciseId,{'ex-002':{rates:{chest:0,back:50,arms:20,shoulders:20,lowerBody:10,core:0},revision:4},'ex-004':{rates:r,revision:7}});d.appliedProposalIds=['old-ledger'];const old=structuredClone(d)
 const p=JSON.parse(proposal());p.operations.push({...p.operations[0],exerciseId:'ex-002',rates:{chest:0,back:45,arms:20,shoulders:20,lowerBody:15,core:0}});const v=prepareContributionV3(JSON.stringify(p),d);expect(v.changedCount).toBe(2);expect(v.candidate.trainerDataRevision).toBe(13);expect(v.candidate.contributions.byExerciseId['ex-002'].revision).toBe(5);expect(v.candidate.contributions.byExerciseId['ex-004']).toEqual(d.contributions.byExerciseId['ex-004']);expect(v.candidate.appliedProposalIds).toEqual(['old-ledger','v3-test']);expect(d).toEqual(old)
})
it('V14-03 cancel only matching remaining Session; other Menu/archive and Extra never complete',()=>{
 const d=base();d.menuEntries.push({...d.menuEntries[0],id:'other-day',recommendedDay:3,order:1},{...d.menuEntries[0],id:'archived',lifecycle:'archived'});d.menus.push({...d.menus[0],id:'other-menu'});d.menuEntries.push({...d.menuEntries[0],id:'foreign',menuId:'other-menu'});const s=d.sessions[0];d.sessions=[s,{...s,id:'S3',performedOrder:1},{...s,id:'Extra',menuEntryId:undefined,performedOrder:2},{...s,id:'foreignS',menuEntryId:'foreign',performedOrder:3}];expect([...completedEntryIds(d,d.menuEntries,d.sessions)]).toEqual(['entry-1']);d.sessions=d.sessions.filter(x=>x.id!==s.id);expect([...completedEntryIds(d,d.menuEntries,d.sessions)]).toEqual(['entry-1']);d.sessions=d.sessions.filter(x=>x.id!=='S3');expect(completedEntryIds(d,d.menuEntries,d.sessions).size).toBe(0)
})
it('year boundary approved weekly fixture chest9/2.5/0/mean2 with calendar empty week',()=>{
 const d=base();d.weekStartsOn=0;d.sessions=['2025-12-15','2025-12-29','2026-01-05'].map((date,i)=>({...d.sessions[0],id:'s'+i,date,performedAt:date+'T12:00:00+09:00',sets:[7,5,18][i]}));const v=recentWeeklyComparison(d,'2026-01-07');expect(v.n).toBe(3);expect(v.rows.map(r=>r.regions[0])).toEqual([9,2.5,0,2]);expect(v.rows[2].state).toBe('AVAILABLE')
})
it('weekly U-only is available, D7/U3 use same mean denominator, no invalid zero fabrication',()=>{
 const d=base();d.exercises.push({...d.exercises[0],id:'no-entry'});const s=d.sessions[0];d.sessions=[{...s,sets:7,date:'2026-09-17',performedAt:'2026-09-17T09:00:00+09:00'},{...s,id:'u',sets:3,date:'2026-09-17',performedAt:'2026-09-17T10:00:00+09:00',snapshot:{...s.snapshot,exerciseId:'no-entry'}}];const v=recentWeeklyComparison(d,'2026-09-24');expect(v.n).toBe(1);expect(v.rows[1]).toMatchObject({allocated:7,unallocated:3,state:'AVAILABLE'});expect(v.rows[3]).toMatchObject({allocated:7,unallocated:3});delete (d.contributions.byExerciseId as any)['exercise-1'];expect(recentWeeklyComparison(d,'2026-09-24').rows[1]).toMatchObject({allocated:0,unallocated:10,state:'AVAILABLE'})
})
it('graph5 stable IDs keep equal names and unrounded shares 14.3/35.7/50.0; equal thirds33.3',()=>{
 const d=base();d.exercises.push({...d.exercises[0],id:'e2'},{...d.exercises[0],id:'e3'});Object.assign(d.contributions.byExerciseId,{e2:{rates:{...r,chest:25,back:50},revision:1},e3:{rates:{...r,chest:25,back:50},revision:1}});d.sessions=[1,5,7].map((sets,i)=>({...d.sessions[0],id:'s'+i,performedOrder:i,sets,snapshot:{...d.sessions[0].snapshot,exerciseId:['exercise-1','e2','e3'][i]}}));const v=projectAnalysisV13(d,'week','2026-09-24');expect(v.state).toBe('AVAILABLE');if(v.state==='AVAILABLE')expect([...v.byExercise.values()].map(x=>(100*x[0]/v.regions[0]).toFixed(1))).toEqual(['14.3','35.7','50.0']);d.sessions=d.sessions.map(s=>({...s,sets:2}));Object.assign(d.contributions.byExerciseId,{e2:{rates:r,revision:1},e3:{rates:r,revision:1}});const t=projectAnalysisV13(d,'week','2026-09-24');if(t.state==='AVAILABLE')expect([...t.byExercise.values()].map(x=>(100*x[0]/t.regions[0]).toFixed(1))).toEqual(['33.3','33.3','33.3'])
})
