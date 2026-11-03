# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: v1r-acceptance.spec.ts >> H-03 focused 1 same-day multiple Sessions retain marker until last cancellation
- Location: e2e\v1r-acceptance.spec.ts:41:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /表示する推奨曜日:/ })

```

# Page snapshot

```yaml
- main [ref=f1e3]:
  - generic [ref=f1e4]:
    - heading "今週の実施メニュー" [level=1] [ref=f1e5]
    - button "共通メニュー" [ref=f1e7]: ≡
  - combobox "週メニュー" [ref=f1e8]:
    - option "選択してください"
    - option "正規E2Eメニュー" [selected]
  - paragraph [ref=f1e9]: 2026-09-28 〜 2026-10-04
  - generic [ref=f1e10]:
    - generic [ref=f1e11]:
      - text: 今日の実施総数
      - generic [ref=f1e12]: 0/0
    - generic [ref=f1e13]:
      - text: 今週の実施総数
      - generic [ref=f1e14]: 2/2
  - generic "実施項目の表示方法" [ref=f1e15]:
    - button "部位表示" [ref=f1e16]
    - button "推奨曜日" [ref=f1e17]
  - button "＋ 追加トレーニングを登録" [ref=f1e18]
  - heading "推奨曜日の実施項目" [level=2] [ref=f1e19]
  - generic [ref=f1e20]:
    - generic [ref=f1e21]:
      - checkbox "実施済も表示" [checked] [active] [ref=f1e22]
      - text: 実施済も表示
    - generic [ref=f1e23]:
      - checkbox "Optionソート" [ref=f1e24]
      - text: Optionソート
  - 'button "曜日指定: 土 ⌄" [ref=f1e26]'
  - paragraph [ref=f1e27]: 選択した推奨曜日の項目はありません。
  - region "トレーニング負荷" [ref=f1e28]:
    - heading "トレーニング負荷" [level=2] [ref=f1e29]
    - generic [ref=f1e30]:
      - generic [ref=f1e31]: 今週の総トレーニング負荷
      - generic [ref=f1e32]: 864 pt
    - generic [ref=f1e33]:
      - generic [ref=f1e34]: 週の平均総トレーニング負荷
      - generic [ref=f1e35]: 144 pt
    - generic [ref=f1e36]:
      - generic [ref=f1e37]: ACWR（目安：0.8〜1.3）
      - generic [ref=f1e38]: データ不足
```

# Test source

```ts
  1   | import { expect, test, type Page } from '@playwright/test'
  2   | import { readFile, mkdir, writeFile } from 'node:fs/promises'
  3   | import { canonicalData, seedCanonicalAndReload, readCanonicalState, readStoredState } from './helpers/state'
  4   |
  5   | // Acceptance authority: Step5 Freeze / Step3 Pairing / DATA_SPEC §10.8–10.9.
  6   | const instant = new Date('2026-10-03T12:00:00+09:00')
  7   | async function settings(page: Page) { await page.getByRole('button', { name: '共通メニュー' }).click(); await page.getByRole('button', { name: '設定', exact: true }).click() }
  8   | async function top(page: Page) { await page.getByRole('button', { name: '共通メニュー' }).click(); await page.getByRole('button', { name: '実施メニュー', exact: true }).click() }
  9   | async function open(page: Page, name: string) { await settings(page); await page.getByRole('button', { name: new RegExp(`^${name} `) }).click() }
  10  | async function run(page: Page) { await page.getByRole('button', { name: /^胸 / }).click(); await page.getByRole('button', { name: /^正規テストプレス / }).first().click() }
  11  | function session(id: string, date: string, order = 0, weight = 27) {
  12  |   return { id, trainingItemId: 'canonical-item', date, performedAt: `${date}T12:00:00+09:00`, performedOrder: order, weight, reps: 8, sets: 2, seat: 'actual-seat', snapshot: { exerciseId: 'canonical-exercise', exerciseName: '記録時の名称', trainingItemDisplayName: '正規テストプレス', measureType: 'reps', weightMode: 'total', classifications: [{ kind: 'bodyRegion', label: '胸' }] } }
  13  | }
  14  | async function injectWriteFailure(page: Page) {
  15  |   await page.evaluate(() => { const put = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (...args) { if (this.name === 'canonical') { IDBObjectStore.prototype.put = put; throw new Error('injected persistence failure') } return put.apply(this, args) } })
  16  | }
  17  |
  18  | // H-20261004-03: independent fixed-date oracle; do not call product history helpers.
  19  | const focusedDates = ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03']
  20  | async function assertFocusedMarkers(page: Page, completedDates: string[]) {
  21  |   const expected = Object.fromEntries(focusedDates.map(date => [date, completedDates.includes(date) ? '●' : '○']))
  22  |   await expect.poll(async () => {
  23  |     const markers = (await page.locator('.item-history').first().innerText()).replaceAll('｜', '')
  24  |     expect(markers).toHaveLength(14)
  25  |     return Object.fromEntries(focusedDates.map((date, index) => [date, markers[index]]))
  26  |   }, { message: 'H-03: each fixed calendar date must have its own expected 14-day marker' }).toEqual(expected)
  27  | }
  28  | async function focusedActuals(page: Page) {
  29  |   await page.getByRole('button', { name: '推奨曜日', exact: true }).click()
  30  |   await page.getByLabel('実施済も表示').check()
> 31  |   await page.getByRole('button', { name: /表示する推奨曜日:/ }).click()
      |                                                         ^ Error: locator.click: Test timeout of 30000ms exceeded.
  32  |   for (const day of ['月', '火', '水', '木', '金', '土', '日']) await page.getByRole('checkbox', { name: day, exact: true }).check()
  33  |   await page.getByRole('button', { name: /表示する推奨曜日:/ }).click()
  34  | }
  35  |
  36  | for (const scenario of [
  37  |   { name: '1 same-day multiple Sessions retain marker until last cancellation', targets: [session('same-day-first', '2026-10-02', 0), session('same-day-last', '2026-10-02', 1)] },
  38  |   { name: '2 single Session cancellation clears its date marker', targets: [session('single-target', '2026-10-02')] },
  39  |   { name: '3 past-first consecutive cancellations change only the target date', targets: [session('Monday-target', '2026-09-28'), session('Wednesday-target', '2026-09-30'), session('Friday-target', '2026-10-02')] },
  40  | ]) {
  41  |   test(`H-03 focused ${scenario.name}`, async ({ page }, info) => {
  42  |     await page.clock.install({ time: instant }); await page.clock.setFixedTime(instant)
  43  |     const untouched = session('non-target-outside-window', '2026-09-10')
  44  |     const targets = scenario.targets.map(value => ({ ...value, snapshot: { ...value.snapshot, trainingItemDisplayName: `取消対象-${value.id}` } }))
  45  |     const data = { ...canonicalData(), sessions: [untouched, ...targets] }
  46  |     await seedCanonicalAndReload(page, data)
  47  |     const legacy = await readStoredState(page)
  48  |     await focusedActuals(page)
  49  |     let remaining = [...data.sessions]
  50  |     await assertFocusedMarkers(page, scenario.targets.map(value => value.date))
  51  |     const stages: unknown[] = [{ remaining, markers: await page.locator('.item-history').first().innerText() }]
  52  |     for (const target of targets) {
  53  |       // Actual rows carry their own Session identity; cancel oldest dates first.
  54  |       await page.locator('.item-density').filter({ hasText: `追加実施　${target.date}` }).filter({ hasText: target.snapshot.trainingItemDisplayName }).click()
  55  |       await expect(page.getByRole('region', { name: '当該実績' })).toContainText(target.date)
  56  |       page.once('dialog', dialog => dialog.accept())
  57  |       await page.getByRole('button', { name: `${Number(target.date.slice(5, 7))}/${Number(target.date.slice(8))}の実行を取り消す` }).click()
  58  |       remaining = remaining.filter(value => value.id !== target.id)
  59  |       const expected = { ...data, sessions: remaining }
  60  |       await expect.poll(() => readCanonicalState(page)).toEqual(expected)
  61  |       await expect(page.getByRole('heading', { name: '今週の実施メニュー' })).toBeVisible()
  62  |       await assertFocusedMarkers(page, remaining.map(value => value.date))
  63  |       expect(await readStoredState(page)).toEqual(legacy)
  64  |       stages.push({ cancelledId: target.id, remaining: await readCanonicalState(page), markers: await page.locator('.item-history').first().innerText() })
  65  |       await page.reload()
  66  |       expect(await readCanonicalState(page)).toEqual(expected)
  67  |       await focusedActuals(page)
  68  |       await assertFocusedMarkers(page, remaining.map(value => value.date))
  69  |     }
  70  |     await info.attach('H-03-marker-cancellation-stages', { body: JSON.stringify(stages, null, 2), contentType: 'application/json' })
  71  |   })
  72  | }
  73  |
  74  | test('H-03 focused 4/5 + H06 A5: UI Extra completion has own actual and visible completed Exercise', async ({ page }, info) => {
  75  |   await page.clock.install({ time: instant }); await page.clock.setFixedTime(instant)
  76  |   const previous = session('previous-before-extra', '2026-09-26', 0, 27)
  77  |   const data = { ...canonicalData(), sessions: [previous] }
  78  |   await seedCanonicalAndReload(page, data)
  79  |   const legacy = await readStoredState(page)
  80  |   await page.getByRole('button', { name: /^胸 / }).click()
  81  |   await assertFocusedMarkers(page, ['2026-09-26'])
  82  |   await top(page)
  83  |   await page.getByRole('button', { name: '＋ 追加トレーニングを登録' }).click()
  84  |   await page.getByRole('button', { name: /正規テストプレス/ }).click()
  85  |   await expect(page.getByRole('region', { name: '前回実績' })).toHaveCount(0)
  86  |   await page.getByRole('button', { name: '重量を1kg増やす' }).click()
  87  |   await page.getByRole('button', { name: '回数を増やす' }).click()
  88  |   await page.getByLabel('シート位置').fill('H03-extra-seat')
  89  |   await page.getByRole('button', { name: '種目を完了' }).click()
  90  |   await expect(page.getByRole('heading', { name: '今週の実施メニュー' })).toBeVisible()
  91  |   const saved = await readCanonicalState(page)
  92  |   const added = saved.sessions as ReturnType<typeof session>[]
  93  |   expect(added).toHaveLength(2)
  94  |   expect(added[0]).toEqual(previous)
  95  |   expect(added[1]).toMatchObject({ id: expect.any(String), date: '2026-10-03', performedAt: instant.toISOString(), performedOrder: 0, weight: 21, reps: 11, sets: 3, seat: 'H03-extra-seat' })
  96  |   expect(added[1].id).not.toBe(previous.id)
  97  |   expect((added[1] as typeof added[number] & { menuEntryId?: string }).menuEntryId).toBeUndefined()
  98  |   expect({ ...saved, sessions: data.sessions }).toEqual(data)
  99  |   await page.getByRole('button', { name: '推奨曜日', exact: true }).click()
  100 |   const actualRow = page.locator('.item-density').filter({ hasText: '追加実施　2026-10-03' })
  101 |   await expect(actualRow).toHaveCount(0)
  102 |   await page.getByLabel('実施済も表示').check()
  103 |   await expect(actualRow).toHaveCount(1)
  104 |   await expect(actualRow).toContainText('正規テストプレス')
  105 |   await assertFocusedMarkers(page, ['2026-09-26', '2026-10-03'])
  106 |   await page.getByRole('button', { name: 'カテゴリ表示', exact: true }).click()
  107 |   await page.getByRole('button', { name: /^胸 / }).click()
  108 |   await expect(page.getByRole('button', { name: /^正規テストプレス / })).toHaveCount(0)
  109 |   await page.getByLabel('実施済も表示').check()
  110 |   // H09: Extra owns one row; planned Entries do not borrow its actual.
  111 |   await expect(page.getByRole('button', { name: /^正規テストプレス / })).toHaveCount(1)
  112 |   await assertFocusedMarkers(page, ['2026-09-26', '2026-10-03'])
  113 |   await top(page)
  114 |   await page.getByRole('button', { name: '＋ 追加トレーニングを登録' }).click()
  115 |   await page.getByRole('button', { name: /正規テストプレス/ }).click()
  116 |   // H06 A5 supersedes the incomplete-Run panel, not the Session/order contract.
  117 |   await expect(page.getByRole('region', { name: '前回実績' })).toHaveCount(0)
  118 |   await expect(page.getByRole('button', { name: /の実行を取り消す/ })).toHaveCount(0)
  119 |   await top(page)
  120 |   await page.getByRole('button', { name: '推奨曜日', exact: true }).click()
  121 |   await page.getByLabel('実施済も表示').check()
  122 |   await actualRow.click()
  123 |   const actualPanel = page.getByRole('region', { name: '当該実績' })
  124 |   await expect(actualPanel).toContainText('2026-10-03')
  125 |   await expect(actualPanel).toContainText('21 kg × 11 回 × 3 セット')
  126 |   await expect(actualPanel).toContainText('H03-extra-seat')
  127 |   await expect(actualPanel).not.toContainText('27 kg')
  128 |   expect(await readCanonicalState(page)).toEqual(saved)
  129 |   expect(await readStoredState(page)).toEqual(legacy)
  130 |   await page.reload()
  131 |   expect(await readCanonicalState(page)).toEqual(saved)
```
