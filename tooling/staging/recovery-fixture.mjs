// Synthetic automation data only; never an Owner payload.
export const legacy = {
  version: 6, activeMenuId: 'legacy-menu', profile: { weight: 91, height: 181, analysisStartDate: '2001-01-01' },
  exercises: [{ id: 'legacy-exercise', name: 'legacy-only exercise', bodyPart: '胸', measureType: 'reps', usesWeight: true }],
  categories: [{ id: 'legacy-category', name: 'legacy-only category', bodyParts: ['胸'], exerciseIds: ['legacy-exercise'] }],
  items: [{ id: 'legacy-item', name: 'legacy-only item', categoryId: 'legacy-category', exerciseId: 'legacy-exercise', sets: 9 }],
  menus: [{ id: 'legacy-menu', name: 'legacy-only menu' }],
  menuItems: [{ id: 'legacy-entry', menuId: 'legacy-menu', itemId: 'legacy-item', recommendedDay: 3 }],
  sessions: [{ id: 'legacy-session', itemId: 'legacy-item', date: '2026-10-01', sets: 7, snapshot: { exerciseId: 'legacy-exercise', exerciseName: 'historical legacy', trainingItemDisplayName: 'historical item', measureType: 'reps' } }],
  settingHistories: [{ id: 'legacy-history', itemId: 'legacy-item', date: '2026-10-01', sets: 8 }],
};
