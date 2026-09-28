# PROJECT_STATUS

最終更新: 2026-09-28（H-20260928-21: 配信版build identifier表示を追加・自動検証完了）

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
- H-20260927-04 OIC-012: 共通ヘッダー／メニュー、実施種目一覧の二行化、Exercise単位の14日実施状況、Run画面の高密度化を実装。Unit 35件、build、Chromium E2E 4件が成功。

### 実装中の機能

- Issue #16のAndroid実機確認およびQA確認。追加トレーニング一覧以外への高密度表示の横断適用は保留。
- canonical正式データのStage 2基盤を追加済み。専用IndexedDB store、切替marker、移行前legacy baseline、cutover／read-back／rollback、canonical backup Restore、起動時のcanonical authority分岐を実装した。通常の現行画面はlegacy v6のままで、cutoverを起動するUIおよびcanonicalデータを通常画面へ接続するUIは未実装。
- Stage 1として、legacy v5/v6の非破壊previewと、現在のactive stateとは分離したRecovery Point保存・取得を追加済み。canonical storageへの切替・legacyの自動canonical化は未着手。
- Playwright ChromiumのE0/E1 Trialを追加済み。Vitestはpure domain、Playwrightはbrowser UI・IndexedDB・日時・ファイル操作のE2Eとして分離している。
- canonical Stage 3を実装済み。Data Managementの明示cutover、Profile候補の明示採用、canonical専用のTop／Menu／Run／追加実施／標準設定／Session履歴、canonical authority後の明示Recoveryを追加した。legacy master/menu/session/historyを自動変換しない。受入FIXとして、実際に採用する全Profile候補の開示と、authority化前のbaseline readiness preflightを追加した。
- H-20260928-05のVer1 UI/OICをcanonical通常画面へ実装済み。複数曜日の一覧選択、実施済みSession実績表示、当回seat保存、週メニュー追加確認、設定変更理由、初回履歴保護と非初回履歴の個別削除を追加した。
- QA-H05-01を修正済み。canonical実施項目一覧の2行目に、左側の部位・推奨曜日と右端のSession snapshot基準14日履歴を追加した。
- H-20260928-07として、canonicalの「メニュー投入」と「トレーニング履歴出力」を追加した。MenuProposalはfile parse→検証→preview→Warning確認→最終確認→新規Menu/MenuEntry作成→canonical validation・persist・read-backの順で処理し、既存のactive Menuは切り替えない。Trainer Historyは期間指定または全履歴のread-only JSONであり、Backup/Restore形式ではない。
- QA-H07-01を修正済み。MenuProposal投入成功後に作成Menu名を表示し、「週メニューで内容を確認」からそのMenuを選択済みの週メニュー設定へ遷移できる。active Menuは切り替えない。
- H-20260928-14としてcanonical Ver1分析を追加した。全体／bodyRegion別のderived training-load推移、種目別の最大重量・合計回数・合計セット、種目別／bodyRegion別の実施頻度を、週・月・四半期・年の直近12区間で表示する。再集計はSession actual factsとsnapshotだけを使用し、現在のMasterやMenuEntryの有無で過去の意味を変更しない。未分類snapshotは「未分類」として保持する。
- H-20260928-17として、Android MAN準備用の限定canonical Master bootstrapを追加した。明示確認後に承認済みのペクトラルフライ（マシン）、サイドレイズ、レッグレイズと、任意のフロントプランクを新規Exercise／TrainingItemとして投入する。legacyの復元・移行や週メニュー作成は行わず、全件validation・保存後read-backに成功した場合だけ完了する。成功画面でlegacy source IDから新canonical IDへの対応表を表示する。
- H-20260928-20として、MAN用Master bootstrap成功時の構造化対応表から、既存H-07 MenuProposal contractのJSONを生成してUTF-8でダウンロードする限定helperを追加した。既存の「メニュー投入」画面で検証・Warning確認・新規Menu作成を行うため、bootstrap自体やactive Menuを変更しない。
- H-20260928-21として、canonicalの「正規データの設定」画面末尾にbuild identifierを表示する。GitHub Pages buildではtrigger commitの先頭8桁SHAとbuild日をVite defineで埋め込み、local/devは`local`を表示する。

### 未着手の機能

- 実施履歴そのものの一覧・詳細閲覧。
- 設定履歴の変更前後差分表示。
- 週メニュー切替の「今週から／次週月曜から」予約。
- インターバルタイマー。
- AI連携UI、TrainingContextの履歴要約、カテゴリ／部位／分析分類の正式モデル。

## 3. 現在の作業内容

- 最後に取り組んだ課題: H-20260928-21（Android MAN前の配信版識別子表示）。
- 完了状況: root `main` を `git fetch` / `git pull --ff-only` で最新化後、Data Managementから明示的に初期canonical candidateを作りcutoverできるようにした。candidateには明示確認済みProfileだけを採用し、legacyのmaster/menu/session/historyは移さない。authority後はcanonicalだけを保存・参照する通常画面（Top、Menu、Run、追加実施、標準設定、履歴）へ接続した。Profileの体重・身長・年齢・性別は採用前に全て表示し、切替前にlegacy source検証とimmutable baseline保存/read-backだけを実行するpreflightを追加した。Unit 39件、PWA build、Chromium E2E 6件が成功。
- 現在の問題: canonical Stage 3、H-20260928-05、H-20260928-07、H-20260928-14のAndroid実機でのcutover、通常トレーニング、設定変更履歴、Recovery、JSON file download/upload、分析表示は未確認。Stage 2のブラウザ固有リスク（cold boot、容量不足、途中中断、複数タブ）も未検証。

## 4. 重要な設計上の決定

- 技術: TypeScript + React + Vite + vite-plugin-pwa + idb。Playストア用ネイティブアプリではない。
- 保存: AppData schema version 6。JSON Exportはenvelope内のAppData全体、Restoreは検証と利用者確認後に端末内データ全体を置換する。
- canonical Stage 2の保存は旧AppDataとは別のIndexedDB store（`canonical`、`cutover`、`baseline`）を使う。既存の`state/app`とStage 1の`recovery`は切替成功前後も削除・上書きしない。
- canonical authority後の起動失敗はlegacyへ自動フォールバックせず、明示的復旧状態で停止する。canonical cutover前の失敗ではmarkerをlegacy-activeへ戻すよう試みる。
- MenuProposalの適用済み`proposalId`はcanonical data内の`appliedProposalIds`に記録する。Ver1では既存active TrainingItemだけを参照し、既存Menuの更新・Master作成／更新／削除を受け付けない。適用時のcanonical IDはアプリ側で新規発行する。
- Trainer Historyはcanonical stateから純粋関数で生成するread-only projectionである。Sessionのsnapshotを現在Masterで補完せず、期間指定では両端を含む。設定変更は期間内のrecordと、必要なら開始日前の最新1件をbaselineとして含める。
- 関係: Exercise → Item → MenuItem（週メニュー所属）。Categoryは表示／分析のまとまり。
- 日付は端末のローカル日付、週は月曜始まり。
- 削除は完全削除でなく `archived` による非表示化。
- 分析の負荷換算はSessionのCore Snapshotを正本にする。カテゴリ／部位での分類は現行設定を参照し、履歴snapshotには保存しない。
- 今日の実施総数は、分母を当日推奨のMenuItem件数、分子をローカル日付が今日のSession件数（追加トレーニングを含む）とする。

## 5. 重要なファイル

| パス | 役割 | 現在の状態 |
|---|---|---|
| `src/App.tsx` | 画面、実行、集計、設定、分析、JSON入出力 | H-20260927-04の共通ヘッダー、一覧高密度化、Run画面圧縮を実装済み。 |
| `src/history.ts` | Exercise単位の14日実施状況表示 | H-20260927-04で追加、通常／追加実施を統合表示。 |
| `src/history.test.ts` | 14日実施状況のUnit test | 同一Exerciseの複数Item、通常／追加実施を対象に追加・成功。 |
| `src/domain.ts` | 正式データ型、参照検証、Migration、backup／proposal境界 | H-20260922-07で追加。UIやIndexedDBに依存しない。 |
| `src/canonical/` | canonical正式データの純粋domain基盤 | types／validation／operations／識別fixture／Vitestテストを保持。設定変更履歴の初回識別・個別削除を含む。 |
| `src/canonical/legacy.ts` | Stage 1のlegacy再作成preview | legacy payloadを構造識別し、Profile候補と参照材料件数だけを非破壊で生成する。 |
| `src/canonical/cutover.ts` | Stage 2のcanonical storage/cutover/Restore境界 | baseline保護、保存後read-back、authority marker、rollback、明示的Restore入力検証を実装済み。 |
| `src/CanonicalApp.tsx` | Stage 3のcanonical通常画面とcutover／Recovery UI | canonical専用のTop、Menu、Run、追加実施、標準設定、Session履歴、設定変更履歴を実装。legacy AppDataは二重読書きしない。 |
| `src/canonical/runtime.ts` | Stage 3の初期candidate、週境界、Session作成 | Profile候補だけを採用した空candidateを作り、legacy entityを自動変換しない。 |
| `src/canonical/trainer.ts` | Ver1 MenuProposal／Trainer Historyの純粋domain I/F | proposal検証、candidate生成、persist/read-back適用、Trainer History projectionを実装。 |
| `src/canonical/analysis.ts` | canonical Ver1 Analysisの純粋domain集計 | formal `referenceTrainingLoad`、週／月／四半期／年bucket、snapshot基準の全体・bodyRegion・種目・頻度集計を実装。 |
| `src/canonical/analysis.test.ts` | Analysis domain test | formal換算、週境界、archive済Master、未分類、Menu外追加、種目実績・頻度を検証。 |
| `src/canonical/masterBootstrap.ts` | Android MAN用限定Master bootstrap | 承認済み4件の固定canonical入力、ID発行、衝突拒否、validation、保存／read-back、source対応表を実装。 |
| `src/canonical/masterBootstrap.test.ts` | Master bootstrap domain test | ID、field mapping、usesWeight=false、衝突、partial failure、MenuProposal参照を検証。 |
| `src/canonical/manMenuProposal.ts` | Android MAN用MenuProposal producer | H-17の構造化対応表を入力に、active TrainingItemだけをH-07 schemaの提案JSONへ変換し、既存validatorでself-checkする。 |
| `src/canonical/manMenuProposal.test.ts` | MAN用MenuProposal domain test | 必須順、時間型任意項目、legacy source ID非混入、欠落／archive拒否、既存Menu適用時のactive Menu不変を検証。 |
| `src/buildInfo.ts` | build identifier表示用定数 | Vite build-time defineの表示値を読み、define未注入時は`Build local`を返す。 |
| `vite.config.ts` | Vite設定 | `VITE_BUILD_SHA`／`GITHUB_SHA`から先頭8桁のSHAとbuild日をbuild identifierへ注入する。 |
| `.github/workflows/deploy-pages.yml` | GitHub Pages配信 | build stepへtrigger commit SHAを`VITE_BUILD_SHA`として明示注入する。 |
| `src/canonical/trainer.test.ts` | Ver1 Trainer I/FのUnit test | proposal検証・idempotence・rollback、履歴期間・baseline・archived contextを検証。 |
| `src/canonical/runtime.test.ts` | Stage 3 pure runtime test | candidate境界、週開始、Session snapshotを検証。 |
| `playwright.config.ts` | Chromium E2E設定 | 共用IndexedDBを安全に検証するため、現行single-specのtest caseを直列実行する。 |
| `src/canonical/cutover.test.ts` | Stage 2自動テスト | in-memory adapterで保存失敗、read-back不一致、runtime/restart失敗、rollback/recovery失敗を注入して検証する。 |
| `vitest.config.ts` | Stage 0自動テスト設定 | Node環境で `src/**/*.test.ts` を実行する。 |
| `playwright.config.ts` | Chromium E2E Trial設定 | ViteをE2E時だけ起動し、failure evidenceを保持する。 |
| `e2e/` | Playwright E0/E1 browser test | production hookなしでIndexedDB seed/read-backとbrowser clockを扱う。 |
| `.github/workflows/test.yml` | test CI | Vitest/build jobとChromium Playwright jobを分離する。 |
| `src/data.ts` | 初期データとIndexedDB adapter | legacy v6／v5読込に加え、DB v7のcanonical/cutover/baseline adapterとauthority起動分岐を実装済み。 |
| `src/styles.css` | 既存のスマホ優先スタイル | 今回は変更なし。 |
| `src/density.css` | UI先行改修用の追加スタイル | H-20260927-04の共通ヘッダー、一覧・Run高密度化スタイルを追加済み。 |
| `public/prototypes/oic-012-density-prototype.html` | OIC-012のOwner確認専用・独立HTML Prototype | 作成済み。Productionコードには未接続。Ownerレビュー中。 |
| `src/main.tsx` | React起動とスタイル読込 | `density.css`を追加読込。 |
| `PROJECT_STATUS.md` | 開発再開用の状態記録 | この内容に更新済み。 |
| `training-project/handoff/H-20260925-09.md` | Playwright TrialのRole間Handoff | DONE。my-appの実装commitと検証結果を記録。 |

## 6. 動作確認

- 実行済み: 2026-09-28にH-20260928-21後の `pnpm test` が10 file・62件成功、`pnpm build` がPWA生成を含め成功、`pnpm test:e2e` がChromiumで10件成功。`VITE_BUILD_SHA=abcdef1234567890`を渡したbuild成果物には`Build 2026-09-28 / abcdef12`が埋め込まれることも確認した。
- 確認できたこと: Stage 2のcandidate識別・validation、legacy baselineのv6完全検証／v5決定的移行検証、baseline保存、canonical保存/read-back、runtime/restart相当read、rollback、canonical Restoreのfailure injectionをVitestで確認した。構造識別できるだけの不正v6入力はbaselineへ保存されない。E2Eはv7 IndexedDBでも既存v6画面の実施保存・週境界・backup restoreを確認した。
- 未確認: H-20260928-07のAndroid実機でのMenuProposal file選択・Warning確認・適用後の週メニュー確認、Trainer History file download。H-20260927-04のモバイル実機での共通メニュー・二行一覧・Run操作。Stage 2の実ブラウザ永続化固有リスク（cold boot、quota/storage failure、interrupted transaction、multi-tab）。Android実機でのv5移行（Recovery Pointを保存後にSession／SettingHistory除外）、v6 backup restore、Session snapshot分析。Issue #16のUI先行改修も実機確認が必要。
- 既知の不具合: なし。OIC-009は当日Sessionの件数を分子にするため、同じItemを複数回完了した場合もその回数を数える。

## 7. 次にやるべきこと

1. GitHub Pagesの最新deploy完了後、Android実機でcanonical「正規データの設定」末尾の`Build YYYY-MM-DD / <短縮SHA>`が最新main commit由来であることを確認する。その後、canonicalの「MAN用マスターを投入」成功画面から「MAN用メニューJSONを作成」を実行し、ダウンロードしたJSONを既存の「メニュー投入」で選択する。推奨曜日未指定Warningを確認後に新規Menuを作成し、active Menuが変わらないことを確認する。続けて有効／不正なMenuProposal JSON、Trainer Historyの期間・全履歴・0件表示・JSON downloadも確認し、結果をQA / Testへ渡す。
2. Android実機でcanonical Topの複数曜日選択、Session実績表示、Runのseat入力、週メニュー追加確認、設定変更理由／履歴削除を確認する。結果をQA / Testへ渡す。
2. GitHub ActionsのTest workflowの初回実行結果を確認する。失敗時はActionsログと `playwright-report` artifactを確認する。
2. 初回v6公開後、Androidでv5移行画面を確認する。復旧JSONを保存後、移行により設定を保持し、Session／SettingHistoryが除外されることを確認する。
3. v6バックアップを作成し、別端末またはテストデータで復元する。エラーは中止、警告は確認後だけ復元されることを確認する。
4. 実施完了後、Sessionにsnapshotが残り、種目設定変更後も分析換算係数がSessionの値を使うことを確認する。
5. Issue #16のUI先行改修もAndroidで確認し、QAへH-20260922-07の実装・テスト結果を返却する。
6. Android実機でData Management→「正規データへの切替を準備」を確認する。明示確認後にProfileだけを採用した空のcanonical dataへ切替わり、legacyデータから種目・週メニュー・実績が自動移行されないことを確認する。切替後に種目／実施項目／週メニューを新規作成し、通常実施・追加実施・履歴表示を確認する。
7. Playwright Trialを正式採用・拡張するかは別判断。現時点ではChromiumのみ。UIまたは現行v6 IndexedDB構造を変更する場合、`e2e/` のfixture・selectorを更新してから `pnpm test:e2e` を実行する。
