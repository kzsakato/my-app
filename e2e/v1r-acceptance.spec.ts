import { expect, test, type Page } from '@playwright/test'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { canonicalData, seedCanonicalAndReload, readCanonicalState, readStoredState } from './helpers/state'

// Acceptance authority: Step5 Freeze / Step3 Pairing / DATA_SPEC §10.8–10.9.
const instant = new Date('2026-10-03T12:00:00+09:00')
async function settings(page: Page) { await page.getByRole('button', { name: '共通メニュー' }).click(); await page.getByRole('button', { name: '設定', exact: true }).click() }
async function top(page: Page) { await page.getByRole('button', { name: '共通メニュー' }).click(); await page.getByRole('button', { name: '実施メニュー', exact: true }).click() }
async function open(page: Page, name: string) { await settings(page); await page.getByRole('button', { name: new RegExp(`^${name} `) }).click() }
async function run(page: Page) { await page.getByRole('button', { name: /^胸 / }).click(); await page.getByRole('button', { name: /^正規テストプレス / }).first().click() }
function session(id: string, date: string, order = 0, weight = 27) {
  return { id, trainingItemId: 'canonical-item', date, performedAt: `${date}T12:00:00+09:00`, performedOrder: order, weight, reps: 8, sets: 2, seat: 'actual-seat', snapshot: { exerciseId: 'canonical-exercise', exerciseName: '記録時の名称', trainingItemDisplayName: '正規テストプレス', measureType: 'reps', weightMode: 'total', classifications: [{ kind: 'bodyRegion', label: '胸' }] } }
}
async function injectWriteFailure(page: Page) {
  await page.evaluate(() => { const put = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (...args) { if (this.name === 'canonical') { IDBObjectStore.prototype.put = put; throw new Error('injected persistence failure') } return put.apply(this, args) } })
}

test('OIC-003/006/007: previous actual order, Session-only seat, controls, persist failure/retry/reload preserve identity', async ({ page }) => {
  await page.clock.install({ time: instant }); await page.clock.setFixedTime(instant)
  const data = canonicalData(); data.sessions = [session('z-older', '2026-09-26', 0, 99), session('a-later', '2026-09-26', 1, 27)]
  await seedCanonicalAndReload(page, data)
  const legacy = await readStoredState(page)
  await run(page)
  await expect(page.getByRole('region', { name: '前回実績' })).toContainText('27 kg × 8 回')
  await page.getByRole('button', { name: '重量を1kg減らす' }).click()
  await expect(page.getByText('19.00 kg', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '重量を0.25kg減らす' }).click()
  await page.getByRole('button', { name: '重量を0.25kg増やす' }).click()
  await page.getByRole('button', { name: '重量を1kg増やす' }).click()
  await page.getByLabel('シート位置').fill('session-only')
  await injectWriteFailure(page)
  await page.getByRole('button', { name: '種目を完了' }).click()
  await expect(page.getByRole('status')).toContainText('保存できませんでした')
  expect(await readCanonicalState(page)).toEqual(data)
  await page.clock.setFixedTime(new Date('2026-10-03T13:00:00+09:00'))
  await page.getByRole('button', { name: '種目を完了' }).click()
  const saved = await readCanonicalState(page)
  const sessions = saved.sessions as ReturnType<typeof session>[]
  expect(sessions).toHaveLength(3)
  expect(sessions[2]).toMatchObject({ date: '2026-10-03', performedAt: instant.toISOString(), performedOrder: 0, seat: 'session-only' })
  expect(saved.trainingItems).toEqual(data.trainingItems)
  expect(saved.trainingItemSettingChanges).toEqual(data.trainingItemSettingChanges)
  expect(await readStoredState(page)).toEqual(legacy)
  await page.reload()
  expect((await readCanonicalState(page)).sessions).toEqual(sessions)
  await page.getByRole('button', { name: /^胸 / }).click()
  await page.getByLabel('実施済も表示').check()
  await page.getByRole('button', { name: /^正規テストプレス / }).first().click()
  await expect(page.getByRole('region', { name: '当該実績' })).toContainText('session-only')
  await expect(page.getByLabel('シート位置')).toHaveValue('session-only')
  await expect(page.getByText('やり残し')).toHaveCount(0)
})

test('OIC-006: same Clock completions allocate distinct order and shuffled offset-equivalent actuals select correctly', async ({ page }) => {
  await page.clock.install({ time: instant }); await page.clock.setFixedTime(instant)
  const data = canonicalData(); const earlier = session('z', '2026-09-26', 0, 99); const later = session('a', '2026-09-26', 1, 28); later.performedAt = '2026-09-26T03:00:00Z'; data.sessions = [later, earlier]
  await seedCanonicalAndReload(page, data)
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: '＋ 追加トレーニングを登録' }).click()
    await page.getByRole('button', { name: /正規テストプレス/ }).click()
    if (i === 0) await expect(page.getByRole('region', { name: '前回実績' })).toContainText('28 kg')
    await page.getByRole('button', { name: '種目を完了' }).dblclick()
  }
  const added = (await readCanonicalState(page)).sessions as ReturnType<typeof session>[]
  expect(added.slice(2).map(value => value.performedOrder)).toEqual([0, 1])
  expect(added.slice(2).map(value => value.performedAt)).toEqual([instant.toISOString(), instant.toISOString()])
  expect(new Set(added.map(value => value.id)).size).toBe(4)
})

test('OIC-008/009/010/012: temporary weekday filter, distinct today including Extra, actual-date visibility, two-line execution lists', async ({ page }) => {
  await page.clock.install({ time: instant }); await page.clock.setFixedTime(instant)
  const data = canonicalData(); data.sessions = [session('extra-1', '2026-10-03'), session('extra-2', '2026-10-03', 1)]
  const entries = data.menuEntries as Record<string, unknown>[]; entries[0].recommendedDay = 5; entries[1].recommendedDay = 5
  await seedCanonicalAndReload(page, data)
  await expect(page.getByText('今日の実施総数')).toContainText('1/1')
  await page.getByRole('button', { name: '推奨曜日', exact: true }).click()
  await expect(page.getByRole('button', { name: /表示する推奨曜日: 土/ })).toBeVisible()
  await page.getByLabel('実施済も表示').check()
  const rows = page.locator('.item-density')
  await expect(rows).toHaveCount(4)
  await expect(rows.first()).not.toContainText('kg')
  await expect(rows.first().locator('.item-detail-line')).toHaveCount(1)
  await page.getByRole('button', { name: /表示する推奨曜日:/ }).click()
  await page.getByRole('checkbox', { name: '月', exact: true }).check()
  await page.getByRole('checkbox', { name: '土', exact: true }).uncheck()
  await expect(rows).toHaveCount(0)
  await expect(page.getByText('今日の実施総数')).toContainText('1/1')
  expect(await readCanonicalState(page)).toEqual(data)
  await page.reload()
  await page.getByRole('button', { name: '推奨曜日', exact: true }).click()
  await expect(page.getByRole('button', { name: /表示する推奨曜日: 土/ })).toBeVisible()
})

test('OIC-002: Menu add/remove confirmations and unsaved back have zero canonical writes', async ({ page }) => {
  await seedCanonicalAndReload(page, canonicalData())
  const before = await readCanonicalState(page)
  await open(page, '週メニュー')
  await page.getByRole('button', { name: /^正規E2Eメニュー/ }).click()
  page.once('dialog', d => d.dismiss()); await page.getByRole('button', { name: '外す', exact: true }).first().click()
  await expect(page.getByRole('button', { name: '外す', exact: true })).toHaveCount(2)
  page.once('dialog', d => d.dismiss()); await page.getByRole('button', { name: '追加', exact: true }).click()
  await expect(page.getByRole('button', { name: '外す', exact: true })).toHaveCount(2)
  expect(await readCanonicalState(page)).toEqual(before)
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: '外す', exact: true }).first().click()
  await page.getByRole('button', { name: '‹ 戻る' }).click()
  expect(await readCanonicalState(page)).toEqual(before)
  await page.getByRole('button', { name: /^正規E2Eメニュー/ }).click()
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: '外す', exact: true }).first().click()
  await page.getByRole('button', { name: '保存', exact: true }).click()
  const after = await readCanonicalState(page)
  expect((after.menuEntries as { lifecycle: string }[]).map(value => value.lifecycle)).toEqual(['archived', 'active'])
  expect(after.sessions).toEqual(before.sessions)
})

test('OIC-013: item-scoped history deletion cancel, exact selected delete and reload never reconstruct initial/current/Session', async ({ page }) => {
  await page.clock.install({ time: instant }); await page.clock.setFixedTime(instant)
  const data = canonicalData(); data.sessions = [session('preserved', '2026-10-03')]
  const changes = data.trainingItemSettingChanges as Record<string, unknown>[]
  changes.push({ ...changes[0], id: 'change-remove', isInitial: false, changedAt: '2026-10-02T00:00:00Z', changeReason: '削除対象' })
  await seedCanonicalAndReload(page, data)
  await open(page, '設定履歴')
  await page.getByRole('combobox', { name: '実施項目', exact: true }).selectOption('canonical-item')
  await page.getByRole('button', { name: '設定履歴を見る', exact: true }).click()
  await expect(page.getByText('初回設定（削除できません）')).toBeVisible()
  await expect(page.getByRole('button', { name: '削除', exact: true })).toHaveCount(1)
  page.once('dialog', d => d.dismiss()); await page.getByRole('button', { name: '削除', exact: true }).click()
  expect(await readCanonicalState(page)).toEqual(data)
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: '削除', exact: true }).click()
  const after = await readCanonicalState(page)
  expect(after.trainingItemSettingChanges).toEqual([changes[0]])
  expect(after.trainingItems).toEqual(data.trainingItems); expect(after.sessions).toEqual(data.sessions)
  await page.reload(); expect(await readCanonicalState(page)).toEqual(after)
})

test('D-01/02: parse/error/preview/cancel, ByAI apply idempotence, inclusive export and explicit empty range', async ({ page }) => {
  await page.clock.install({ time: instant }); await page.clock.setFixedTime(instant); await seedCanonicalAndReload(page, { ...canonicalData(), sessions: [session('export-one', '2026-10-03')] })
  const before = await readCanonicalState(page)
  await open(page, 'トレーナー連携')
  const file = page.getByLabel('提案ファイルを選択')
  await file.setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{') })
  await expect(page.getByRole('heading', { name: '投入できません' })).toBeVisible()
  await expect(page.getByRole('button', { name: '新しい週メニューを作成' })).toHaveCount(0)
  const proposal = { contractVersion: '1.0', proposalId: 'v1r-one', menu: { name: 'Owner確認候補' }, entries: [{ trainingItemId: 'canonical-item', recommendedDay: 5, order: 0 }] }
  const upload = () => file.setInputFiles({ name: 'proposal.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(proposal)) })
  await upload(); await expect(page.getByText('Owner確認候補 (ByAI)', { exact: true })).toBeVisible()
  page.once('dialog', d => d.dismiss()); await page.getByRole('button', { name: '新しい週メニューを作成' }).click()
  expect(await readCanonicalState(page)).toEqual(before)
  await injectWriteFailure(page)
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: '新しい週メニューを作成' }).click()
  await expect(page.getByText(/投入に失敗しました/)).toBeVisible()
  expect(await readCanonicalState(page)).toEqual(before)
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: '新しい週メニューを作成' }).dblclick()
  await expect(page.getByRole('heading', { name: 'メニューを作成しました' })).toBeVisible()
  const applied = await readCanonicalState(page)
  expect((applied.menus as { name: string }[]).map(value => value.name)).toEqual(['正規E2Eメニュー', 'Owner確認候補 (ByAI)'])
  expect(applied.activeMenuId).toBe(before.activeMenuId); expect(applied.trainingItems).toEqual(before.trainingItems); expect(applied.sessions).toEqual(before.sessions)
  await upload(); await expect(page.getByRole('heading', { name: '投入できません' })).toBeVisible()
  expect(await readCanonicalState(page)).toEqual(applied)
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'JSONを出力' }).click()
  const payload = JSON.parse(await readFile((await (await download).path())!, 'utf8'))
  expect(payload.range).toEqual({ kind: 'range', fromDate: '2026-10-03', toDate: '2026-10-03', inclusive: true }); expect(payload.sessions).toEqual(before.sessions)
  expect(payload.format).toBeUndefined(); expect(await readCanonicalState(page)).toEqual(applied)
  await page.getByLabel('開始日').fill('2026-10-04'); await page.getByLabel('終了日').fill('2026-10-04')
  await expect(page.getByText('対象期間に履歴がありません。0件')).toBeVisible(); await expect(page.getByRole('button', { name: 'JSONを出力' })).toBeDisabled()
})

test('D-03/OIC-016: baseline settings/list/edit/custom required label and hide/show preserve IDs', async ({ page }) => {
  const data = canonicalData(); (data.exercises as Record<string, unknown>[])[0].classifications = [{ kind: 'bodyRegion', label: '前腕（補助）' }]
  await seedCanonicalAndReload(page, data)
  await settings(page)
  await expect(page.getByLabel('ビルド識別子')).toHaveText(/^Build /)
  await expect(page.getByRole('button', { name: /^カテゴリ / })).toHaveCount(0)
  await page.getByRole('button', { name: /^種目 / }).click()
  await page.getByRole('button', { name: /^正規テストプレス / }).click()
  await expect(page.getByRole('combobox', { name: '部位', exact: true })).toHaveValue('custom')
  await expect(page.getByLabel('カスタム部位')).toHaveValue('前腕（補助）')
  await page.getByLabel('カスタム部位').fill('   '); await expect(page.getByRole('button', { name: '保存', exact: true })).toBeDisabled()
  await page.getByLabel('カスタム部位').fill('前腕（補助）'); await page.getByRole('button', { name: '保存', exact: true }).click()
  expect((await readCanonicalState(page)).exercises).toEqual(data.exercises)
  await page.getByRole('button', { name: '＋ 種目を登録' }).click()
  await page.getByLabel('種目名').fill('カスタム追加')
  await expect(page.getByRole('button', { name: '種目だけ保存' })).toBeDisabled()
  const select = page.getByRole('combobox', { name: '部位', exact: true })
  await expect(select.locator('option')).toHaveText(['選択してください', '胸', '肩', '腕', '背中', '体幹', '下半身', 'その他 / カスタム'])
  await select.selectOption('custom'); await page.getByLabel('カスタム部位').fill('運動群'); await page.getByRole('button', { name: '種目だけ保存' }).click()
  await page.getByRole('button', { name: /^カスタム追加 / }).click()
  page.once('dialog', d => d.dismiss()); await page.getByRole('button', { name: 'この種目を非表示にする' }).click()
  await expect(page.getByLabel('種目名')).toHaveValue('カスタム追加')
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'この種目を非表示にする' }).click()
  await page.getByLabel('非表示データを表示').check(); await page.getByRole('button', { name: /^カスタム追加 / }).click(); await page.getByRole('button', { name: '再表示する' }).click()
  await page.reload(); expect((await readCanonicalState(page)).exercises).toHaveLength(2)
})

test('OIC-011 / PRESERVE: full screen population back/menu, Profile and Analysis original controls including half-year', async ({ page }, info) => {
  await page.clock.install({ time: instant }); await page.clock.setFixedTime(instant); await seedCanonicalAndReload(page, { ...canonicalData(), sessions: [session('one', '2026-10-03')] })
  const root = info.outputPath('population'); await mkdir(root, { recursive: true })
  const inventory: unknown[] = []
  const record = async (id: string) => { await page.evaluate(async () => document.fonts.ready); inventory.push({ id, text: await page.locator('main').innerText(), controls: await page.locator('button,input,select,textarea').evaluateAll(nodes => nodes.map(node => ({ tag: node.tagName, text: node.textContent, label: node.getAttribute('aria-label') }))) }); await expect(page.getByRole('button', { name: '共通メニュー' })).toBeVisible(); await expect(page.locator('nav')).toHaveCount(0); await page.screenshot({ path: `${root}/${id}.png`, fullPage: true, animations: 'disabled' }) }
  await record('top'); await page.getByRole('button', { name: /^胸 / }).click(); await record('category'); await page.getByLabel('実施済も表示').check(); await page.getByRole('button', { name: /^正規テストプレス / }).first().click(); await record('run-completed'); await page.getByRole('button', { name: /この実施項目の設定履歴を見る/ }).click(); await record('history-from-run')
  for (const name of ['プロフィール', '種目', '実施項目', '週メニュー', '設定履歴', '分析', 'データ管理', 'トレーナー連携']) {
    await open(page, name); await record(name)
    if (name === '分析') {
      await expect(page.getByRole('combobox', { name: '集計', exact: true }).locator('option')).toHaveText(['実施総重量', '総トレーニング負荷（参考）'])
      await expect(page.getByRole('combobox', { name: '期間', exact: true }).locator('option')).toHaveText(['週', '月', '四半期', '半年', '年'])
      await page.getByRole('combobox', { name: '表示', exact: true }).selectOption('detail'); await page.getByRole('combobox', { name: '内訳', exact: true }).selectOption('exercise'); await expect(page.getByRole('img', { name: 'トレーニング推移グラフ' })).toBeVisible(); await expect(page.getByText('● 記録時の名称')).toBeVisible()
    }
    if (['種目', '実施項目', '週メニュー'].includes(name)) { await page.getByRole('button', { name: name === '週メニュー' ? /^正規E2Eメニュー/ : /^正規テストプレス / }).click(); await record(`${name}-edit`); await page.getByRole('button', { name: '‹ 戻る' }).click(); await expect(page.getByRole('heading', { name, exact: true })).toBeVisible() }
  }
  await top(page); await page.getByRole('button', { name: '＋ 追加トレーニングを登録' }).click(); await record('extra-list'); await expect(page.getByRole('combobox', { name: 'カテゴリ', exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: /正規テストプレス/ })).toContainText('20 kg × 10 回 × 3 セット')
  await writeFile(`${root}/inventory.json`, JSON.stringify(inventory, null, 2))
})

for (const boundary of ['2026-10-04T23:59:59+09:00', '2026-10-05T00:00:00+09:00', '2026-12-31T23:59:59+09:00', '2027-01-01T00:00:00+09:00', '2026-10-31T23:59:59+09:00', '2026-11-01T00:00:00+09:00']) {
  test(`Clock local midnight/week/month/year boundary ${boundary}`, async ({ page }) => {
    const before = new Date('2026-10-03T23:59:59+09:00'); await page.clock.install({ time: before }); await page.clock.setFixedTime(before)
    const data = canonicalData(); data.sessions = [session('fact', '2026-10-03')]
    await seedCanonicalAndReload(page, data); await expect(page.getByText('今日の実施総数')).toContainText('1/0')
    await page.clock.setFixedTime(new Date(boundary)); await page.reload(); await expect(page.getByText('今日の実施総数')).toContainText('0/')
    expect(await readCanonicalState(page)).toEqual(data)
    const expected = boundary.startsWith('2026-10-04') ? '2/2' : '0/2'
    await expect(page.getByText('今週の実施総数')).toContainText(expected)
  })
}

test('OIC-015: all seven week starts warn/cancel, persist exact setting without rewriting historical facts', async ({ page }) => {
  await page.clock.install({ time: instant }); await page.clock.setFixedTime(instant); const data = canonicalData(); data.sessions = [session('fact', '2026-09-27')]; await seedCanonicalAndReload(page, data)
  await open(page, 'プロフィール')
  const select = page.getByRole('combobox', { name: '週開始曜日', exact: true })
  page.once('dialog', d => d.dismiss()); await select.selectOption('6'); expect(await readCanonicalState(page)).toEqual(data)
  for (const day of [1, 2, 3, 4, 5, 6, 0]) {
    page.once('dialog', d => { expect(d.message()).toContain('過去を含む週集計'); d.accept() }); await select.selectOption(String(day))
    const saved = await readCanonicalState(page); expect(saved.weekStartsOn).toBe(day); expect(saved.sessions).toEqual(data.sessions); expect(saved.trainingItems).toEqual(data.trainingItems)
  }
  await page.reload(); expect(await readCanonicalState(page)).toEqual(data)
})

test('canonical write read-back failure prevents stale editing; reload preserves original logical Session pair', async ({ page }) => {
  await page.clock.install({ time: instant }); await page.clock.setFixedTime(instant); await seedCanonicalAndReload(page, canonicalData()); await run(page)
  await page.evaluate(() => { const get = IDBObjectStore.prototype.get; IDBObjectStore.prototype.get = function (...args) { if (this.name === 'canonical') { IDBObjectStore.prototype.get = get; throw new Error('injected read-back failure') } return get.apply(this, args) } })
  await page.getByRole('button', { name: '種目を完了' }).click()
  await expect(page.getByRole('alert')).toContainText('通常編集へ戻れません')
  await expect(page.getByRole('button', { name: '種目を完了' })).toHaveCount(0)
  const saved = await readCanonicalState(page); expect(saved.sessions).toHaveLength(1)
  await page.getByRole('button', { name: '保存状態を再読込' }).click(); expect(await readCanonicalState(page)).toEqual(saved)
})

test('H-09 startup/Restore reject unsupported old canonical without repair, Session drop or legacy fallback', async ({ page }) => {
  await page.clock.install({ time: instant }); await page.clock.setFixedTime(instant)
  const current = { ...canonicalData(), sessions: [session('fact', '2026-10-03')] }
  const old = structuredClone(current); delete (old.sessions[0] as Record<string, unknown>).performedOrder
  await seedCanonicalAndReload(page, old)
  await expect(page.getByText(/正規データを読み込めません/)).toBeVisible()
  expect(await readCanonicalState(page)).toEqual(old)
  await page.reload(); expect(await readCanonicalState(page)).toEqual(old)
  // Recover by an explicit valid Backup; no old pair is guessed.
  await page.getByLabel('正規バックアップを選択').setInputFiles({ name: 'current.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'training-check-backup', schemaVersion: 1, createdAt: instant.toISOString(), payload: current })) })
  await expect(page.getByRole('heading', { name: '今週の実施メニュー' })).toBeVisible()
  expect(await readCanonicalState(page)).toEqual(current)
  await open(page, 'データ管理')
  await page.getByLabel('正規バックアップを選択').setInputFiles({ name: 'old.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'training-check-backup', schemaVersion: 1, createdAt: instant.toISOString(), payload: old })) })
  await expect(page.getByRole('heading', { name: '復元できません' })).toBeVisible()
  expect(await readCanonicalState(page)).toEqual(current)
})

test('PRESERVE Profile all fields and standard-setting failure/retry create exactly one event', async ({ page }) => {
  await page.clock.install({ time: instant }); await page.clock.setFixedTime(instant); await seedCanonicalAndReload(page, canonicalData())
  await open(page, 'プロフィール')
  await page.getByRole('spinbutton', { name: /体重/ }).fill('67.5'); await page.getByLabel('身長（cm）').fill('171'); await page.getByLabel('年齢').fill('42'); await page.getByLabel('性別').fill('male')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  expect((await readCanonicalState(page)).profile).toEqual({ weight: 67.5, height: 171, age: 42, sex: 'male' })
  await open(page, '実施項目'); await page.getByRole('button', { name: /^正規テストプレス / }).click()
  await page.getByLabel('回数', { exact: true }).fill('12'); await page.getByLabel('変更理由（任意）').fill('更新確認')
  const before = await readCanonicalState(page)
  await injectWriteFailure(page); await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('保存に失敗しました'); expect(await readCanonicalState(page)).toEqual(before)
  await page.getByRole('button', { name: '保存', exact: true }).dblclick()
  const after = await readCanonicalState(page); expect(after.trainingItemSettingChanges).toHaveLength(2); expect((after.trainingItems as { reps: number }[])[0].reps).toBe(12)
  await page.reload(); expect(await readCanonicalState(page)).toEqual(after)
})

test('D-01 Warning requires acknowledgment and rollback uncertainty blocks edits until reload', async ({ page }) => {
  await page.clock.install({ time: instant }); await page.clock.setFixedTime(instant); await seedCanonicalAndReload(page, canonicalData()); await open(page, 'トレーナー連携')
  await page.getByLabel('提案ファイルを選択').setInputFiles({ name: 'warning.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ contractVersion: '1.0', proposalId: 'warning', menu: { name: '正規E2Eメニュー' }, entries: [{ trainingItemId: 'canonical-item', order: 0 }] })) })
  await expect(page.getByRole('heading', { name: '確認が必要な項目' })).toBeVisible()
  await expect(page.getByRole('button', { name: '新しい週メニューを作成' })).toBeDisabled()
  await page.getByLabel('内容を確認しました').check()
  const before = await readCanonicalState(page)
  await page.evaluate(() => {
    const get = IDBObjectStore.prototype.get, put = IDBObjectStore.prototype.put
    let candidatePersisted = false
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'canonical') {
        if (candidatePersisted) { IDBObjectStore.prototype.put = put; throw new Error('injected rollback write failure') }
        candidatePersisted = true
      }
      return put.apply(this, args)
    }
    IDBObjectStore.prototype.get = function (...args) { if (this.name === 'canonical') { IDBObjectStore.prototype.get = get; throw new Error('injected candidate read failure') } return get.apply(this, args) }
  })
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: '新しい週メニューを作成' }).click()
  await expect(page.getByRole('alert')).toContainText('通常編集へ戻れません')
  await expect(page.getByRole('heading', { name: 'メニューを作成しました' })).toHaveCount(0)
  const saved = await readCanonicalState(page); expect(saved.menus).toHaveLength(2); expect(saved.activeMenuId).toBe(before.activeMenuId)
  await page.getByRole('button', { name: '保存状態を再読込' }).click(); expect(await readCanonicalState(page)).toEqual(saved)
})

test('OIC-015 Analysis weekly rebuckets and month/quarter/half/year remain unchanged after week-setting change', async ({ page }) => {
  await page.clock.install({ time: instant }); await page.clock.setFixedTime(instant)
  const data = { ...canonicalData(), sessions: [session('Sunday', '2026-09-27')] }; await seedCanonicalAndReload(page, data)
  const graph = async (period: string) => { await open(page, '分析'); await page.getByRole('combobox', { name: '期間', exact: true }).selectOption(period); return page.locator('polyline').getAttribute('points') }
  const weekly = await graph('week'); const unchanged = new Map<string, string | null>()
  for (const period of ['month', 'quarter', 'half', 'year']) unchanged.set(period, await graph(period))
  await open(page, 'プロフィール'); page.once('dialog', d => d.accept()); await page.getByRole('combobox', { name: '週開始曜日', exact: true }).selectOption('6')
  expect(await graph('week')).not.toBe(weekly)
  for (const period of ['month', 'quarter', 'half', 'year']) expect(await graph(period)).toBe(unchanged.get(period))
  expect((await readCanonicalState(page)).sessions).toEqual(data.sessions)
})

test('PRESERVE time Exercise → Item setup → Run slots → Extra completion and load snapshot', async ({ page }) => {
  await page.clock.install({ time: instant }); await page.clock.setFixedTime(instant); await seedCanonicalAndReload(page, canonicalData())
  await open(page, '種目'); await page.getByRole('button', { name: '＋ 種目を登録' }).click(); await page.getByLabel('種目名').fill('時間型プランク')
  await page.getByRole('combobox', { name: '部位', exact: true }).selectOption('体幹'); await page.getByRole('combobox', { name: '計測方法', exact: true }).selectOption('time')
  await page.getByRole('spinbutton', { name: /秒間負荷係数/ }).fill('10'); await page.getByRole('button', { name: '保存して実施項目を設定' }).click()
  await page.getByLabel('時間（秒）').fill('30'); await page.getByLabel('セット数', { exact: true }).fill('3'); await page.getByRole('button', { name: '保存', exact: true }).click()
  const before = await readCanonicalState(page)
  await top(page); await page.getByRole('button', { name: '＋ 追加トレーニングを登録' }).click(); await page.getByRole('button', { name: /時間型プランク/ }).click()
  await expect(page.locator('.weight-controls')).toHaveCount(0); await expect(page.getByRole('region', { name: '前回実績' })).toContainText('実施記録はありません')
  await page.getByRole('button', { name: '時間を増やす' }).click(); await page.getByRole('button', { name: 'セット数を増やす' }).click(); await page.getByRole('button', { name: '種目を完了' }).click()
  const after = await readCanonicalState(page); expect((after.sessions as Record<string, unknown>[])[0]).toMatchObject({ seconds: 40, sets: 4, bodyWeight: 66, snapshot: { measureType: 'time', secondsLoadRatio: 10 } }); expect(after.trainingItems).toEqual(before.trainingItems)
  await expect(page.getByText('1,056 pt', { exact: true })).toBeVisible(); await page.reload(); expect(await readCanonicalState(page)).toEqual(after)
})

test('PRESERVE list filter/hidden state, Item hide/show, Menu active guard/confirmation and unsaved cancel', async ({ page }) => {
  await seedCanonicalAndReload(page, canonicalData()); const original = await readCanonicalState(page)
  await open(page, '実施項目'); await page.getByRole('combobox', { name: 'カテゴリ', exact: true }).selectOption('胸'); await page.getByRole('button', { name: /^正規テストプレス / }).click()
  page.once('dialog', d => d.dismiss()); await page.getByRole('button', { name: 'この実施項目を非表示にする' }).click(); expect(await readCanonicalState(page)).toEqual(original)
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'この実施項目を非表示にする' }).click()
  await expect(page.getByRole('combobox', { name: 'カテゴリ', exact: true })).toHaveValue('胸'); await page.getByLabel('非表示データを表示').check(); await page.getByRole('button', { name: /^正規テストプレス / }).click(); await page.getByRole('button', { name: '‹ 戻る' }).click(); await expect(page.getByLabel('非表示データを表示')).toBeChecked()
  await open(page, '分析'); await open(page, '実施項目'); await expect(page.getByLabel('非表示データを表示')).toBeChecked(); await expect(page.getByRole('combobox', { name: 'カテゴリ', exact: true })).toHaveValue('胸')
  await page.getByRole('button', { name: /^正規テストプレス / }).click(); await page.getByRole('button', { name: '再表示する' }).click(); expect(await readCanonicalState(page)).toEqual(original)
  await open(page, '週メニュー'); await page.getByRole('button', { name: /^正規E2Eメニュー/ }).click(); await expect(page.getByRole('button', { name: '使用中の週メニューは非表示にできません' })).toBeDisabled()
  await page.getByRole('button', { name: '‹ 戻る' }).click(); await page.getByRole('button', { name: '＋ 週メニューを登録' }).click(); await page.getByLabel('週メニュー名').fill('追加メニュー'); await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.getByRole('button', { name: /^追加メニュー / }).click(); page.once('dialog', d => d.dismiss()); await page.getByRole('button', { name: 'この週メニューを非表示にする' }).click(); await expect(page.getByLabel('週メニュー名')).toHaveValue('追加メニュー')
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'この週メニューを非表示にする' }).click(); await page.getByLabel('非表示データを表示').check(); await page.getByRole('button', { name: /^追加メニュー / }).click(); await page.getByRole('button', { name: '再表示する' }).click()
  await expect(page.getByLabel('非表示データを表示')).not.toBeChecked(); expect((await readCanonicalState(page)).activeMenuId).toBe(original.activeMenuId)
})
