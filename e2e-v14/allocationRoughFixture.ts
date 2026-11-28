import {canonicalFixture} from '../src/canonical/fixtures'
import type {CanonicalAppData} from '../src/canonical/types'
import {contributionKeys} from '../src/canonical/contributions'
/** Synthetic equivalent of the fixed normal rough: D27/U6, no Owner data. */
export function allocationRoughFixture():CanonicalAppData {
 const d=structuredClone(canonicalFixture);d.sessions=[];d.weekStartsOn=0;d.trainerDataRevision=0;d.contributions={version:1,byExerciseId:{}}
 const weeks=[[1,1,0,1,2,1],[0,1,1,1,2,1],[0,1,1,1,1,1],[2,2,1,1,2,1]],dates=['2026-02-02','2026-02-09','2026-02-16','2026-02-23'];let order=0
 for(let k=0;k<8;k++){
  const id=`rough-ex-${k}`,ti=`rough-ti-${k}`;d.exercises.push({...d.exercises[0],id,name:`架空種目${k}`});d.trainingItems.push({...d.trainingItems[0],id:ti,exerciseId:id})
  if(k!==6)d.contributions.byExerciseId[id]={revision:1,rates:Object.fromEntries(contributionKeys.map((key,i)=>[key,k===7?(i===0||i===2?50:0):k===i?100:0])) as any}
  for(let w=0;w<4;w++){const sets=k===6?[3,1,2,0][w]:k===7?(w===0?1:0):weeks[w][k];if(!sets)continue;d.sessions.push({...canonicalFixture.sessions[0],id:`rough-session-${order}`,trainingItemId:ti,menuEntryId:undefined,date:dates[w],performedAt:dates[w]+'T09:00:00+09:00',performedOrder:order++,sets,snapshot:{...canonicalFixture.sessions[0].snapshot,exerciseId:id,exerciseName:`架空種目${k}`}})}
 }
 d.trainingItemSettingChanges=d.trainingItems.map((ti,i)=>({...canonicalFixture.trainingItemSettingChanges[0],id:`rough-setting-${i}`,trainingItemId:ti.id}));return d
}
