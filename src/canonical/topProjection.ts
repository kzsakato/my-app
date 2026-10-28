import type { CanonicalAppData, MenuEntry, Session } from './types'
import { sessionOrder } from './baseline'
import { compareBodyRegions, compareNames, effectiveDisplayPreferences, exerciseBodyRegion } from './displayPreferences'

/** V1.2 formal 06 §4.5: presentation-only final ID tie; no persisted ordering changes. */
export function displayedSessionOrder(left: Session, right: Session): number {
  return sessionOrder(left, right) || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
}

/** Exercise completion answers only a boolean; it cannot select an actual. */
export function completedEntryIds(data: CanonicalAppData, entries: MenuEntry[], sessions: Session[]): Set<string> {
  const exercises = new Set(sessions.map(session => session.snapshot.exerciseId))
  const items = new Map(data.trainingItems.map(item => [item.id, item]))
  return new Set(entries.filter(entry => exercises.has(items.get(entry.trainingItemId)?.exerciseId ?? '')).map(entry => entry.id))
}

export type CompletedSessionRow = {
  session: Session
  label: string
  bodyRegion?: string
}

/** One canonical Session per row, including repeated membership and Extra.
 * Missing historical classification remains visible in classification-free views.
 * Never consult a current master or planned row to fill snapshot meaning.
 */
export function completedSessionRows(sessions: Session[]): CompletedSessionRow[] {
  return sessions.map(session => ({
    session,
    label: session.snapshot.trainingItemDisplayName,
    bodyRegion: session.snapshot.classifications?.find(value => value.kind === 'bodyRegion')?.label.trim() || undefined,
  }))
}

export type MixedTopRow = { kind: 'entry'; entry: MenuEntry } | { kind: 'session'; actual: CompletedSessionRow }

/** Technical #6433073812: compare filtered visible rows, never canonical arrays. */
export function sortMixedTopRows(data: CanonicalAppData, entries: readonly MenuEntry[], actuals: readonly CompletedSessionRow[], option: boolean): MixedTopRow[] {
  const preferences = effectiveDisplayPreferences(data)
  const sort = option ? preferences.optionSort : preferences.defaultSort
  const values = (row: MixedTopRow) => {
    if (row.kind === 'session') {
      const session = row.actual.session
      return { id: session.id, name: row.actual.label, day: (new Date(`${session.date}T12:00:00`).getDay() + 6) % 7,
        region: exerciseBodyRegion(session.snapshot), completed: true }
    }
    const item = data.trainingItems.find(item => item.id === row.entry.trainingItemId)
    const exercise = data.exercises.find(exercise => exercise.id === item?.exerciseId)
    return { id: row.entry.id, name: item?.displayName || exercise?.name || '', day: row.entry.recommendedDay ?? 7,
      region: exerciseBodyRegion(exercise), completed: false }
  }
  const rows: MixedTopRow[] = [...entries.map(entry => ({ kind: 'entry' as const, entry })), ...actuals.map(actual => ({ kind: 'session' as const, actual }))]
  return rows.sort((left, right) => {
    const a = values(left), b = values(right)
    for (const key of sort.priority) {
      const delta = key === 'recommendedDay' ? a.day - b.day : key === 'bodyRegion' ? compareBodyRegions(a.region, b.region, preferences.bodyRegionOrder) :
        (Number(a.completed) - Number(b.completed)) * (sort.completionDirection === 'incompleteFirst' ? 1 : -1)
      if (delta) return delta
    }
    return compareNames(a.name, b.name) || (left.kind === right.kind ? 0 : left.kind === 'entry' ? -1 : 1) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  })
}
