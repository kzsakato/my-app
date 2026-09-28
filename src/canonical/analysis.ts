import { localDate, weekStart } from './runtime'
import type { CanonicalAppData, RecommendedDay, Session } from './types'

export type AnalysisPeriod = 'week' | 'month' | 'quarter' | 'year'

export type AnalysisSeries = {
  id: string
  name: string
  values: number[]
}

export type AnalysisTimeline = {
  bucketStarts: string[]
  values: number[]
}

export type ExerciseActualTimeline = {
  bucketStarts: string[]
  maxWeight: Array<number | undefined>
  reps: number[]
  seconds: number[]
  sets: number[]
  sessions: number[]
}

export type FrequencyRow = {
  id: string
  name: string
  sessions: number
  reps: number
  seconds: number
  sets: number
}

const pad = (value: number) => String(value).padStart(2, '0')
const atLocalMidnight = (date: string) => new Date(`${date}T00:00:00`)
const dateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/**
 * Formal DATA_SPEC §10.16 derived training-load function.
 * It intentionally reads only facts retained in the Session and its snapshot.
 */
export function referenceTrainingLoad(session: Session): number {
  if (session.snapshot.measureType === 'time') {
    return (session.bodyWeight ?? 0) * ((session.snapshot.secondsLoadRatio ?? 0) / 100) * (session.seconds ?? 0) * session.sets
  }
  const sideFactor = session.snapshot.weightMode === 'perSide' ? 2 : 1
  const external = (session.weight ?? 0) * sideFactor * (session.reps ?? 0) * session.sets
  const selfWeight = (session.bodyWeight ?? 0) * ((session.snapshot.selfWeightRatio ?? 0) / 100) * (session.reps ?? 0) * session.sets
  return external + selfWeight
}

export function analysisBucketStart(date: string, period: AnalysisPeriod, weekStartsOn: RecommendedDay): string {
  if (period === 'week') return weekStart(date, weekStartsOn)
  const value = atLocalMidnight(date)
  if (period === 'month') return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-01`
  if (period === 'quarter') return `${value.getFullYear()}-${pad(Math.floor(value.getMonth() / 3) * 3 + 1)}-01`
  return `${value.getFullYear()}-01-01`
}

function shiftBucket(start: string, period: AnalysisPeriod, offset: number): string {
  const value = atLocalMidnight(start)
  if (period === 'week') value.setDate(value.getDate() + offset * 7)
  if (period === 'month') value.setMonth(value.getMonth() + offset)
  if (period === 'quarter') value.setMonth(value.getMonth() + offset * 3)
  if (period === 'year') value.setFullYear(value.getFullYear() + offset)
  return dateKey(value)
}

export function analysisBucketStarts(args: {
  nowDate: string
  period: AnalysisPeriod
  weekStartsOn: RecommendedDay
  count?: number
}): string[] {
  const count = args.count ?? 12
  const current = analysisBucketStart(args.nowDate, args.period, args.weekStartsOn)
  return Array.from({ length: count }, (_, index) => shiftBucket(current, args.period, index - count + 1))
}

function timelineBuckets(data: CanonicalAppData, period: AnalysisPeriod, nowDate: string, count?: number) {
  const bucketStarts = analysisBucketStarts({ nowDate, period, weekStartsOn: data.weekStartsOn, count })
  return { bucketStarts, indexes: new Map(bucketStarts.map((value, index) => [value, index])) }
}

function sessionBucketIndex(session: Session, period: AnalysisPeriod, data: CanonicalAppData, indexes: Map<string, number>) {
  return indexes.get(analysisBucketStart(session.date, period, data.weekStartsOn))
}

export function overallDerivedLoad(data: CanonicalAppData, period: AnalysisPeriod, nowDate = localDate(), count?: number): AnalysisTimeline {
  const { bucketStarts, indexes } = timelineBuckets(data, period, nowDate, count)
  const values = Array.from({ length: bucketStarts.length }, () => 0)
  data.sessions.forEach((session) => {
    const index = sessionBucketIndex(session, period, data, indexes)
    if (index !== undefined) values[index] += referenceTrainingLoad(session)
  })
  return { bucketStarts, values }
}

function bodyRegionNames(session: Session): string[] {
  const names = session.snapshot.classifications
    ?.filter((value) => value.kind === 'bodyRegion' && value.label.trim())
    .map((value) => value.label.trim()) ?? []
  return names.length ? [...new Set(names)] : ['未分類']
}

export function bodyRegionDerivedLoad(data: CanonicalAppData, period: AnalysisPeriod, nowDate = localDate(), count?: number): { bucketStarts: string[]; series: AnalysisSeries[] } {
  const { bucketStarts, indexes } = timelineBuckets(data, period, nowDate, count)
  const series = new Map<string, number[]>()
  data.sessions.forEach((session) => {
    const index = sessionBucketIndex(session, period, data, indexes)
    if (index === undefined) return
    bodyRegionNames(session).forEach((name) => {
      const values = series.get(name) ?? Array.from({ length: bucketStarts.length }, () => 0)
      values[index] += referenceTrainingLoad(session)
      series.set(name, values)
    })
  })
  return {
    bucketStarts,
    series: [...series.entries()].map(([name, values]) => ({ id: name, name, values })).sort((left, right) => left.name.localeCompare(right.name, 'ja')),
  }
}

export function exerciseOptions(data: CanonicalAppData): Array<{ id: string; name: string }> {
  const names = new Map<string, string>()
  data.sessions.forEach((session) => names.set(session.snapshot.exerciseId, session.snapshot.exerciseName))
  return [...names.entries()].map(([id, name]) => ({ id, name })).sort((left, right) => left.name.localeCompare(right.name, 'ja'))
}

export function exerciseActuals(data: CanonicalAppData, exerciseId: string, period: AnalysisPeriod, nowDate = localDate(), count?: number): ExerciseActualTimeline {
  const { bucketStarts, indexes } = timelineBuckets(data, period, nowDate, count)
  const maxWeight: Array<number | undefined> = Array.from({ length: bucketStarts.length }, () => undefined)
  const reps = Array.from({ length: bucketStarts.length }, () => 0)
  const seconds = Array.from({ length: bucketStarts.length }, () => 0)
  const sets = Array.from({ length: bucketStarts.length }, () => 0)
  const sessions = Array.from({ length: bucketStarts.length }, () => 0)
  data.sessions.forEach((session) => {
    if (session.snapshot.exerciseId !== exerciseId) return
    const index = sessionBucketIndex(session, period, data, indexes)
    if (index === undefined) return
    sessions[index] += 1
    sets[index] += session.sets
    if (session.snapshot.measureType === 'reps') {
      reps[index] += (session.reps ?? 0) * session.sets
      if (session.weight !== undefined) maxWeight[index] = Math.max(maxWeight[index] ?? 0, session.weight)
    } else {
      seconds[index] += (session.seconds ?? 0) * session.sets
    }
  })
  return { bucketStarts, maxWeight, reps, seconds, sets, sessions }
}

function frequencyRows(data: CanonicalAppData, period: AnalysisPeriod, nowDate: string, kind: 'exercise' | 'bodyRegion', count?: number): FrequencyRow[] {
  const { indexes } = timelineBuckets(data, period, nowDate, count)
  const rows = new Map<string, FrequencyRow>()
  const add = (id: string, name: string, session: Session) => {
    const row = rows.get(id) ?? { id, name, sessions: 0, reps: 0, seconds: 0, sets: 0 }
    row.sessions += 1
    row.sets += session.sets
    if (session.snapshot.measureType === 'reps') row.reps += (session.reps ?? 0) * session.sets
    else row.seconds += (session.seconds ?? 0) * session.sets
    rows.set(id, row)
  }
  data.sessions.forEach((session) => {
    if (sessionBucketIndex(session, period, data, indexes) === undefined) return
    if (kind === 'exercise') add(session.snapshot.exerciseId, session.snapshot.exerciseName, session)
    else bodyRegionNames(session).forEach((name) => add(name, name, session))
  })
  return [...rows.values()].sort((left, right) => right.sessions - left.sessions || left.name.localeCompare(right.name, 'ja'))
}

export function exerciseFrequency(data: CanonicalAppData, period: AnalysisPeriod, nowDate = localDate(), count?: number) {
  return frequencyRows(data, period, nowDate, 'exercise', count)
}

export function bodyRegionFrequency(data: CanonicalAppData, period: AnalysisPeriod, nowDate = localDate(), count?: number) {
  return frequencyRows(data, period, nowDate, 'bodyRegion', count)
}
