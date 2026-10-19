# Issue #28 Codex implementation / verification v1.0

2026-10-19 / RETURN TO: PMO（親分）→ QA独立評価 → Owner実機受入。

## Authority / source

- 指示: [QA最終統合 #6261368542](https://github.com/kzsakato/training-project/issues/28#issuecomment-6261368542)。Ownerから本チャットで実装GO範囲の実行・GitHub保存・Issue返却を受領。
- 仕様: training-project `release/V1.1/TEST/TEST_SPEC.md`（QA作成2026-10-19、取得版 f2831cef）、Owner報告、PMO Scope、Data/Technical/Governance返却。QA仕様自体は変更していない。
- App: `kzsakato/my-app`, base `codex/v1r11-implementation` / `943aa2aae956e7c0afa7f63f251c639a3bb68c47`。作業branch `codex/issue28-owner-fixes`。Project `kzsakato/training-project`とは別repository。
- [Step 0 source調査](https://github.com/kzsakato/training-project/issues/28#issuecomment-6261422771)を実装前に返却済み。
- 本書はCodexによる実装・ローカル検証結果。QA独立PASS、Owner受入、監査省略の決定を代行しない。独立監査は未実施。

## 変更と根拠

行番号はこの成果物と同じcommitのsource。旧値は上記baseのsourceとbefore実測。

| ID | 変更ファイル:行 / before → after | 検証・証拠 |
|---|---|---|
| 2-1 | `src/CanonicalApp.tsx:476,488`, `src/v1r11.css:4–8`: 上段にabsolute配置したstatusを種目名の同じflex行右端へ。長い名前は折返す。statusは旧12pxを維持（任意の+1ptより狭幅での可読性・収まりを優先）。 | before/after各幅のtop.png、ui.json。長い未実施名と実施済名、非重複座標を検証。判定・sort・click handler不変。 |
| 2-3 | `src/CanonicalApp.tsx:418–425,536–537`: 週分子は完了Exerciseに結び付いたEntry数、今日分子はExercise distinctだった。一覧はSession IDごと1行。その同じcompletedRowsを日・週分子に使用。 | 重複Entry6件・Session1件で旧週2/6→1/6。同Exercise複数実績、Extra、境界fixtureで今日2/2、週4/6。 |
| 2-4 | `src/CanonicalApp.tsx:505,561`: current Exercise分類のEntry完了数から、既存詳細と同じsnapshot部位のSession行数へ。Entry重複に加え分類sourceも不一致要因だった。 | 背中旧2/6・詳細1件→1/6・詳細1件。別fixtureは週4件、snapshot背中3件・胸1件、背中3/6・詳細3件。 |
| 2-5 | `src/CanonicalApp.tsx:425,603`: 週内全実績から、選択曜日に一致するSession.dateの実績へ。 | 月曜実施・火曜推奨、月曜Extra、同種目火曜実施、日跨ぎ、選択なしを確認。月曜2件/火曜2件、空選択0件。未実施recommendedDay条件不変。 |
| 3-1 | `src/CanonicalApp.tsx:721`: 追加された週メニュー/推奨曜日ブロックを除去。 | run-pending.png / run-completed.png。 |
| 3-2 | `src/CanonicalApp.tsx:662–668`: 成功文言のみ除去、失敗文言と登録handler維持。 | 未実施・実施済とも登録永続化、成功文言なし。 |
| 3-3 | `src/v1r11.css:15`: input固定90px→flexで右端へ。 | 各幅seat矩形右端とlabel右端の一致、未実施の入力・保存を確認。 |
| 3-4 | `src/TrainerPanel.tsx:125`: 説明smallのみ削除。 | 完了済Trainer管理項目で説明文なし、OFF checkbox維持。OFF処理source変更なし。 |
| 3-5 | `src/CanonicalApp.tsx:643–650,721–778`: !doneで隠していた共通フォームを実施済にも表示。別summary cardを共通フォームへ置換。 | weight/reps/seconds/sets操作・seat・今回memoをdone時disabled。履歴・戻る・取消・標準登録・OFFは利用可。共通7領域を未実施/実施済比較。TI/SettingChangeのread-backとreload、Session配列完全一致・Entry配列完全一致。 |
| 4-1 | `src/density.css:8–9`旧14px/狭幅13px → `src/v1r11.css:41–43`のcalcで15.3333px/14.3333px。数値とkgは同じb要素。 | 1pt=96/72 CSS px。旧/新computed fontをui.jsonへ保存。125.25 kgも幅確認。320pxで旧56px数値欄が不足したため、外側48px列の各4px余白を回して64pxへ。全操作ボタン44pxとgap4pxは維持。 |

Step 0ではdensity.cssを示したが、最終適用のstatus・seat・gridは後から読み込むv1r11.cssにも存在する（`src/main.tsx:5–6`）。今回そこを局所変更した。

## 計上キー・非変更境界

`src/canonical/topProjection.ts:20`は各Sessionを1行へ投影し、JSX keyはSession.id。既存一覧の実態に合わせたもので、Entry/TI/Exerciseを同じ粒度と見なしていない。

- 週窓: `src/canonical/baseline.ts:13`のSession.date >= weekStartかつ翌週開始未満。local calendar date / weekStartsOnの既存実装を維持。UTC performedAt日付へ置換していない。
- 今日分子は週内Session.date===today。週分子は全週実績。曜日選択は実施済一覧を絞るが、週全体の総数を選択曜日小計へ変更しない。
- 今日分母は推奨当日のExercise distinct、週分母は選択menuのEntry数、部位分母はcurrent Master分類Entry数のまま。分子/分母は同じ意味の割合とは限らず、Extraや複数実績で分子が分母を超え得る。今回分母の仕様変更はしていない。
- 部位詳細実績はsnapshot分類、予定Entryはcurrent Master分類の既存契約を維持。snapshotだけの部位destinationも維持。
- 実施済非表示と未実施の完了除外は既存completedEntryIdsのExercise存在判定のまま。実績sortはperformedAt降順→performedOrder降順のまま。
- 標準登録は既存updateTrainingItemを呼ぶ。標準memoは保持し当回memoを転記しない。Sessionの値・ID・snapshot・日時はすべて不変。schema/migration、import/backup/restore、membership、延期4件のsource変更なし。

## 実行と証拠

Windows / localhost:4177のcandidate専用DB `training-check-v1r11-candidate`。合成fixtureのみ。Production/旧Staging/Owner partitionへ接続・投入・deployしていない。

- `npx vitest run`: before/afterとも17 files /124 tests成功。unit-before.log / unit-after.log。既存canonical/backup/trainer/cancel等を含む。
- `npm run candidate:build`: tsc + Vite成功（build.log）。
- `ISSUE28_BEFORE=1 npx playwright test --config playwright.issue28.config.ts -g before-after`: baseの3幅計3件成功（browser-before.log）。
- `npx playwright test --config playwright.issue28.config.ts`: 修正後4シナリオ×3幅、計12件（browser-after.log）。
- Chromium desktop1024×900、touch/mobile emulation360×800/320×740、ja-JP/Asia-Tokyo、固定時刻2026-10-20。Playwright1.64.1、Chromium156.0.8078.4、Node/npm環境。ローカル依存はnpm install --ignore-scripts --package-lock=falseで解決（Vite7.3.7、React19.3.1、TS5.9.3、Vitest3.2.7）。既存lockfileは変更していないため、lock固定CI実行とは区別する。
- `before/`・`after/`: top/run未実施/run実施済PNG、computed fontと矩形JSON。`after/*-standard-readback.json`は合成データの登録前後全体、`*-counts.json`と`*-week-zero.json`は期待値とassert済み結果、`*-large-weight.*`は3桁小数の証拠。
- 初回停止も保存: browser-after-attempt1.log（テストが既存降順を逆に想定／baseline alignmentの誤判定）、attempt2.log（textareaのlabel完全一致locatorが取得不可）。テストのみ修正し、sortやstatus fontは変えていない。browser-edge-attempt1.logでは実際の320px/125.25kgのはみ出しを検出しCSSを修正。

## 未確認・次担当

Owner Android Brave実機MANは未実施。PC Chromiumとmobile emulationをAndroid実機成功と混同しない。特に端末のフォント・拡大率、3桁小数重量、長い種目名、標準設定登録の実機受入をOwner/QAへ依頼する。時間型runの新規ブラウザシナリオ、全既存E2E、実画面Import/Export/Backup/Restoreは今回未実行（該当処理の変更なし、既存unitは実行）。重複データの整理や仕様拡張は行っていない。

次担当QAへの伝達文: 「Issue #28対象10件のCodex実装・before/after証拠を提出します。本書・ログ・read-back差分をQA TEST_SPECに照合し独立評価をお願いします。Android Brave実機は未実施としてOwner MANへ引き継いでください。PMOは監査方針・最終受入を別途管理してください。」
