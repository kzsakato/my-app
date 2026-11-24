import { analysisBucketStart } from './analysis'
import { shiftLocalDate } from './baseline'
import { contributionError, contributionKeys } from './contributions'
import { validateCanonical } from './validate'
import type { CanonicalAppData } from './types'
export type WeeklyRow = { label:string;start:string;state:'AVAILABLE'|'INSUFFICIENT'|'UNAVAILABLE';regions:number[];allocated:number;unallocated:number }
export function recentWeeklyComparison(data:CanonicalAppData,today:string) {
 const current=analysisBucketStart(today,'week',data.weekStartsOn)
 const rows:WeeklyRow[]=[current,shiftLocalDate(current,-7),shiftLocalDate(current,-14),''].map((start,i)=>({label:['今回（途中）','前回','前々回','平均'][i],start,state:'AVAILABLE',regions:contributionKeys.map(()=>0),allocated:0,unallocated:0}))
 if (contributionError(data)||validateCanonical(data).errors.length) return {n:0,rows:rows.map(row=>({...row,state:'UNAVAILABLE' as const}))}
 const sessions=data.sessions.filter(s=>s.date<=today),oldest=sessions.map(s=>analysisBucketStart(s.date,'week',data.weekStartsOn)).sort()[0]
 const n=oldest ? Math.max(0,Math.round((Date.parse(current)-Date.parse(oldest))/(7*86400000))) : 0
 const mean=rows[3]
 for(const session of sessions) {
  const week=analysisBucketStart(session.date,'week',data.weekStartsOn),entry=data.contributions!.byExerciseId[session.snapshot.exerciseId]
  for(const row of rows.filter((row,i)=>i<3?row.start===week:n>0&&week<current)) {
   if (!Object.hasOwn(data.contributions!.byExerciseId,session.snapshot.exerciseId)) row.unallocated+=session.sets
   else {row.allocated+=session.sets;contributionKeys.forEach((key,i)=>row.regions[i]+=session.sets*entry.rates[key]/100)}
  }
 }
 for(const row of rows.slice(1,3)) if(!oldest||row.start<oldest) row.state='INSUFFICIENT'
 if(!n)mean.state='INSUFFICIENT'
 else {mean.regions=mean.regions.map(v=>v/n);mean.allocated/=n;mean.unallocated/=n}
 return {n,rows}
}
