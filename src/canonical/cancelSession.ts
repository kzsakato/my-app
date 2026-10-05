import type { CanonicalAppData } from './types'

/** A missing/deleted ID is a no-op, never a request to find another actual. */
export function cancelSession(data: CanonicalAppData, sessionId: string): CanonicalAppData {
  if (!data.sessions.some(session => session.id === sessionId)) return data
  return { ...data, sessions: data.sessions.filter(session => session.id !== sessionId) }
}
