import { contributionError, contributionKeys, type ContributionKey } from './contributions'
import { validateCanonical } from './validate'
import type { CanonicalAppData, Session } from './types'

/** Pure arithmetic on an explicitly supplied session selection. This does not
 * select a period or infer the unresolved V13 window/bucket/default contract. */
export function contributionAnalysis(data: CanonicalAppData, selectedSessions: Session[]) {
  const totals = Object.fromEntries(contributionKeys.map(k => [k, 0])) as Record<ContributionKey, number>
  const exercises = new Map<string, { id: string; name: string; totals: Record<ContributionKey, number> }>()
  const error = contributionError(data)
  if (error || validateCanonical(data).errors.length || new Set(selectedSessions.map(s => s.id)).size !== selectedSessions.length || selectedSessions.some(s => !data.sessions.some(original => JSON.stringify(original) === JSON.stringify(s)))) return { state: 'UNAVAILABLE' as const, error: error ?? 'INVALID_CANONICAL_OR_SELECTION' }
  let D = 0, U = 0
  for (const session of selectedSessions) {
    const id = session.snapshot.exerciseId
    if (!data.exercises.some(e => e.id === id)) return { state: 'UNAVAILABLE' as const, error: 'ORPHAN_SNAPSHOT' }
    const entry = Object.hasOwn(data.contributions!.byExerciseId, id) ? data.contributions!.byExerciseId[id] : undefined
    if (!entry) { U += session.sets; continue }
    D += session.sets
    const row = exercises.get(id) ?? { id, name: session.snapshot.exerciseName, totals: Object.fromEntries(contributionKeys.map(k => [k, 0])) as Record<ContributionKey, number> }
    contributionKeys.forEach(key => {
      const amount = session.sets * entry.rates[key] / 100
      totals[key] += amount; row.totals[key] += amount
    })
    exercises.set(id, row)
  }
  return { state: D + U === 0 ? 'ZERO' as const : 'READY' as const, totals, exercises: [...exercises.values()], D, U, T: D + U }
}

/** Presentation only: largest remainder in fixed six-key order, sum 100.
 * Original set-equivalent amounts are never rounded or redistributed. */
export function displayPercentages(totals: Record<ContributionKey, number>, D: number): number[] {
  if (!(D > 0)) return []
  const raw = contributionKeys.map(k => totals[k] / D * 100)
  const out = raw.map(Math.floor)
  const order = raw.map((n, i) => ({ i, fraction: n - out[i] })).sort((a, b) => b.fraction - a.fraction || a.i - b.i)
  const remainder = 100 - out.reduce((a, b) => a + b, 0)
  for (let n = 0; n < remainder; n++) out[order[n % order.length].i]++
  return out
}
