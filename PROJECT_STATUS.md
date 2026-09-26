# PROJECT_STATUS

最終更新: 2026-09-26（H-20260926-09: canonical Stage 2のlegacy baseline検証を補正、Unit／Build／E2E成功）

## 1. アプリの目的

- Android Chromeでホーム画面に追加して使う、個人用の筋トレ消化チェックPWA。
- 利用者は週メニューを消化し、実施記録・設定履歴・負荷推移を確認する。
- 現在実装している主要領域は、設定、週メニュー実行、追加トレーニング、履歴、負荷分析、JSONバックアップ／復元である。

## 2. 現在の開発状況

### 完了している機能

- React + TypeScript + Vite PWA。端末内データはIndexedDB `training-check` の `state/app` にAppData全体として保存する。
- AppData schema version 6。v6 Sessionは実行時のCore Snapshot（種目ID・表示名・計測種別・負荷係数）を保持し、分析の換算にこれを使用する。
- v5保存データは自動補正せず、復旧用JSONをダウンロードした後に明示操作で移行する。移行対象はマスタ／設定で、v5 Session／SettingHistoryは除外する。
- バックアップはversion 6のenvelope形式。復元前に形式・型・重複ID・参照を検証し、Errorは中止、Warningは確認後に全置換する。
- 種目、カテゴリ、実施項目、週メニューの登録・編集・非表示化／再表示。
- 月曜始まりの週メニュー、予定単位の完了判定、追加トレーニング、今週分の実行取消、設定登録、メモ2継続。
- 回数型／時間型、重量有無、重量係数（×1／×2）、自重換算係数、秒間負荷係数、プロフィール。
- 設定履歴、分析（実施総重量／総トレーニング負荷、週〜年、全体／カテゴリ／詳細）、JSONバックアップ／復元。
- GitHub Pages公開用のGitHub Actionsワークフロー。
- Issue #16 UI先行改修: 追加トレーニングで同一ExerciseのItemを省略せず表示、設定登録後にRun画面へ留まる、14日表示の月曜境界、実施済みへの「やり残し」非表示、今日実施数の分子を当日Session件数へ変更、追加トレーニング一覧の高密度表示試行、重量の±1kg操作追加。

### 実装中の機能

- Issue #16のAndroid実機確認およびQA確認。追加トレーニング一覧以外への高密度表示の横断適用は保留。
- canonical正式データのStage 2基盤を追加済み。専用IndexedDB store、切替marker、移行前legacy baseline、cutover／read-back／rollback、canonical backup Restore、起動時のcanonical authority分岐を実装した。通常の現行画面はlegacy v6のままで、cutoverを起動するUIおよびcanonicalデータを通常画面へ接続するUIは未実装。
- Stage 1として、legacy v5/v6の非破壊previewと、現在のactive stateとは分離したRecovery Point保存・取得を追加済み。canonical storageへの切替・legacyの自動canonical化は未着手。
- Playwright ChromiumのE0/E1 Trialを追加済み。Vitestはpure domain、Playwrightはbrowser UI・IndexedDB・日時・ファイル操作のE2Eとして分離している。

### 未着手の機能

- 実施履歴そのものの一覧・詳細閲覧。
- 設定履歴の変更前後差分表示。
- 週メニュー切替の「今週から／次週月曜から」予約。
- インターバルタイマー。
- AI連携UI、TrainingContextの履歴要約、カテゴリ／部位／分析分類の正式モデル。

## 3. 現在の作業内容

- 最後に取り組んだ課題: H-20260926-09のcanonical Stage 2。
- 完了状況: `src/canonical/cutover.ts` と `src/data.ts` に、legacy baseline保護、canonical保存・検証・rollback、明示的canonical Restore、startup authority分岐を追加した。baseline保存前にはv6の既存完全検証、またはv5の既存決定的移行検証を適用する。E2E helperはIndexedDB v7へ追従済み。`pnpm test` は30件、`pnpm build`、`pnpm test:e2e` は3件成功。
- 現在の問題: Codex実行環境は `node_modules` 読取りをEPERMで拒否するため、依存ツールの実行確認は通常PowerShellで行う必要がある。Stage 2のブラウザ固有リスク（cold boot、容量不足、途中中断、複数タブ）は未検証。v5→v6移行、v6 backup restore、Session snapshotによる分析をAndroid実機で確認していない。

## 4. 重要な設計上の決定

- 技術: TypeScript + React + Vite + vite-plugin-pwa + idb。Playストア用ネイティブアプリではない。
- 保存: AppData schema version 6。JSON Exportはenvelope内のAppData全体、Restoreは検証と利用者確認後に端末内データ全体を置換する。
- canonical Stage 2の保存は旧AppDataとは別のIndexedDB store（`canonical`、`cutover`、`baseline`）を使う。既存の`state/app`とStage 1の`recovery`は切替成功前後も削除・上書きしない。
- canonical authority後の起動失敗はlegacyへ自動フォールバックせず、明示的復旧状態で停止する。canonical cutover前の失敗ではmarkerをlegacy-activeへ戻すよう試みる。
- 関係: Exercise → Item → MenuItem（週メニュー所属）。Categoryは表示／分析のまとまり。
- 日付は端末のローカル日付、週は月曜始まり。
- 削除は完全削除でなく `archived` による非表示化。
- 分析の負荷換算はSessionのCore Snapshotを正本にする。カテゴリ／部位での分類は現行設定を参照し、履歴snapshotには保存しない。
- 今日の実施総数は、分母を当日推奨のMenuItem件数、分子をローカル日付が今日のSession件数（追加トレーニングを含む）とする。

## 5. 重要なファイル

| パス | 役割 | 現在の状態 |
|---|---|---|
| `src/App.tsx` | 画面、実行、集計、設定、分析、JSON入出力 | Issue #16のUI先行改修を実装済み。 |
| `src/domain.ts` | 正式データ型、参照検証、Migration、backup／proposal境界 | H-20260922-07で追加。UIやIndexedDBに依存しない。 |
| `src/canonical/` | canonical正式化予定のStage 0純粋domain基盤 | runtime未接続。types／validation／operations／識別fixture／Vitestテストを保持。 |
| `src/canonical/legacy.ts` | Stage 1のlegacy再作成preview | legacy payloadを構造識別し、Profile候補と参照材料件数だけを非破壊で生成する。 |
| `src/canonical/cutover.ts` | Stage 2のcanonical storage/cutover/Restore境界 | baseline保護、保存後read-back、authority marker、rollback、明示的Restore入力検証を実装済み。 |
| `src/canonical/cutover.test.ts` | Stage 2自動テスト | in-memory adapterで保存失敗、read-back不一致、runtime/restart失敗、rollback/recovery失敗を注入して検証する。 |
| `vitest.config.ts` | Stage 0自動テスト設定 | Node環境で `src/**/*.test.ts` を実行する。 |
| `playwright.config.ts` | Chromium E2E Trial設定 | ViteをE2E時だけ起動し、failure evidenceを保持する。 |
| `e2e/` | Playwright E0/E1 browser test | production hookなしでIndexedDB seed/read-backとbrowser clockを扱う。 |
| `.github/workflows/test.yml` | test CI | Vitest/build jobとChromium Playwright jobを分離する。 |
| `src/data.ts` | 初期データとIndexedDB adapter | legacy v6／v5読込に加え、DB v7のcanonical/cutover/baseline adapterとauthority起動分岐を実装済み。 |
| `src/styles.css` | 既存のスマホ優先スタイル | 今回は変更なし。 |
| `src/density.css` | UI先行改修用の追加スタイル | 追加トレーニング一覧の高密度表示試行、重量±1kg操作のスタイル。 |
| `src/main.tsx` | React起動とスタイル読込 | `density.css`を追加読込。 |
| `PROJECT_STATUS.md` | 開発再開用の状態記録 | この内容に更新済み。 |
| `training-project/handoff/H-20260925-09.md` | Playwright TrialのRole間Handoff | DONE。my-appの実装commitと検証結果を記録。 |

## 6. 動作確認

- 実行済み: 2026-09-26に通常PowerShellで `pnpm test` が30件成功、`pnpm build` が成功、`pnpm test:e2e` がChromiumで3件成功。
- 確認できたこと: Stage 2のcandidate識別・validation、legacy baselineのv6完全検証／v5決定的移行検証、baseline保存、canonical保存/read-back、runtime/restart相当read、rollback、canonical Restoreのfailure injectionをVitestで確認した。構造識別できるだけの不正v6入力はbaselineへ保存されない。E2Eはv7 IndexedDBでも既存v6画面の実施保存・週境界・backup restoreを確認した。
- 未確認: Stage 2の実ブラウザ永続化固有リスク（cold boot、quota/storage failure、interrupted transaction、multi-tab）。Android実機でのv5移行（Recovery Pointを保存後にSession／SettingHistory除外）、v6 backup restore、Session snapshot分析。Issue #16のUI先行改修も実機確認が必要。
- 既知の不具合: なし。OIC-009は当日Sessionの件数を分子にするため、同じItemを複数回完了した場合もその回数を数える。

## 7. 次にやるべきこと

1. GitHub ActionsのTest workflowの初回実行結果を確認する。失敗時はActionsログと `playwright-report` artifactを確認する。
2. 初回v6公開後、Androidでv5移行画面を確認する。復旧JSONを保存後、移行により設定を保持し、Session／SettingHistoryが除外されることを確認する。
3. v6バックアップを作成し、別端末またはテストデータで復元する。エラーは中止、警告は確認後だけ復元されることを確認する。
4. 実施完了後、Sessionにsnapshotが残り、種目設定変更後も分析換算係数がSessionの値を使うことを確認する。
5. Issue #16のUI先行改修もAndroidで確認し、QAへH-20260922-07の実装・テスト結果を返却する。
6. Stage 3のcanonical通常画面接続・cutover起動UIは、Data Design・PMOの次段階HandoffとOwner GOなしに開始しない。着手時は `src/canonical/`、`src/data.ts`、`training-project/handoff/H-20260926-09.md` を確認する。
7. Playwright Trialを正式採用・拡張するかは別判断。現時点ではChromiumのみ。UIまたは現行v6 IndexedDB構造を変更する場合、`e2e/` のfixture・selectorを更新してから `pnpm test:e2e` を実行する。
