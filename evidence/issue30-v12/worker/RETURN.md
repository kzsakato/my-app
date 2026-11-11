# Issue #30 my-app-staging-v1r V1.2配信 RETURN

2026-10-26 JST、App Development/Codex。

**RESULT: PASS（承認対象1Workerのdeploy・PC公開スモーク）。実Android未実施／PMO Ready前のOwner MAN M01–M08 HOLD、QA最終LIMITED継続。**

## Authority / 対象

最新GitHub [PMO #6407465282](https://github.com/kzsakato/training-project/issues/30#issuecomment-6407465282)のOwner最終GOを実取得。V1R不要、対象1件のstatic-assets-only dummy置換、旧PREP廃止、root SW通常更新、既存URL/Access/route/DNS維持、未認証dummy公開、完全rollback保証なしが承認scope。

fetch後開始clean。App `codex/issue30-local-adb` e5ad7a3、Project main 8b938f3。TRAINING_PROJECT/Role/Handoff、正式app-design routing/TEST_SPEC、具体scopeを再確認。旧root資料/PS/Libraryの閲覧を前提にしない。

- **URL： https://my-app-staging-v1r.kzsakato-lab.workers.dev/**
- account：3185994b9e184d33b828a7aa4ecff9df、Worker：my-app-staging-v1r **1件だけ**。
- **配信source SHA：0c9788379eb86ef0f95ebc1ee9d409fa210ac84c**（画面表示0c978837）。その後のEvidence/helper commitを配信SHAと混同しない。
- **配信version：10422bfd-23cf-4949-bff5-e313790bbe0a、100%**。
- deployment：46ae5dd6-4cfe-4e5e-8f12-2adc02ce1047。
- build inventory SHA256：**2f20a5d8489f5d1e4be1849b61d74ff92fa396134bbaab50b2c24ef36e2ffa54**、11ファイル（artifact.json）。

## 実装・配信差分

専用`vite.v12-worker.config.ts`、`tooling/v12-worker/wrangler.json`を追加。旧local候補の合成fixture/guard/DB/PWAを再利用し、target HTTPS originを1値固定。product src/既存vite config/workflow/releaseは不変更。テスト補助server/旧SW試験/remote smokeを追加し、既存smokeの出力先/distだけ環境指定可能にした。

wrangler configはtarget name/account、compatibility2026-10-04、workers.dev有効/preview無効を固定。main/vars/named bindingなし、keep_vars=false、静的assetsのみ。deploy後settingsのbindings=[]を確認し、ASSETS custom-script用途/PREP_EXPIRES/PREP_RUN/PREP_TOKEN_HASHを廃止。値を表示/保存/転用しない。旧準備ページGET404、旧capabilityを実行していない。

DB名は`training-check-v12-local-man` v7、canonical/app＋cutover/state authority。全store空の初回だけダミーをatomic配置、非空validは保持、不完全は非破壊停止。旧DBへのmigration/clearなし。PWA id=/v12-local-man、scope/start_url=/、専用cache prefix。Owner実データ/実Backupは禁止。

## 配信前検証

- 型検査`pnpm exec tsc --noEmit` PASS。
- 同一configのtestOnly loopback build＋PC smoke **7観点PASS**：secure context/専用DB/authority、再訪不変、新SW制御、manifest、dummy Backup preview非適用、wrong Host、wrong origin DB前停止、非空DB停止/非対象dummy保持（smoke.jsonの7 record）。
- 旧root SW切替テスト **PASS**：隔離contextに模擬旧V1R root SWと旧名dummy DB sentinelを配置→new SW update→旧clientを閉じる→再訪で候補表示/new SW制御/新DB作成、旧dummy sentinel不変。試験内でregistration.updateを明示しており、あらゆるOwner既存SWの自動更新時期を保証するものではない。
- target-originの最終build PASS、testOnly=false/sourceSHA/originを照合。11ファイルのhash・拡張子allowlist・private-key/token pattern検査PASS。publicDir=false、Ownerファイル/実Backup/.env/credentialのcopyなし。合成fixture由来であることを確認。
- `wrangler@4.147.0 deploy --config tooling/v12-worker/wrangler.json --dry-run` PASS、No bindings found。Wranglerはread12表示だが、実際の静的ファイル一覧は11件を採取し、配信後も11件すべてbyte/hash一致確認。
- 書込み直前にtarget旧version=76508502…100%、4つの旧named bindings、subdomain/compatibilityを承認差分と照合。旧資産の完全回収/backupを再Gate化していない。

## 配信・公開後Evidence

2026-10-26 **03:26:31 UTC（12:26:31 JST）**、固定configでdeploy1回、exit0。Wrangler raw出力は旧binding値等の露出を避けて保存せず、version/target/exit等の安全化deploy.jsonのみ記録。新規login/権限追加/Access編集なし。

- `before.json` / `after.json`：target新version100%、bindings空、compatibility/subdomain/preview不変。
- `served-assets.json`：匿名HTTPS GET、**全11asset HTTP200＋SHA256一致**、旧`/__staging/prepare.html` GET404。認証header/Cookieなし。
- `remote-smoke.json`：公開URLをPC隔離Chromium153で開き、HTTPS secure context、設定source SHA一致、専用DBだけ、authority=true、MANダミーメニュー、1種目/1Session、root SW controller/scope、専用cacheを確認。再読込/新規tabでcanonical全体不変、360px横overflowなし。PC desktop/設定/360px画像を担当が目視確認。
- `non-target-invariants.json`：他2 Workerのdeployment/version不変、production Pages設定とmain SHA不変、対象custom domains/subdomain/preview不変。production mainは4233692fb07aeaec0fcc59fe585cadbc1b4b77ecのまま。保護対象へwriteなし。

Access/route/DNS編集は未実施。Access policy全体を読めない制約は保持し、匿名到達実測＋Ownerの公開dummy許容に基づく。外部全利用者/全経路の完全監査やAndroid成功を意味しない。

## Owner最小操作・残件

**[Android最小確認手順](ANDROID_SMOKE.md)**。USB/ADB/Android Studio/CA/Firewall/PC local server不要。OwnerはAndroid Chromeで固定URL→候補名/ダミーメニュー→設定build0c978837→候補PWA install→閉じる→候補アイコンでrelaunch、結果/画面/機種OSChrome版を返すだけ。Git/shell/test/DevTools不要。最初の不成立点でSTOPし、旧表示/警告/エラーを返す。サイトclear・SW解除・実データ操作に迂回しない。

Android機種/Chrome依存のinstallability・standalone・表示・relaunch/実内部DB/SWは未実測。PC browserの結果を代用しない。最小fixtureなのでM03複数行/M05比較/M07分類警告等はQA照合待ち。M01–M08の本MANは実Androidスモーク後のPMO Readyを待つ。

完全旧V1R rollback保証なし。旧V1Rは保持/機能維持要求なし。新artifactはhash付きで保存し、同一source/configから再配信する際は担当が再build/hash/targetを照合。今回rollback/削除/他Worker deployなし。無承認の追加修正をしない。

**RETURN TO: PMO→Android実機支援/QA。OWNER ACTION: Android最小確認だけ。WAIT FOR: 実機スモーク結果とPMO Ready。** 配信PASSとOwner MAN/最終QA PASSは別。
