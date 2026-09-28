import type { Session } from './types'

const dateText = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

/** 直近14日を、Session snapshotのExercise意味だけから表示する。 */
export function exerciseHistory(sessions: Session[], exerciseId: string, today = new Date()): string {
  const dates = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today)
    date.setDate(date.getDate() - (13 - index))
    return date
  })
  return dates.map((date, index) => `${index > 0 && date.getDay() === 1 ? '｜' : ''}${sessions.some(session => session.snapshot.exerciseId === exerciseId && session.date === dateText(date)) ? '●' : '○'}`).join('')
}
