// Fixed QA oracle bad82b1 / #6435758117; includes corrected Fixture B.
import {expect,it} from 'vitest'
import {fixture,A,B,C,D} from '../../e2e/mixedSortFixtures'
import {completedSessionRows,sortMixedTopRows} from './topProjection'
import {defaultDisplayPreferences,type SortPreference} from './displayPreferences'
const priorities:SortPreference['priority'][]=[['completion','recommendedDay','bodyRegion'],['recommendedDay','completion','bodyRegion'],['recommendedDay','bodyRegion','completion']]
const orders=[[['E-A','E-B','S-A','S-B'],['S-A','S-B','E-A','E-B']],[['E-A','S-A','E-B','S-B'],['S-A','E-A','S-B','E-B']],[['E-A','S-A','S-B','E-B'],['E-A','S-A','S-B','E-B']]]
for(const option of [false,true])for(const [p,priority]of priorities.entries())for(const [i,direction]of(['incompleteFirst','completeFirst']as const).entries())it(`QA A ${option?'Option':'Default'} key${p+1} ${direction}`,()=>{
 const d=fixture(A);d.displayPreferences=structuredClone(defaultDisplayPreferences);d.displayPreferences[option?'optionSort':'defaultSort']={priority,completionDirection:direction};const before=structuredClone(d)
 expect(sortMixedTopRows(d,d.menuEntries,completedSessionRows(d.sessions),option).map(r=>r.kind==='entry'?r.entry.id:r.actual.session.id)).toEqual(orders[p][i]);expect(d).toEqual(before)
})
for(const direction of ['incompleteFirst','completeFirst']as const)it(`QA C/D missing values and stable IDs ${direction}`,()=>{
 for(const option of [false,true])for(const [rows,expected]of [[C,['E-A','S-X','S-M','E-N']],[D,direction==='incompleteFirst'?['E-11','E-12','S-11','S-12']:['S-11','S-12','E-11','E-12']]]as const){
  const d=fixture([...rows]);d.displayPreferences=structuredClone(defaultDisplayPreferences);d.displayPreferences[option?'optionSort':'defaultSort']={priority:priorities[2],completionDirection:direction};expect(sortMixedTopRows(d,d.menuEntries,completedSessionRows(d.sessions),option).map(r=>r.kind==='entry'?r.entry.id:r.actual.session.id)).toEqual(expected)
 }
})
it('Technical tie: session names then IDs, not performedAt; independent inputs untouched',()=>{
 const d=fixture([{kind:'session',id:'S-z',day:0,region:'胸',name:'あ'},{kind:'session',id:'S-a',day:0,region:'胸',name:'い'},{kind:'session',id:'S-b',day:0,region:'胸',name:'あ'}]);const before=structuredClone(d)
 expect(sortMixedTopRows(d,[],completedSessionRows(d.sessions),false).map(r=>r.kind==='session'&&r.actual.session.id)).toEqual(['S-b','S-z','S-a']);expect(d).toEqual(before)
})

for(const option of [false,true])for(const direction of ['incompleteFirst','completeFirst']as const)it(`QA corrected B ${option?'Option':'Default'} ${direction}: completion before names`,()=>{
 const d=fixture(B);d.displayPreferences=structuredClone(defaultDisplayPreferences);d.displayPreferences[option?'optionSort':'defaultSort']={priority:priorities[2],completionDirection:direction};expect(sortMixedTopRows(d,d.menuEntries,completedSessionRows(d.sessions),option).map(r=>r.kind==='entry'?r.entry.id:r.actual.session.id)).toEqual(direction==='incompleteFirst'?['E-10','E-20','S-10','S-20']:['S-10','S-20','E-10','E-20'])
})
