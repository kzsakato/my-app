import { expect, it } from 'vitest'
import { itemValidationMessages } from './itemValidation'

it('maps item and setting snapshot errors without exposing paths, indices or internal messages', () => {
  const issues = [
    { path: 'trainingItems[27].reps', message: 'internal reps' },
    { path: 'trainingItemSettingChanges[38].snapshot.reps', message: 'internal snapshot' },
    { path: 'trainingItems[27].seconds', message: 'internal seconds' },
    { path: 'trainingItems[27].sets', message: 'internal sets' },
  ]
  const before = structuredClone(issues)
  expect(itemValidationMessages(issues)).toEqual(['回数：入力値を確認してください。', '時間（秒）：入力値を確認してください。', 'セット数：入力値を確認してください。'])
  expect(issues).toEqual(before)
})

it('unknown or misleading paths fail closed to a safe generic form error', () => {
  expect(itemValidationMessages([
    { path: 'unknown[999].reps', message: 'secret canonical path' },
    { path: 'trainingItems[1].newField', message: 'schema implementation' },
  ])).toEqual(['保存できません。入力内容を確認してください。'])
})
