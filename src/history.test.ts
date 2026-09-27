import {describe,expect,it} from 'vitest'
import type {Item,Session} from './data'
import {exerciseHistory} from './history'

const exerciseId='exercise-arm-curl'
const items:Item[]=[
  {id:'item-light',name:'アームカール（軽）',categoryId:'category-arms',exerciseId,sets:3},
  {id:'item-heavy',name:'アームカール（重）',categoryId:'category-arms',exerciseId,sets:3},
  {id:'item-other',name:'プレスダウン',categoryId:'category-arms',exerciseId:'exercise-press-down',sets:3},
]
const today=new Date(2026,8,21,12)
const session=(id:string,itemId:string,isExtra=false):Session=>({id,itemId,date:'2026-09-21',sets:3,isExtra,snapshot:{exerciseId,exerciseName:'アームカール',trainingItemDisplayName:'テスト',measureType:'reps',weightMode:'total',selfWeightRatio:0,secondsLoadRatio:0}})

describe('exerciseHistory',()=>{
  it.each([
    ['軽TrainingItemの通常メニュー実施',session('normal-light','item-light')],
    ['重TrainingItemの通常メニュー実施',session('normal-heavy','item-heavy')],
    ['軽TrainingItemの追加トレーニング実施',session('extra-light','item-light',true)],
    ['重TrainingItemの追加トレーニング実施',session('extra-heavy','item-heavy',true)],
  ])('%sを同じExerciseの実施として表示する',(_name,record)=>{
    expect(exerciseHistory([record],items,exerciseId,today)).toMatch(/●$/)
  })

  it('別Exerciseの実施は含めない',()=>{
    expect(exerciseHistory([session('other','item-other')],items,exerciseId,today)).toMatch(/○$/)
  })
})
