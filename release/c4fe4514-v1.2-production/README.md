# V1.2 GitHub Pages固定product準備 — Issue #30

Status: PREPARED / NOT DEPLOYED。RETURN TO: PMO（親分）。Owner本番GOは既済、Codexは準備のみ。
Authority: PMO #6467970354、TEAM_CASE §7 / Project commit9826e73。Owner受入・本番GO #6463119407、QA限定受入/Governance条件はIssue参照。main反映とActions管理はPMO担当。

## 出自・build

- 厳密な承認source c4fe4514ab093a9e2084dc286310d46f81ab8864（PR#4 head）。PR#4はcodex/v1r11-implementationへmerge済みb41b8869で、mainへのmergeではない。
- 固定sourceを別のdetached checkoutへ取得し、pnpm install --frozen-lockfile。lock更新・source変更・.envなし。Node24.21.0、pnpm12.6.0。実依存はevidence/issue30-v12-production/dependencies.json。
- VITE_*/V12_*とGITHUB_SHAをbuild環境から外し、VITE_BUILD_DATE=2026-10-28、VITE_BUILD_SHA=c4fe4514ab093a9e2084dc286310d46f81ab8864を明示し npm run build。通常vite.config.tsは改変なし。build exit0、生成tsbuildinfoのみ元のblobへ戻しsource checkout cleanを確認。src/public/config/package/lock等62入力のhashはsource-inputs.json。
- Build表示: **Build 2026-10-28 / c4fe4514**。candidate/Worker版のJS流用ではなく、同じ承認sourceのProduction設定build。base='./'、IndexedDB training-check v7、PWA autoUpdate、manifest/start_url '.'、SW scope /my-app/。staging origin guard/DB、local dummy adapterはbundleに含まれない。
- product8ファイルをmanifest.jsonのパス・size・SHA256で固定。deploy時の再build・npm install不要。旧release/b45c6ded-production/productと旧manifestは保持。

## 限定検証（Codex）

node release/verify.mjs PASS。新固定product8ファイルの全一覧/size/hashを厳格照合。
node evidence/issue30-v12-production/smoke.mjs PASS。依存は承認source checkoutのnode_modulesを使う（V12_SOURCE_CHECKOUT、既定../v12-pages-source）。保存productを127.0.0.1の一時port、/my-app/で静的配信し、隔離Chromiumで次を確認。

1. 新規profile：新Buildで起動、DB training-check v7のみ。candidate DBや強制canonical seedなし。既存Productionの新規起動契約を維持。
2. PC1280/360pxの別profile：旧V1.1 productから起動、合成canonicalと非対象storeのsentinelをlocal DBに設定。旧BuildとSWを確認後、配信ファイルだけを新V1.2 productへ切替。
3. 同じorigin/DB/SW scopeで更新workerのactivate→reload後、新Buildへ更新。canonical/cutover/state/recovery/baselineの全key/valueが更新前後完全一致。DB消去・移行なし。
4. 新版の実施済ONでDefault実施済先→実績/未実施、Option未実施先→未実施/実績の順に反転。切替でDB不変。
5. 合成プロフィール66→67を通常UI保存、完了画面を待ってreload/read-back。変更はそのprofile値だけ、非対象store不変。通常Backup Exportも保存canonicalと完全一致。
6. controller=/my-app/sw.js、scope=/my-app/、manifestは旧V1.1と同一。offline reloadでも新版起動・値67保持。pageerror/HTTP4xx以上なし。

証拠: smoke-result.json、PC/360px更新後画像・offline画像。Owner DB/実Backup不使用、外部本番/Workerに配信・データ操作なし。これはloopback PC限定技術検証で、実Pages HTTPS・既存Owner PWA/Android更新・QA独立PASSを意味しない。

初回smokeはUI保存直後にreloadして保存完了を待っていなかったため66/67不一致で停止。既存onSavedの設定画面遷移を待つtestへ直して再実行PASS。smoke-initial-failure.jsonを保持。アプリ/固定artifactの変更・再buildで合わせていない。初回buildはstdoutのunicodeをPython cp932へ出すwrapperで例外があり、初回logを保存し、同じ固定設定でbuildを再実行してexit0を記録。source・仕様変更なし。

## PR差分とPMO実行手順

main基点4233692fb07aeaec0fcc59fe585cadbc1b4b77ecの専用branch codex/v12-pages-release。既存本番sourceをmergeせず、保存productと接続だけをPRに含める。
- 新規release/c4fe4514-v1.2-production/product全8ファイル、manifest、当README。
- release/verify.mjs: 固定directory/source SHAと成功表示だけ変更。8ファイル厳格size/hash検証を維持。
- .github/workflows/deploy-pages.yml: upload pathだけ変更。workflowでbuildせず固定artifactをそのまま配信。
- 限定検証Evidence。

PMO後続（既存GOの範囲、Codexは未実施）:
1. PR head固定commit、差分、manifest/検証結果を照合しnode release/verify.mjsを確認。
2. 承認済み範囲をmainへ通常merge。mainのrelease/** pushでActionsが起動するため、重複manual dispatchは不要。main反映/PR merge/dispatchはPMOの責任。
3. merge SHAに対応するPages Actionsのverify→upload→deploy成功を確認。merge/起動/成功を区別。
4. 実URL https://kzsakato.github.io/my-app/ のBuild、配信asset hash/URL/manifest/SW scopeと未確認を記録。QAはEvidenceに応じた限定確認、Ownerは既存記録保持/通常利用の実機確認を担当。

旧V1.1 artifactは静的復旧の出自として保持。DB rollbackや旧版へのデータ互換を今回保証しない。Owner既存データを自動消去/移行しない。V1.3・任意改善・リファクタリング混入なし。

## 状態・残件

本番main変更、PR merge、Actions起動、本番deployはCodex未実施。旧V1.1 product・実データ・既存Worker不変更。
BLOCKED BY: なし（準備範囲）。WAIT FOR: PMOのPR確認/main反映、Actions結果確認、QA配信後限定確認、Owner実使用受入。案件CLOSEは別判断。QA全体LIMITEDを維持。
OWNER ACTION: 今回の準備に追加GO/手作業なし。PMOはIssue #30の準備PRを確認し承認済み配信を進める。
