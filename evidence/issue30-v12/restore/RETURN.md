# Issue #30 Restore対応・同Worker再配信 RETURN

2026-10-26 JST、App Development/Codex。

**RESULT: PASS（通常Restore確認・承認対象Worker再配信）。Ownerの実Backupは取得/処理していない。Owner端末での実Restoreは次Action。QA最終LIMITED、本番release/PR#4 merge非GO維持。**

Authority：[PMO #6408163233](https://github.com/kzsakato/training-project/issues/30#issuecomment-6408163233)。Owner本人がV1.1実データBackupを端末でRestore、既存dummy1件上書き可、異常系/追加dummy不要。従前dummy-only/実Backup禁止の運用制約を本Workerに限って更新する。

両repo fetch/clean確認、App開始e6682ca・branch codex/issue30-local-adb、Project main 8b938f3。TRAINING_PROJECT/Role/Handoff、正式JSON交換仕様、既存Restore実装を確認。Library/PS/旧root資料閲覧を前提にしない。

## 配信結果

- **URL： https://my-app-staging-v1r.kzsakato-lab.workers.dev/**
- **source SHA：4d0392db63c0de9b8e8f32f8d72d04cd0919ef63**（画面4d0392db）。
- **version：475096d1-2e65-4771-b90c-1f1dfc17d2f4、100%**。
- deployment：f988f08f-81d2-409d-8ef0-5b5cb2e880d9。
- deploy成功：2026-10-26 **06:45:47 UTC / 15:45:47 JST**、exit0、対象1Workerのみ。
- build inventory SHA256：**2f7b29380b31eb5912d73a05d656bdef1a2c05ec320d45bdab59fc83e64ec38c**、10 assets。配信後10/10のbyte/hash一致。

## 最小変更とRestoreの実体

調査の結果、`BackupPage`と`applyCanonicalRestore`は前版にも存在し、hard-disable flagはなかった。「Restore無効」は従前MAN運用の禁止とdummy-only案内であり、acceptance guardを削る変更は不要だった。

- `vite.v12-local.config.ts`をdefault動作不変のfactoryにし、Worker版だけRestore対応表示を選択。
- `vite.v12-worker.config.ts`で「ダミー専用/実Backup持込禁止」を外し、「Restore対応・端末内処理」に更新。manifest name/short_nameを検証版へ変更するがid/start_url/scopeは維持。配布用の不正表示設定JSONをWorker buildから外す。
- 通常Restoreの全置換警告、確認dialog、任意設定補完warning確認、validator、canonical全量保存/read-backを維持。`src/CanonicalApp.tsx`・Data Contract・Restore本体は変更しない。
- DBはtraining-check-v12-local-man v7、authority/canonical key不変。既存1件を自動消去・再seedしない。Ownerの明示Restoreで全量置換する。復元後データは再起動時に保持される。

## 正常系検証

- 型検査PASS、既存unit **144/144 PASS**、専用build PASS、Wrangler dry-run PASS（No bindings found）。
- 既存の合成`canonicalBackupFixture`だけを使用。新しい異常系/ダミーfixtureを作成・配信せず、Owner Backupは使用しない。
- **local1件＋公開URL1件のRestore E2E PASS**。V1.1互換のcanonical envelope format/schemaVersion1、optional displayPreferences欠損は正式の既存補完仕様どおりpreview。全置換warning/最終confirm→apply→canonical完全一致、authority等非canonical store不変。
- **通信offline中にファイル選択→Restore→成功read-back→reload保持までPASS**。Restore中のbody付き/変更method送信0、外部origin要求0。既存Restore経路は`File.text()`→純粋parse/preview→IndexedDBであり、fetch/beacon/analytics/consoleログによるBackup本文送信はない。新たな送信機能を追加しない。
- 復元後のメニュー等は既存Backup内容と一致。新bootの非空判定は既存canonicalを保持し、ダミーに再seedしない。
- `local/normal-restore.json` / `remote/normal-restore.json`は合否/不変性だけを記録し、Backup本文や復元canonical内容をEvidenceへ出力しない。

実OwnerのV1.1ファイルそのものは検証していない。互換確認は承認済みcanonical形式と既存合成サンプルの範囲。旧raw/v5の修復/変換は追加しない。異常系MANをOwnerへ依頼しない。

## 配信照合と不変

`before.json` / `after.json` / `deploy.json` / `artifact.json` / `served-assets.json` / `invariants.json`参照。他2 Workerのdeployment、本番Pages設定/main SHA、custom domains、対象bindings=[]/compatibility/subdomain/previewを前後同一と確認。Wrangler config・Access/route/DNSは変更なし。本番src/workflow/release/PR#4 branch、他origin SW/PWA/DBへwriteなし。

補助確認の注意：外した旧dummy-backup-warning.jsonへの**default UA要求は403**で、404の確認は成立していない。元checkerのFAIL記録はserved-assets.jsonに保持し隠していない。ローカルbuild inventoryに当該fileはなく、通常配信10/10 hash・実Restore正常系はPASS。この補助URL観測を異常系調査や追加deployのGateへ広げず、404/全経路不存在は申告しない。

## Owner手順・RETURN

**[Owner Restore手順](OWNER_RESTORE.md)**：同URLの新build4d0392dbを確認→設定/データ管理→端末内V1.1正規Backup選択→件数/全置換warning確認→復元→最終confirm→read-back成功表示→閉じて再度開き保持を確認。再install/再seed/追加fixture不要。アイコン名が旧表示でも新buildで識別する。

**RETURN TO: PMO→Ownerの端末Restore・通常系MAN。OWNER ACTION: 実Backupを送らず、端末上で上記Restore/通常使用を行い結果だけ返す。** QA最終LIMITEDと本番release非GOを維持。Owner実データの内容確認・アップロード・異常系試験・旧dummy保全は要求しない。
