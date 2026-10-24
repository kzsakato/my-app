import { openDB } from 'idb'
import { DATA_VERSION, type AppData, type Category, type Exercise, type Item, type Menu, type MenuItem, type Profile, type Session, type SettingHistory, validateCanonical } from './domain'
import { loadCanonicalStartup, type CanonicalStorage, type CutoverState, type LegacyBaseline } from './canonical/cutover'
import type { CanonicalAppData } from './canonical/types'
import { initializeOwnerManagement, rebaseOwnerChange } from './canonical/management'
import { withDisplayPreferences } from './canonical/displayPreferences'
import { createTrainerApplyCandidate, trainerReadbackMatches, type TrainerApplyCandidate } from './canonical/trainerV11'
import { validateCanonical as validateCanonicalDomain } from './canonical/validate'

export type { AppData, Category, Exercise, Item, Menu, MenuItem, Profile, Session, SettingHistory } from './domain'
export type { MeasureType, WeightMode } from './domain'
export { createSessionSnapshot, makeBackup, migrateV5, parseBackup, validateCanonical } from './domain'

export const bodyParts=['胸','肩','腕','背中','体幹','下半身'] as const
const seedId=(x:string)=>`seed-${x}`
const raw=[['pull','プルダウン','背中','reps',1,0],['shrug','シュラッグ','背中','reps',1,1],['row-o','ロー（オーバーグリップ）','背中','reps',1,0],['row-u','ロー（アンダーグリップ）','背中','reps',1,0],['backext','バックエクステンション','背中','reps',1,0],['pullover','ストレートアーム・プルオーバー','背中','reps',1,0],['dbpress','ダンベルプレス','胸','reps',1,0],['fly','ペクトラルフライ（マシン）','胸','reps',1,0],['bench','ベンチプレス（逆手）','胸','reps',1,0],['inc','インクラインショルダープレス','肩','reps',1,0],['side','サイドレイズ','肩','reps',1,1],['bend','ダンベルサイドベント','体幹','reps',1,1],['raise','レッグレイズ','体幹','reps',0,0],['rotation','トーソローテーション','体幹','reps',1,0],['front','フロントプランク','体幹','time',0,0],['sideplank','サイドプランク','体幹','time',0,0],['legpress','レッグプレス','下半身','reps',1,0],['calf','カーフレイズ','下半身','reps',1,0],['curl','レッグカール','下半身','reps',1,0],['add','ヒップアダクション','下半身','reps',1,0],['abd','ヒップアブダクション','下半身','reps',1,0]] as const
const exercises:Exercise[]=raw.map(([i,name,bodyPart,measure,uses,side])=>({id:seedId(i),name,bodyPart,measureType:measure,usesWeight:Boolean(uses),weightMode:side?'perSide':'total',selfWeightRatio:0,secondsLoadRatio:0}))
const groups=[['chest','胸・肩',['胸','肩']],['back','背中',['背中']],['core','体幹・腕',['体幹','腕']],['lower','下半身',['下半身']]] as const
const cats:Category[]=groups.map(([i,name,parts])=>({id:seedId(i),name,bodyParts:[...parts],exerciseIds:exercises.filter(e=>(parts as readonly string[]).includes(e.bodyPart)).map(e=>e.id)}))
const values:(number|undefined)[][]=[[42.5,15,undefined,5],[34,15,undefined,5],[18,20,undefined,5],[54,15,undefined,5],[89,15,undefined,5],[24,15,undefined,5],[18,15,undefined,5],[22.5,15,undefined,5],[30,15,undefined,3],[14,15,undefined,5],[4,20,undefined,5],[18,20,undefined,5],[undefined,10,undefined,4],[57,15,undefined,5],[undefined,undefined,30,3],[undefined,undefined,30,3],[115,15,undefined,5],[125,15,undefined,5],[42.5,15,undefined,5],[124,15,undefined,5],[undefined,undefined,undefined,3]]
const items:Item[]=exercises.map((e,n)=>{const v=values[n],c=cats.find(x=>x.exerciseIds.includes(e.id))!;return{id:seedId(`item-${n}`),name:e.name,categoryId:c.id,exerciseId:e.id,weight:v[0],reps:v[1],seconds:v[2],sets:v[3]??0}})
export const base:AppData={version:DATA_VERSION,activeMenuId:seedId('ramp'),profile:{weight:66,analysisStartDate:localDate()},exercises,categories:cats,items,menus:[{id:seedId('ramp'),name:'助走トレーニング'},{id:seedId('normal'),name:'通常メニュー'}],menuItems:items.map((x,n)=>({id:seedId(`mi-${n}`),menuId:seedId('ramp'),itemId:x.id,recommendedDay:null})),sessions:[],settingHistories:[]}

const isV11Candidate=import.meta.env.VITE_V1R11_CANDIDATE === 'true'
const candidateOrigin=import.meta.env.VITE_V1R11_ORIGIN ?? 'http://127.0.0.1:4177'
if(isV11Candidate && location.origin !== candidateOrigin)throw new Error('V1.1候補版は指定された専用originで開いてください')
const dbPromise=openDB(isV11Candidate ? 'training-check-v1r11-candidate' : 'training-check',7,{upgrade(db){
 if(!db.objectStoreNames.contains('state'))db.createObjectStore('state')
 if(!db.objectStoreNames.contains('recovery'))db.createObjectStore('recovery')
 if(!db.objectStoreNames.contains('canonical'))db.createObjectStore('canonical')
 if(!db.objectStoreNames.contains('cutover'))db.createObjectStore('cutover')
 if(!db.objectStoreNames.contains('baseline'))db.createObjectStore('baseline')
}})
export type RecoveryPoint={id:'latest-legacy-source';sourceKind:string;capturedAt:string;rawJson:string}
const canonicalKey='app',cutoverKey='state',baselineKey='pre-migration-legacy-source'
/**
 * Stage 2 adapter. The legacy `state/app` value and the Stage 1 `recovery`
 * value remain separate and are never overwritten by these operations.
 */
export const canonicalStorage:CanonicalStorage={
 async readCutoverState(){const db=await dbPromise;return (await db.get('cutover',cutoverKey) as CutoverState|undefined)??{authoritative:false}},
 async writeCutoverState(value){const db=await dbPromise;await db.put('cutover',value,cutoverKey)},
 async readBaseline(){const db=await dbPromise;return db.get('baseline',baselineKey) as Promise<LegacyBaseline|undefined>},
 async writeBaseline(value){const db=await dbPromise;await db.put('baseline',value,baselineKey)},
 async readCanonical(){const db=await dbPromise;const value = await db.get('canonical',canonicalKey) as CanonicalAppData|undefined;return value ? initializeOwnerManagement(value) : undefined},
 async writeCanonical(value){const db=await dbPromise;await db.put('canonical',value,canonicalKey)},
}

/** Atomic latest-root Owner delta; preserves Trainer IDs/authority changed since the UI was opened. */
export async function commitOwnerCanonical(base: CanonicalAppData, next: CanonicalAppData): Promise<CanonicalAppData> {
 const db=await dbPromise, tx=db.transaction('canonical','readwrite')
 let completed=false
 try {
  const stored=await tx.store.get(canonicalKey) as CanonicalAppData|undefined
  if(!stored)throw new Error('canonical dataがありません')
  const candidate=withDisplayPreferences(rebaseOwnerChange(base,next,initializeOwnerManagement(stored)))
  const checked=validateCanonicalDomain(candidate)
  if(checked.errors.length)throw new Error(checked.errors.map(value=>`${value.path}: ${value.message}`).join(' / '))
  await tx.store.put(candidate,canonicalKey);await tx.done;completed=true
  const readback=await canonicalStorage.readCanonical()
  if(!readback || JSON.stringify(readback)!==JSON.stringify(candidate))throw new Error('保存後の読み戻しが一致しません')
  return readback
 } catch(error) {try{tx.abort()}catch{/* Transaction may already have completed. */}await tx.done.catch(()=>{});throw Object.assign(new Error(String(error)),{canonicalUnknown:completed})}
}

export type TrainerStorageResult = {ok:true;value:CanonicalAppData;mapping:TrainerApplyCandidate['mapping']} | {ok:false;unknown:boolean;reason:string}
/** Existing cutover record keeps only the one unresolved apply marker; no ledger/control store. */
export async function applyTrainerCanonical(input: unknown): Promise<TrainerStorageResult> {
 const db=await dbPromise, tx=db.transaction(['canonical','cutover'],'readwrite')
 let committed=false, unresolved=false
 let candidate:TrainerApplyCandidate|undefined
 const proposalId=String((input as {proposalId?:unknown})?.proposalId ?? '')
 try {
  const state=(await tx.objectStore('cutover').get(cutoverKey)) as CutoverState|undefined
  if(!state?.authoritative)throw new Error('canonical authorityがありません')
  if(state.trainerPendingProposalId){unresolved=true;throw new Error('先行するAI操作の結果が未確認です')}
  const stored=await tx.objectStore('canonical').get(canonicalKey) as CanonicalAppData|undefined
  if(!stored)throw new Error('canonical dataがありません')
  candidate=createTrainerApplyCandidate(input,initializeOwnerManagement(stored),()=>crypto.randomUUID(),new Date().toISOString())
  await tx.objectStore('canonical').put(candidate.data,canonicalKey)
  await tx.objectStore('cutover').put({...state,trainerPendingProposalId:proposalId},cutoverKey)
  await tx.done;committed=true
  const readback=await canonicalStorage.readCanonical()
  if(!readback || !trainerReadbackMatches(candidate,readback,proposalId))throw new Error('独立readbackで適用結果を確認できません')
  const finish=db.transaction('cutover','readwrite')
  const current=await finish.store.get(cutoverKey) as CutoverState
  if(current.trainerPendingProposalId!==proposalId){finish.abort();await finish.done.catch(()=>{});throw new Error('AI操作の帰属を確認できません')}
  delete current.trainerPendingProposalId
  await finish.store.put(current,cutoverKey);await finish.done
  return{ok:true,value:readback,mapping:candidate.mapping}
 }catch(error){
  try{tx.abort()}catch{/* Never write an old root back. */}
  await tx.done.catch(()=>{})
  return{ok:false,unknown:committed||unresolved,reason:String(error)}
 }
}
export type LoadResult={kind:'ready';data:AppData}|{kind:'migration';legacy:unknown}|{kind:'invalid';errors:string[]}|{kind:'canonical-ready';data:CanonicalAppData}|{kind:'canonical-recovery';errors:string[]}
export async function loadData():Promise<LoadResult>{
 const canonical=await loadCanonicalStartup(canonicalStorage)
 if(canonical.kind==='canonical-ready')return{kind:'canonical-ready',data:canonical.data}
 if(canonical.kind==='canonical-recovery-required')return{kind:'canonical-recovery',errors:canonical.diagnostics.map(x=>`${x.stage}: ${x.message}`)}
 const db=await dbPromise,v:unknown=await db.get('state','app')
 if(v===undefined||v===null)return{kind:'ready',data:base}
 if((v as {version?:unknown}).version===DATA_VERSION){const checked=validateCanonical(v);return checked.errors.length?{kind:'invalid',errors:checked.errors.map(x=>`${x.path}: ${x.message}`)}:{kind:'ready',data:v as AppData}}
 if((v as {version?:unknown}).version===5)return{kind:'migration',legacy:v}
 return{kind:'invalid',errors:['version: 未対応の保存データです。復元またはサポートへの相談が必要です。']}
}
export async function saveData(d:AppData){const checked=validateCanonical(d);if(checked.errors.length)throw new Error(checked.errors.map(x=>`${x.path}: ${x.message}`).join('\n'));const db=await dbPromise;await db.put('state',d,'app')}
export async function readBackData(){return loadData()}
/** Saves a legacy source separately. It never writes the active `state/app` value. */
export async function saveRecoveryPoint(rawJson:string,sourceKind:string):Promise<RecoveryPoint>{
 JSON.parse(rawJson)
 const point:RecoveryPoint={id:'latest-legacy-source',sourceKind,capturedAt:new Date().toISOString(),rawJson}
 const db=await dbPromise;await db.put('recovery',point,point.id);return point
}
export async function getRecoveryPoint():Promise<RecoveryPoint|undefined>{const db=await dbPromise;return db.get('recovery','latest-legacy-source')}
export function localDate(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
export function weekStart(d=new Date()){const x=new Date(d);x.setDate(x.getDate()-((x.getDay()+6)%7));x.setHours(0,0,0,0);return x}
