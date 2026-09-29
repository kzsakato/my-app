# PROJECT_STATUS

最終更新: 2026-09-29（H-20260929-22: 喜久蔵Minimal Trial Phase 2 skeleton）

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
- H-20260929-03として、legacy通常「設定」画面末尾にも同じbuild identifierを追加した。canonical／legacyで表示値や注入方式を分けず、どちらの保存状態でも配信版を確認できる。
- H-20260929-12として、Android MANで確認されたcanonical UIの未表示を切り分けた。通常のlegacyデータ導線はlegacy UIを継続し、canonical UIはData Managementから明示cutoverし、canonical authority markerが有効な場合だけ起動する。cutoverはProfile候補だけを採用し、legacyの種目・実施項目・週メニュー・履歴を自動移行しない。Runの重量5操作はlegacy／canonical共通CSSで横幅全体へ配置するよう修正し、旧画面からの明示cutoverを経たcanonical UI操作をE2Eに追加した。
- H-20260929-21として、canonical Topに`カテゴリ表示`／`推奨曜日表示`を追加した。カテゴリ表示は新しいCategory entityを持たず、active Menuのactive対象を既存Exerciseの`bodyRegion` classificationでgroup化し、未設定は`未分類`としてRunへ到達させる。推奨曜日filterは常時checkbox列から、当日初期値・同一画面内の選択保持を持つ開閉式multi-select dropdownへ変更した。MenuEntryの単一`recommendedDay`契約、schema、legacy migrationは変更していない。

### 未着手の機能

- 実施履歴そのものの一覧・詳細閲覧。
- 設定履歴の変更前後差分表示。
- 週メニュー切替の「今週から／次週月曜から」予約。
- インターバルタイマー。
- AI連携UI、TrainingContextの履歴要約、カテゴリ／部位／分析分類の正式モデル。

## 3. 現在の作業内容

- 最後に取り組んだ課題: H-20260929-22（喜久蔵Minimal TrialのPhase 2 skeleton／local test）。
- 完了状況: root `main` を `git fetch` / `git pull --ff-only` で最新化後、Data Managementから明示的に初期canonical candidateを作りcutoverできるようにした。candidateには明示確認済みProfileだけを採用し、legacyのmaster/menu/session/historyは移さない。authority後はcanonicalだけを保存・参照する通常画面（Top、Menu、Run、追加実施、標準設定、履歴）へ接続した。Profileの体重・身長・年齢・性別は採用前に全て表示し、切替前にlegacy source検証とimmutable baseline保存/read-backだけを実行するpreflightを追加した。Unit 39件、PWA build、Chromium E2E 6件が成功。
- 現在の問題: canonicalカテゴリprojectionと曜日dropdownの限定FIXを実装済み。Desktop Chromiumの可視cutover E2Eでは、週メニュー追加の未選択disabled、confirm No／Yes、Top read-backまで成立した。一方、Owner Android/Braveの追加不反応は再現できず、mobile-touch／native select／native confirmに限定したコード原因も確認できない。Android QA-requiredとして、選択済みのMenu add、Yes/No、Top read-back、およびdropdown操作を実機で確認する必要がある。successful canonical cutover後にlegacy `state/app`／protected baselineは消去されないが、通常UIからlegacy authorityへ戻す、baselineを復元する、legacy backupをimportする操作はない。canonical dataの異常時もlegacyへsilent fallbackせずcanonical Recoveryとなる。
- H-20260929-22では喜久蔵Minimal TrialのPhase 1を確認した。現行`my-app`は静的GitHub Pages PWAのみでserver-side GitHub write adapterを置けず、`training-project`にもQABox／deployment／secretはない。既存Ver1と分離する最小案は、別private `kikuzo-trial` repoとCloudflare Worker（static UI + same-origin API）である。GitHub Contents APIのTrial専用fine-grained PATとaccess secretをWorker secretへOwnerが直接投入する必要があるため、Phase 2のprototype実装／deployは未着手。
- H-20260929-22 Phase 2 skeletonとして、private `kzsakato/kikuzo-trial` repoを作成し、Cloudflare Worker向けの質問取得／回答保存UIと固定GitHub QABox adapterを実装した。local mock test 6件とTypeScript checkは成功。Cloudflare deploy、Worker secret、実GitHub QABox writeは未実行であり、既存筋トレappやProject SoTのデータは変更していない。
- H-20260929-17のFact Checkでは、Owner通常Chromeとは別のbrowser appを新規にMAN専用として用い、同じPages URLを通常tabで開く方式を推奨候補とした。appはIndexedDBのみを使いサーバー同期を行わず、Androidの別app sandboxによりChrome側のIndexedDB／authority markerへ書込み経路を持たない。MAN専用browserではPWA installやlegacy backup importを行わない。Android実機でclean storageとBuild identifierを最初に確認する必要がある。

## 2026-09-29: 喜久蔵 Trial deploy phase

- Cloudflare OAuth device authorization後、`kikuzo-trial` Workerのupload/deployは成功（Version ID: `cf9b4b54-2fb5-4ffd-9ec0-e17c6cd63544`）。
- `workers.dev` subdomainが未登録のため、公開URLのHTTPS確認は未完了。`GITHUB_TOKEN`／`TRIAL_ACCESS_SECRET`は未投入で、実QABox read/writeも未実行。

## 2026-09-29: 喜久蔵 Trial public Worker

- Ownerの`kzsakato-lab` subdomain登録後に再deployし、`https://kikuzo-trial.kzsakato-lab.workers.dev/`がHTTP 200でUIを返すことを確認した（Version ID: `08349b39-ee56-44bd-8ad3-ca3ddf1840e9`）。
- 既存GitHub CLI OAuth tokenは広い`repo` scopeのためWorkerへ転用せず、`training-project`だけのContents read/write fine-grained PAT発行を待つ。実QABox read/writeとWorker secrets投入は未実施。

## 2026-09-29: 喜久蔵 Trial deploy phase完了（実E2E前）

- OwnerがTrial専用fine-grained PATと別access codeをWorker secretsとして投入済み。`wrangler secret list`で`GITHUB_TOKEN`と`TRIAL_ACCESS_SECRET`の存在だけを確認し、値は取得・表示・保存していない。
- 公開Workerの不正access headerはHTTP 401で拒否された。実QABox質問票が未作成のため、正しいaccess codeによる表示・回答保存・GitHub Contents API実書込みは未実施。H-22はTechnical Advisorへ返却する。

## 2026-09-29: 喜久蔵 Trial Q-20260929-01 GET修正

- 実QABox質問票はlocal parserで有効だった。GitHub Contents API adapterに必須`User-Agent` headerがなく、GitHubのreject条件だったため`User-Agent: kikuzo-trial`を追加した。
- 回帰testを追加し、`pnpm test` 7 PASS、`pnpm build` PASS。Worker Version `eba81c46-9129-441a-99cf-94e90d407e53`へ再deploy済み。Owner access code値は取得しないため、正しいcodeでの公開GET／回答書込みはTechnical Advisor / QAのE2E受入で確認する。

## 2026-09-29: 喜久蔵 Trial E2E GET server-side修正

- 一時secretで保護したserver-side diagnosticにより、`GITHUB_TOKEN` runtime binding、固定target `kzsakato/training-project` / `main` / `QABox/Q-20260929-01.md`、固定headersを確認し、GitHub Contents GETがHTTP 200かつ`contents=read`で成功することを実測した。PAT再発行・secret再入力は不要。
- 実原因はCloudflare Workerでglobal `fetch`をclass instance receiverで呼んだことによる`Illegal invocation`。`globalThis.fetch`を正しく束縛するwrapperへ修正し、回帰testを追加した。一時diagnostic endpoint／secretは撤去済み。final Worker Version `b3f59709-6849-4f01-bd7d-1dffe3a707e6`、`pnpm test` 8 PASS、`pnpm build` PASS。

## 2026-09-29: 喜久蔵 Trial Owner UI GET診断

- Owner UIがURL query `q`欠落およびHTTP 401以外を一律に`質問票を取得できません。`と表示していたため、固定GET target、欠落ID、HTTP status、安全なresponse messageを表示するtrial diagnosticを追加した。GitHub GET/PUT failureも安全なHTTP status/messageへ区別した。
- Worker Version `55c727c5-5a2f-4f08-a5dc-301c9c81da13`へdeploy済み。`pnpm test` 10 PASS、`pnpm build` PASS。正しいaccess codeでのOwner GET結果を待ち、実statusに基づき次を判断する。PAT再発行・secret再入力は要求しない。

## 2026-09-29: 喜久蔵 Trial Owner UI GET root cause修正

- Owner実経路の502を再現し、Cloudflare runtimeの`fetch(request, env, executionContext)`第3引数を、test injection用`GitHubContentsClient`として誤用していたことを確定した。本番ではexecutionContextに`getQuestionFile`がなく、GitHub API到達前に`TypeError`となっていた。
- runtime entrypointとGitHub client factoryを分離し、修正後に通常GET endpointを実測HTTP 200（`Q-20260929-01`、3設問、revision）まで確認。一時diagnostic endpoint／secretは撤去済み。final Worker Version `dd5be5c5-77e3-4c3c-aacd-490fd8b6cc6c`、`pnpm test` 11 PASS、`pnpm build` PASS。

## 2026-09-29: 喜久蔵 Trial access header／文字列加工監査

- UIのGETは `GET /api/questions/${encodeURIComponent(id)}` を発行し、literal header `x-kikuzo-trial-access` へパスワード入力欄の `accessCode.value` をそのまま設定する。trim・大小文字変換・置換・正規化は実装していない。`type=password`は表示を伏せるだけで値を加工しない。
- Workerは同じheaderを`Headers.get()`で読み、`provided === env.TRIAL_ACCESS_SECRET`の完全一致だけを判定する。header名の大文字小文字はFetch仕様上区別されないが、値は完全一致であり、値の変換はしない。
- runtime entrypoint経路でASCII英数secretを同じ値で渡すとHTTP 200、末尾に1文字を足すとHTTP 401になる回帰testを追加した。`pnpm test` 12 PASS、`pnpm build` PASS。
- Ownerが受けたHTTP 502はaccess gate通過後にしか返らないため、その試行に限ればsecret/header不一致ではない。既存のCloudflare executionContext修正後、通常GETはHTTP 200を実測済み。secret再生成を根拠なく要求しない。

## 4. 重要な設計上の決定

- 技術: TypeScript + React + Vite + vite-plugin-pwa + idb。Playストア用ネイティブアプリではない。
- 保存: AppData schema version 6。JSON Exportはenvelope内のAppData全体、Restoreは検証と利用者確認後に端末内データ全体を置換する。
- canonical Stage 2の保存は旧AppDataとは別のIndexedDB store（`canonical`、`cutover`、`baseline`）を使う。既存の`state/app`とStage 1の`recovery`は切替成功前後も削除・上書きしない。
- canonical authority後の起動失敗はlegacyへ自動フォールバックせず、明示的復旧状態で停止する。canonical cutover前の失敗ではmarkerをlegacy-activeへ戻すよう試みる。
- canonical UIを表示する条件はcanonical authority markerと検証済みcanonicalデータである。legacy AppDataが存在するだけではcanonical UIを表示しない。これは、legacyデータを自動変換・削除しないcutover設計と連動する。
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
| `e2e/training-check.spec.ts` | Chromiumの実導線E2E | H-20260929-12でlegacy Data Managementから明示cutoverし、canonicalの曜日選択・週メニュー追加確認・Run seat入力・設定変更理由／削除を確認するgateを追加。 |
| `public/prototypes/oic-012-density-prototype.html` | OIC-012のOwner確認専用・独立HTML Prototype | 作成済み。Productionコードには未接続。Ownerレビュー中。 |
| `src/main.tsx` | React起動とスタイル読込 | `density.css`を追加読込。 |
| `PROJECT_STATUS.md` | 開発再開用の状態記録 | この内容に更新済み。 |
| `training-project/handoff/H-20260925-09.md` | Playwright TrialのRole間Handoff | DONE。my-appの実装commitと検証結果を記録。 |

## 6. 動作確認

- 実行済み: 2026-09-29にH-20260929-12後の `pnpm test` が10 file・62件成功、`pnpm build` がPWA生成を含め成功、`pnpm test:e2e` がChromiumで12件成功。E2Eではlegacy Data Managementからの明示cutover、canonicalの曜日multi-select、週メニュー追加confirm、Run seat保存、設定変更理由と非初回履歴の削除confirmを確認した。配信中bundle `assets/index-CtM4jXnu.js` にはcanonical UI文字列群が含まれ、`Build 2026-09-28 / db09f72d`を確認した。
- 確認できたこと: Stage 2のcandidate識別・validation、legacy baselineのv6完全検証／v5決定的移行検証、baseline保存、canonical保存/read-back、runtime/restart相当read、rollback、canonical Restoreのfailure injectionをVitestで確認した。構造識別できるだけの不正v6入力はbaselineへ保存されない。E2Eはv7 IndexedDBでも既存v6画面の実施保存・週境界・backup restoreを確認した。
- 未確認: H-20260928-07のAndroid実機でのMenuProposal file選択・Warning確認・適用後の週メニュー確認、Trainer History file download。H-20260927-04のモバイル実機での共通メニュー・二行一覧・Run操作。Stage 2の実ブラウザ永続化固有リスク（cold boot、quota/storage failure、interrupted transaction、multi-tab）。Android実機でのv5移行（Recovery Pointを保存後にSession／SettingHistory除外）、v6 backup restore、Session snapshot分析。Issue #16のUI先行改修も実機確認が必要。
- 既知の不具合: なし。OIC-009は当日Sessionの件数を分子にするため、同じItemを複数回完了した場合もその回数を数える。

## 7. 次にやるべきこと

1. PMO／OwnerがAndroid MANの環境を決定する。現行cutoverは、Profileだけ採用してcanonical authorityへ永続的に切替え、legacy UIへ戻す正式導線を持たない。推奨候補は、通常Chromeの既存PWAを変更せず、新規の別browser appの通常tabで同じPages URLを開き、そのbrowserだけでcutoverとMANを行う方式である。最初にsecondary browserがclean storageであることとBuild identifierを確認し、MAN後に通常Chromeのlegacy画面が不変であることを確認する。別browserを不要にする場合はuninstallする。App Developmentはこの判断なしにdefault route、データ移行、authority切替を変更しない。
2. QA / TestがH-20260929-21のpre-MAN gateを実施する。canonical cutover後にMenu addの未選択disabled・選択後confirm Yes/No・Top read-back、カテゴリgroup（未分類を含む）→Run、曜日dropdownの複数選択／開閉、標準値→Run、設定履歴、active Menu切替／再読込を確認する。Androidではnative select／confirmとdropdownタップを実機確認する。
2. 最新のGitHub Pages deploy完了後、Android実機でlegacy「設定」またはcanonical「正規データの設定」末尾の`Build YYYY-MM-DD / <短縮SHA>`が最新main commit由来であることを確認する。canonical MANを実施する場合はData Management→「正規データへの切替を準備」を通り、canonicalの「MAN用マスターを投入」成功画面から「MAN用メニューJSONを作成」を実行する。推奨曜日未指定Warningを確認後に新規Menuを作成し、active Menuが変わらないことを確認する。
3. Android実機でcanonical Topの複数曜日選択、Session実績表示、Runのseat入力、週メニュー追加確認、設定変更理由／履歴削除、およびRun重量5操作の横幅を確認する。結果をQA / Testへ渡す。
2. GitHub ActionsのTest workflowの初回実行結果を確認する。失敗時はActionsログと `playwright-report` artifactを確認する。
2. 初回v6公開後、Androidでv5移行画面を確認する。復旧JSONを保存後、移行により設定を保持し、Session／SettingHistoryが除外されることを確認する。
3. v6バックアップを作成し、別端末またはテストデータで復元する。エラーは中止、警告は確認後だけ復元されることを確認する。
4. 実施完了後、Sessionにsnapshotが残り、種目設定変更後も分析換算係数がSessionの値を使うことを確認する。
5. Issue #16のUI先行改修もAndroidで確認し、QAへH-20260922-07の実装・テスト結果を返却する。
6. Android実機でData Management→「正規データへの切替を準備」を確認する。明示確認後にProfileだけを採用した空のcanonical dataへ切替わり、legacyデータから種目・週メニュー・実績が自動移行されないことを確認する。切替後に種目／実施項目／週メニューを新規作成し、通常実施・追加実施・履歴表示を確認する。
7. Playwright Trialを正式採用・拡張するかは別判断。現時点ではChromiumのみ。UIまたは現行v6 IndexedDB構造を変更する場合、`e2e/` のfixture・selectorを更新してから `pnpm test:e2e` を実行する。
