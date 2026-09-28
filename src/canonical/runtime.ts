import { createSessionSnapshot } from './operations'
import type { CanonicalAppData, Exercise, Profile, Session, TrainingItem } from './types'

export type ProfileCandidate = Pick<Profile, 'weight' | 'height' | 'age' | 'sex'>

/**
 * Stage 3 deliberately creates no Master/Menu/Session data from legacy input.
 * The profile is the only legacy-derived candidate allowed by DATA_SPEC §10.4.
 */
export function createInitialCanonicalCandidate(profile: ProfileCandidate): CanonicalAppData {
  return {
    schemaVersion: 1,
    weekStartsOn: 0,
    profile: { ...profile },
    exercises: [],
    trainingItems: [],
    menus: [],
    menuEntries: [],
    sessions: [],
    trainingItemSettingChanges: [],
    appliedProposalIds: [],
  }
}

export function localDate(now = new Date()): string {
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

export function weekStart(date: string, weekStartsOn: number): string {
  const value = new Date(`${date}T00:00:00`)
  const mondayBasedDay = (value.getDay() + 6) % 7
  const delta = (mondayBasedDay - weekStartsOn + 7) % 7
  value.setDate(value.getDate() - delta)
  return localDate(value)
}

export function createCanonicalSession(args: {
  id: string
  item: TrainingItem
  exercise: Exercise
  date: string
  weight?: number
  reps?: number
  seconds?: number
  sets: number
  bodyWeight: number
  seat?: string
  memo?: string
  menuEntryId?: string
}): Session {
  const { id, item, exercise, date, weight, reps, seconds, sets, bodyWeight, seat, memo, menuEntryId } = args
  return {
    id,
    trainingItemId: item.id,
    menuEntryId,
    date,
    weight,
    reps,
    seconds,
    sets,
    bodyWeight,
    seat,
    memo,
    snapshot: createSessionSnapshot(item, exercise),
  }
}
