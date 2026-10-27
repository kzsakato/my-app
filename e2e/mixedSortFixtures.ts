import {canonicalFixture} from '../src/canonical/fixtures'
import type {CanonicalAppData,RecommendedDay} from '../src/canonical/types'
export type SpecRow={kind:'entry'|'session';id:string;day?:RecommendedDay;region?:string;name?:string;exercise?:string}
export function fixture(rows:SpecRow[]):CanonicalAppData{
 const d=structuredClone(canonicalFixture);d.exercises=[];d.trainingItems=[];d.menuEntries=[];d.sessions=[];d.trainingItemSettingChanges=[]
 rows.forEach((r,i)=>{
  const ex=r.exercise??`ex-${r.id}`,name=r.name??'共通',item=`ti-${r.id}`
  if(!d.exercises.some(e=>e.id===ex))d.exercises.push({...canonicalFixture.exercises[0],id:ex,name, classifications:[{kind:'bodyRegion',label:r.kind==='session'?'肩':r.region??'胸'}]})
  d.trainingItems.push({...canonicalFixture.trainingItems[0],id:item,exerciseId:ex,displayName:name})
  d.trainingItemSettingChanges.push({...canonicalFixture.trainingItemSettingChanges[0],id:`change-${r.id}`,trainingItemId:item})
  if(r.kind==='entry')d.menuEntries.push({...canonicalFixture.menuEntries[0],id:r.id,trainingItemId:item,order:i,recommendedDay:r.day})
  else{const date=`2026-09-${21+(r.day??0)}`;d.sessions.push({...structuredClone(canonicalFixture.sessions[0]),id:r.id,trainingItemId:item,menuEntryId:undefined,date,performedAt:`${date}T${String(20-i).padStart(2,'0')}:00:00+09:00`,performedOrder:0,snapshot:{...canonicalFixture.sessions[0].snapshot,exerciseId:ex,exerciseName:name,trainingItemDisplayName:name,classifications:r.region?[{kind:'bodyRegion',label:r.region}]:undefined}})}
 });return d
}
export const A:SpecRow[]=[{kind:'entry',id:'E-A',day:0,region:'胸'},{kind:'entry',id:'E-B',day:1,region:'背中'},{kind:'session',id:'S-A',day:0,region:'背中'},{kind:'session',id:'S-B',day:1,region:'胸'}]
export const C:SpecRow[]=[{kind:'entry',id:'E-A',day:0,region:'胸'},{kind:'session',id:'S-X',day:0,region:'前腕'},{kind:'session',id:'S-M',day:0},{kind:'entry',id:'E-N',region:'胸'}]
export const D:SpecRow[]=[{kind:'entry',id:'E-12',day:0,region:'胸',exercise:'pending'},{kind:'entry',id:'E-11',day:0,region:'胸',exercise:'pending'},{kind:'session',id:'S-12',day:0,region:'胸',exercise:'actual'},{kind:'session',id:'S-11',day:0,region:'胸',exercise:'actual'}]
