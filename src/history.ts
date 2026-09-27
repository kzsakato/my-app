import type {Item,Session} from './domain'

const localDate=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`

/** Builds the 14-day display for all TrainingItems sharing one Exercise. */
export function exerciseHistory(sessions:Session[],items:Item[],exerciseId:string,today=new Date()):string{
  const itemIds=new Set(items.filter(item=>item.exerciseId===exerciseId).map(item=>item.id))
  const dates=Array.from({length:14},(_,index)=>{const date=new Date(today);date.setDate(date.getDate()-(13-index));return date})
  return dates.map((date,index)=>`${index>0&&date.getDay()===1?'｜':''}${sessions.some(session=>itemIds.has(session.itemId)&&session.date===localDate(date))?'●':'○'}`).join('')
}
