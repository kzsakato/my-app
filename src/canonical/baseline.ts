import { referenceTrainingLoad } from './analysis'
import { localDate, weekStart } from './runtime'
import type { CanonicalAppData, Session } from './types'

export function shiftLocalDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00`)
  value.setDate(value.getDate() + days)
  return localDate(value)
}

/** Membership identity, not TrainingItem identity, determines planned completion. */
export function currentWeekSessions(data: CanonicalAppData, today: string): Session[] {
  const start = weekStart(today, data.weekStartsOn)
  const end = shiftLocalDate(start, 7)
  return data.sessions.filter(session => session.date >= start && session.date < end)
}

/** Date-only ordering preserves source order for ties; it does not invent an instant. */
export function latestRunSession(data: CanonicalAppData, today: string, itemId: string, entryId?: string): Session | undefined {
  return currentWeekSessions(data, today)
    .filter(session => entryId ? session.menuEntryId === entryId : !session.menuEntryId && session.trainingItemId === itemId)
    .sort((a, b) => b.date.localeCompare(a.date))[0]
}

/** DATA_SPEC §10.16: all observed completed weeks, including intervening zero weeks. */
export function weeklyLoadSummary(data: CanonicalAppData, today: string) {
  const currentWeek = weekStart(today, data.weekStartsOn)
  const loads = new Map<string, number>()
  for (const session of data.sessions) {
    const week = weekStart(session.date, data.weekStartsOn)
    loads.set(week, (loads.get(week) ?? 0) + referenceTrainingLoad(session))
  }
  const firstRecordedWeek = [...loads.keys()].sort()[0]
  // UTC calendar arithmetic avoids a DST hour changing the number of whole weeks.
  const completedWeeks = firstRecordedWeek && firstRecordedWeek < currentWeek
    ? Math.round((Date.parse(`${currentWeek}T00:00:00Z`) - Date.parse(`${firstRecordedWeek}T00:00:00Z`)) / 604_800_000)
    : 0
  const completedLoad = [...loads].reduce((sum, [week, load]) => week < currentWeek ? sum + load : sum, 0)
  const average = completedWeeks ? completedLoad / completedWeeks : undefined
  const denominator = [2, 3, 4, 5].reduce((sum, weeks) => sum + (loads.get(shiftLocalDate(currentWeek, -7 * weeks)) ?? 0), 0) / 4
  const ratio = (loads.get(shiftLocalDate(currentWeek, -7)) ?? 0) / denominator
  const acwr = completedWeeks >= 5 && denominator > 0 && Number.isFinite(denominator) && Number.isFinite(ratio) ? ratio : undefined
  return { current: loads.get(currentWeek) ?? 0, average: average !== undefined && Number.isFinite(average) ? average : undefined, acwr, completedWeeks }
}
