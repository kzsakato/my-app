import type { BackupEnvelope, CanonicalAppData } from './types'

export const canonicalFixture: CanonicalAppData = {
  schemaVersion: 1,
  activeMenuId: 'menu-1',
  profile: { weight: 66 },
  exercises: [{
    id: 'exercise-1', lifecycle: 'active', name: 'ダンベルプレス', measureType: 'reps',
    usesWeight: true, weightMode: 'perSide', classifications: [{ kind: 'bodyRegion', label: '胸' }],
  }],
  trainingItems: [{ id: 'item-1', lifecycle: 'active', exerciseId: 'exercise-1', displayName: 'ダンベルプレス', weight: 18, reps: 15, sets: 5 }],
  menus: [{ id: 'menu-1', lifecycle: 'active', name: '通常メニュー' }],
  menuEntries: [{ id: 'entry-1', lifecycle: 'active', menuId: 'menu-1', trainingItemId: 'item-1', recommendedDay: 1, order: 0 }],
  sessions: [{
    id: 'session-1', trainingItemId: 'item-1', menuEntryId: 'entry-1', date: '2026-09-24', weight: 18, reps: 15, sets: 5, bodyWeight: 66,
    snapshot: { exerciseId: 'exercise-1', exerciseName: 'ダンベルプレス', trainingItemDisplayName: 'ダンベルプレス', measureType: 'reps', weightMode: 'perSide', classifications: [{ kind: 'bodyRegion', label: '胸' }] },
  }],
  trainingItemSettingChanges: [{ id: 'change-1', trainingItemId: 'item-1', changedAt: '2026-09-24T09:00:00+09:00', snapshot: { weight: 18, reps: 15, sets: 5 } }],
}

export const canonicalBackupFixture: BackupEnvelope = {
  format: 'training-check-backup', schemaVersion: 1, createdAt: '2026-09-24T09:00:00+09:00', payload: canonicalFixture,
}

/** Identification fixtures only. They intentionally are not canonical data. */
export const legacyV5PayloadFixture = { version: 5, exercises: [], categories: [], items: [], menus: [], menuItems: [], sessions: [], settingHistories: [], profile: {}, activeMenuId: '' }
export const legacyV6PayloadFixture = { ...legacyV5PayloadFixture, version: 6 }
export const legacyV6BackupFixture = { format: 'training-check-backup', schemaVersion: 1, createdAt: '2026-09-24T00:00:00.000Z', payload: legacyV6PayloadFixture }
