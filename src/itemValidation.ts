import type { ValidationIssue } from './canonical/types'

// Presentation only: canonical paths remain unchanged and never reach the form.
const fields: Record<string, string> = {
  reps: '回数', seconds: '時間（秒）', sets: 'セット数', weight: '重量（kg）',
  seat: 'シートのピン位置', standardMemo: 'メモ1（長期用）', exerciseId: '元にする種目',
}
export function itemValidationMessages(issues: ValidationIssue[]): string[] {
  return [...new Set(issues.map(issue => {
    const match = /^(?:trainingItems\[\d+\]|trainingItemSettingChanges\[\d+\]\.snapshot)\.(reps|seconds|sets|weight|seat|standardMemo|exerciseId)$/.exec(issue.path)
    return match ? `${fields[match[1]]}：入力値を確認してください。` : '保存できません。入力内容を確認してください。'
  }))]
}
