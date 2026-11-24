import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { effectiveDisplayPreferences, validSort, type SortKey, type SortPreference } from './canonical/displayPreferences'
import type { CanonicalAppData } from './canonical/types'

export function OptionSort({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="check"><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />Optionソート</label>
}
const v14 = import.meta.env.VITE_V13_FEATURES === 'true'
const SortRow = v14 ? PriorityRow : LegacyPriorityRow
const labels: Record<SortKey, string> = { recommendedDay: '推奨曜日', completion: '実施状況', bodyRegion: '部位' }
export function DisplayPreferencesEditor({ data, commit, onSaved }: { data: CanonicalAppData; commit: (next: CanonicalAppData) => Promise<boolean>; onSaved: () => void }) {
  const [draft, setDraft] = useState(() => effectiveDisplayPreferences(data))
  const [pending, setPending] = useState(false)
  const move = (section: 'defaultSort' | 'optionSort', from: number, to: number) => {
    setDraft(current => {
      const priority = [...current[section].priority] as SortPreference['priority']
      const [key] = priority.splice(from, 1)
      priority.splice(to, 0, key)
      return { ...current, [section]: { ...current[section], priority } }
    })
  }
  return <>
    {(['defaultSort', 'optionSort'] as const).map(section => <section className="card display-preference-section" key={section} aria-label={section === 'defaultSort' ? 'Default' : 'Option'}>
      <h2>{section === 'defaultSort' ? 'Default' : 'Option'}</h2>
      <fieldset disabled={pending}><legend>ソート優先順位</legend>
        {draft[section].priority.map((key, index) => <SortRow key={key} index={index} disabled={pending} label={labels[key]} onMove={to=>move(section,index,to)}>
          <span>{index + 1} {labels[key]}</span>
          {!v14 && <span className="sort-drag-handle" aria-hidden="true">≡</span>}
          <button className="small" aria-label={`${labels[key]}を上へ`} disabled={index === 0} onClick={() => move(section, index, index - 1)}>↑</button>
          <button className="small" aria-label={`${labels[key]}を下へ`} disabled={index === 2} onClick={() => move(section, index, index + 1)}>↓</button>
        </SortRow>)}
      </fieldset>
      <fieldset disabled={pending}><legend>実施状況</legend>
        {(['incompleteFirst', 'completeFirst'] as const).map(value => <label className="check" key={value}><input type="radio" name={section} checked={draft[section].completionDirection === value} onChange={() => setDraft({ ...draft, [section]: { ...draft[section], completionDirection: value } })} />{value === 'incompleteFirst' ? '未実施先' : '実施済先'}</label>)}
      </fieldset>
    </section>)}
    <button className="primary" disabled={pending || !validSort(draft.defaultSort) || !validSort(draft.optionSort)} onClick={async () => {
      setPending(true)
      try { if (await commit({ ...data, displayPreferences: draft })) onSaved() } finally { setPending(false) }
    }}>設定を保存</button>
  </>
}

export function DisplayPreferencesSummary({ data }: { data: CanonicalAppData }) {
  const value = effectiveDisplayPreferences(data)
  return <dl className="preference-preview">
    {(['defaultSort', 'optionSort'] as const).map(section => <div key={section}><dt>{section === 'defaultSort' ? 'Default' : 'Option'}</dt><dd>{value[section].priority.map(key => labels[key]).join(' → ')} / {value[section].completionDirection === 'incompleteFirst' ? '未実施先' : '実施済先'}</dd></div>)}
    <div><dt>部位</dt><dd>{value.bodyRegionOrder.join(' → ')}</dd></div>
  </dl>
}

// Movement intent is an internal heuristic, not a long-press requirement.
// Fast vertical swipes retain the browser's normal scrolling; deliberate movement lifts a row.
function PriorityRow({index,label,disabled,onMove,children}:{index:number;label:string;disabled:boolean;onMove:(to:number)=>void;children:ReactNode}) {
 const ref=useRef<HTMLDivElement>(null)
 const gesture=useRef<{x:number;y:number;t:number;mode:'pending'|'drag'|'scroll';rect:DOMRect}|null>(null)
 const [floating,setFloating]=useState<{x:number;y:number;rect:DOMRect}|null>(null)
 const [target,setTarget]=useState<number>()
 const onMoveRef=useRef(onMove);onMoveRef.current=onMove
 const begin=(x:number,y:number)=>{if(!ref.current||disabled)return;gesture.current={x,y,t:performance.now(),mode:'pending',rect:ref.current.getBoundingClientRect()}}
 const track=(x:number,y:number,touch:boolean)=>{
  const g=gesture.current;if(!g)return false
  const distance=Math.hypot(x-g.x,y-g.y)
  if(g.mode==='pending'&&distance>=6)g.mode=touch&&Math.abs(y-g.y)>Math.abs(x-g.x)&&distance/Math.max(1,performance.now()-g.t)>.7?'scroll':'drag'
  if(g.mode!=='drag'||ref.current?.closest('fieldset')?.disabled)return false
  setFloating({x,y,rect:g.rect})
  const group=ref.current?.closest('fieldset'),hit=document.elementFromPoint(x,y)?.closest('.sort-priority-row')
  setTarget(group&&hit&&hit.closest('fieldset')===group?[...group.querySelectorAll('.sort-priority-row')].indexOf(hit):undefined)
  return true
 }
 const finish=()=>{if(!disabled&&gesture.current?.mode==='drag'&&target!==undefined&&target!==index)onMoveRef.current(target);gesture.current=null;setFloating(null);setTarget(undefined)}
 const finishRef=useRef(finish);finishRef.current=finish
 useEffect(()=>{
  const el=ref.current;if(!el)return
  const start=(e:TouchEvent)=>{if((e.target as Element).closest('button'))return;const p=e.touches[0];begin(p.clientX,p.clientY)}
  const move=(e:TouchEvent)=>{const p=e.touches[0];if(p&&track(p.clientX,p.clientY,true))e.preventDefault()}
  const end=()=>finishRef.current()
  const cancel=()=>{gesture.current=null;setFloating(null);setTarget(undefined)}
  el.addEventListener('touchstart',start,{passive:true});el.addEventListener('touchmove',move,{passive:false});el.addEventListener('touchend',end);el.addEventListener('touchcancel',cancel)
  return()=>{el.removeEventListener('touchstart',start);el.removeEventListener('touchmove',move);el.removeEventListener('touchend',end);el.removeEventListener('touchcancel',cancel)}
 },[])
 return <><div ref={ref} className={`sort-priority-row ${floating?'v14-drag-source':''}`} data-drag-key={label}
 onPointerDown={e=>{if(e.pointerType==='touch'||(e.target as Element).closest('button'))return;begin(e.clientX,e.clientY);e.currentTarget.setPointerCapture(e.pointerId)}}
 onPointerMove={e=>{if(e.pointerType!=='touch')track(e.clientX,e.clientY,false)}} onPointerUp={e=>{if(e.pointerType!=='touch')finish()}}
 onPointerCancel={()=>{gesture.current=null;setFloating(null);setTarget(undefined)}}>{children}{floating&&target!==undefined&&<small className="v14-drop-candidate">{target+1}位へ</small>}</div>
 {floating&&createPortal(<div className="v14-drag-ghost" style={{left:floating.rect.left,top:floating.y+12,width:floating.rect.width}} aria-hidden="true">{label}</div>,document.body)}</>
}

// Preserve the fixed candidate's handle-only gesture; V1.4 uses the whole-row component.
function LegacyPriorityRow({index,disabled,onMove,children}:{index:number;label:string;disabled:boolean;onMove:(to:number)=>void;children:ReactNode}) {
 return <div className="sort-priority-row" onPointerDown={event=>{
  if(!disabled&&event.isPrimary&&event.button===0&&(event.target as Element).closest('.sort-drag-handle'))event.currentTarget.setPointerCapture(event.pointerId)
 }} onPointerUp={event=>{
  if(!event.currentTarget.hasPointerCapture(event.pointerId))return
  const group=event.currentTarget.closest('fieldset'),target=document.elementFromPoint(event.clientX,event.clientY)?.closest('.sort-priority-row')
  if(!disabled&&group&&target&&target.closest('fieldset')===group){const to=[...group.querySelectorAll('.sort-priority-row')].indexOf(target);if(to>=0&&to!==index)onMove(to)}
 }}>{children}</div>
}
