import { analysisBucketStart, analysisBucketStarts, referenceTrainingLoad, type AnalysisPeriod } from './analysis'
import { contributionError, contributionKeys } from './contributions'
import type { CanonicalAppData } from './types'

export function projectAnalysisV13(data: CanonicalAppData, period: AnalysisPeriod, today: string) {
  const bucketStarts = analysisBucketStarts({ nowDate: today, period, weekStartsOn: data.weekStartsOn })
  const buckets = bucketStarts.map(start => ({ start, pt: 0, regions: contributionKeys.map(() => 0), allocated: 0, unallocated: 0 }))
  const byStart = new Map(buckets.map(bucket => [bucket.start, bucket]))
  const byExercise = new Map<string, number[]>()
  const error = contributionError(data)
  if (error) return { state: 'UNAVAILABLE' as const, reason: error }
  const exercises = new Set(data.exercises.map(exercise => exercise.id))
  const entries = data.contributions!.byExerciseId
  for (const session of data.sessions) {
    if (session.date < bucketStarts[0] || session.date > today) continue
    const bucket = byStart.get(analysisBucketStart(session.date, period, data.weekStartsOn))
    if (!bucket) continue
    const exerciseId = session.snapshot.exerciseId
    const pt = referenceTrainingLoad(session)
    if (!exercises.has(exerciseId) || !Number.isFinite(pt) || !Number.isSafeInteger(session.sets) || session.sets < 0) {
      return { state: 'UNAVAILABLE' as const, reason: 'INVALID_SESSION' }
    }
    bucket.pt += pt
    if (!Object.hasOwn(entries, exerciseId)) {
      bucket.unallocated += session.sets
      continue
    }
    bucket.allocated += session.sets
    const amounts = byExercise.get(exerciseId) ?? contributionKeys.map(() => 0)
    contributionKeys.forEach((key, i) => {
      const amount = session.sets * entries[exerciseId].rates[key] / 100
      bucket.regions[i] += amount
      amounts[i] += amount
    })
    byExercise.set(exerciseId, amounts)
  }
  const regions = contributionKeys.map((_, i) => buckets.reduce((sum, bucket) => sum + bucket.regions[i], 0))
  const allocated = buckets.reduce((sum, bucket) => sum + bucket.allocated, 0)
  const unallocated = buckets.reduce((sum, bucket) => sum + bucket.unallocated, 0)
  return {
    state: 'AVAILABLE' as const, buckets, regions, allocated, unallocated, byExercise,
    total: allocated + unallocated,
    shares: allocated > 0 ? regions.map(amount => amount / allocated) : undefined,
  }
}
