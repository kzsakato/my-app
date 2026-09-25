import { openDB } from 'idb'
import { DATA_VERSION, type AppData, type Category, type Exercise, type Item, type Menu, type MenuItem, type Profile, type Session, type SettingHistory, validateCanonical } from './domain'

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

const dbPromise=openDB('training-check',6,{upgrade(db){if(!db.objectStoreNames.contains('state'))db.createObjectStore('state');if(!db.objectStoreNames.contains('recovery'))db.createObjectStore('recovery')}})
export type RecoveryPoint={id:'latest-legacy-source';sourceKind:string;capturedAt:string;rawJson:string}
export type LoadResult={kind:'ready';data:AppData}|{kind:'migration';legacy:unknown}|{kind:'invalid';errors:string[]}
export async function loadData():Promise<LoadResult>{
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
