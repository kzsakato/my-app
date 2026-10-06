import type { CanonicalAppData, MenuEntry, Session } from './types'

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
