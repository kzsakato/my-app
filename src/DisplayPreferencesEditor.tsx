import { useState, type PointerEvent } from 'react'
import { effectiveDisplayPreferences, validSort, type SortKey, type SortPreference } from './canonical/displayPreferences'
import type { CanonicalAppData } from './canonical/types'

export function OptionSort({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="check"><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />Optionソート</label>
}
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
  const drop = (event: PointerEvent<HTMLSpanElement>, section: 'defaultSort' | 'optionSort', from: number) => {
    const handle = event.currentTarget
    if (!handle.hasPointerCapture(event.pointerId)) return
    const group = handle.closest('fieldset')
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.sort-priority-row')
    if (!group || !target || target.closest('fieldset') !== group) return
    const to = [...group.querySelectorAll('.sort-priority-row')].indexOf(target)
    if (to !== from && to >= 0) move(section, from, to)
  }
  return <>
    {(['defaultSort', 'optionSort'] as const).map(section => <section className="card display-preference-section" key={section} aria-label={section === 'defaultSort' ? 'Default' : 'Option'}>
      <h2>{section === 'defaultSort' ? 'Default' : 'Option'}</h2>
      <fieldset disabled={pending}><legend>ソート優先順位</legend>
        {draft[section].priority.map((key, index) => <div className="sort-priority-row" key={key}>
          <span>{index + 1} {labels[key]}</span>
          <span className="sort-drag-handle" aria-hidden="true"
            onPointerDown={event => {
              if (!pending && event.isPrimary && event.button === 0) event.currentTarget.setPointerCapture(event.pointerId)
            }}
            onPointerUp={event => drop(event, section, index)}>≡</span>
          <button className="small" aria-label={`${labels[key]}を上へ`} disabled={index === 0} onClick={() => move(section, index, index - 1)}>↑</button>
          <button className="small" aria-label={`${labels[key]}を下へ`} disabled={index === 2} onClick={() => move(section, index, index + 1)}>↓</button>
        </div>)}
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
