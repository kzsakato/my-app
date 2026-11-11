# Issue #30 V12-01 / V12-07 implementation RETURN

RESULT: PASS（実装・PC自動回帰・既存検証Worker配信）。Android実機Owner MANは未実施。V1.2全体QA LIMITED、本番/PR#4 merge非GOを維持。

## Authority / baseline

Owner GO、PMO #6432136072、設計是正 training-project/main 799df27ba89d1075dd529f0c6886cc57a65627f9（06§4.5、03 TOP/REGION、V12-Q01〜03）。V12-07の形式はPMO #6431922036/#6432017219の14日●○右寄せ・縦幅維持。アプリ開始HEAD473f546、branch codex/issue30-local-adb、clean確認。対象repositoryを分離してfetch。Owner画像・実Backupは入力/転載していない。

## Implemented scope

- V12-01: TopPageの予定表示sort入口で、既存completedEntryIdsに含まれる予定Entryを表示対象から除外。TOP/REGION、OFF/ON共通。OFF＝未完了Entryのみ、ON＝未完了Entry＋既存個別Session行。各Session IDの保持・押下先・取消、独立sort/filter、completion判定・件数/負荷は変更なし。Entry/Sessionの保存値・Backup・Run本体不変更、新規折りたたみ/UIなし。
- V12-07: EXTRA-LIST各行の既存2行目へ既存exerciseHistoryを追加。snapshot.exerciseId×保存date、左13日前/右今日、●○と週境界の既存意味を維持。数値/選択矢印/操作を保持。右寄せ用CSSはEXTRA固有クラスだけ。PC/360pxで行高は変更前後57px。
- Product files: src/CanonicalApp.tsx、src/v1r11.css。対象テスト: e2e/issue30-v12.spec.ts、e2e/owner-v12-01.spec.ts、e2e/owner-v12-07.spec.ts、playwright.v12-owner-final.config.ts、tooling/v12-worker/remote-final-smoke.mjs。テストoracle更新のAuthorityは799df27で、実装合わせの自己承認ではない。OKのV12-02/05/06を再調査するtestは選択せず。

## Validation

- Typecheck `pnpm exec tsc --noEmit` PASS。
- Unit `pnpm test`: 18 files / 144 tests PASS。
- Target E2E `pnpm exec playwright test --config playwright.v12-owner-final.config.ts`: 16/16 PASS、PC1280/360px。results.jsonと画像を保存。
- V12-01: 完了Entry8/Session8の合成ケースでTOP/REGIONともOFF予定0/実績0、ON予定0/実績8・ID各1回。正常Backup Restore経由の同Exercise2Entry/2SessionもOFF予定0/実績0、ON予定0/実績2。Option独立、反復ON/OFFでcanonical不変。
- 既存接続回帰: 未完了Entry混在、複数TI/SessionとExtra、保存snapshot/current部位差・欠損、曜日差と0/7曜日、未完了EntryのPLAN-RUN/新Session追加、特定Session参照、1件取消後の残存Session保持/予定非表示、最後の該当Session取消時の予定再表示、reload/read-back。集計/負荷の表示不変（filter/Option切替）、取消後件数3/6、保存データ差分が選択取消だけであることを確認。
- V12-07: 変更前473f546のPC/360px画面・geometryを保存してから実装。変更後も行高57px、14日分、右端整列、横overflowなし、詳細数値/タップ導線、canonical不変。EXTRAのAND除外・同Exercise全TI除外・未来日窓外も回帰。
- 初回対象runはRestoreテストで1件timeout（警告UIの非同期表示前にcount判定し確認をskipするテスト待機漏れ）。確認checkboxのvisible待機を追加し、16件を再実行してPASS。アプリRestore処理/確認要件は変更していない。
- Worker build / Wrangler dry-run PASS。公開PC1280/360pxの独立fresh browser contextでも8件projectionとEXTRA57px/14日右寄せPASS、canonical不変。remote-results.json。PC幅エミュレーションをAndroid実機PASSとは扱わない。

## Deployment / separation

URL: https://my-app-staging-v1r.kzsakato-lab.workers.dev/
Build/source: 2f1cbfa473f91c4058234cf9c4b56f57cf14551e（表示2f1cbfa4）
Worker version: 7d524a02-c290-42ed-ab77-d80600144f1f、100%
配信: 2026-10-27 11:27 JST
Push: kzsakato/my-app codex/issue30-local-adb

対象Worker1件のみ配信。10assetすべて公開取得hash一致。inventory SHA256: cffb541f0316797b8d47c75d8d7cffb2853c5ba5161a20e7d329e03b95295900。
before/after.jsonで他2 Worker deployment、本番Pages/main、対象settings/bindings/subdomain/custom domain不変。Access/route/DNSの設定変更なし。DB training-check-v12-local-man v7、PWA id /v12-local-man、Restore対応を維持。データclear/migration/reseed変更なし。Owner端末のDB/実Backupへ接触なし。remote smokeの合成データは新規の一時browser profile内のみ。

## Residual / return

BLOCKED BY: なし（今回の実装・配信範囲）。
WAIT FOR: Ownerの通常利用時Android Chrome/PWA確認。QA最終受入は所管判断。
RETURN TO: PMO（親分）→QA/Owner。
OWNER ACTION: 同URL/PWAを閉じて開き直し、設定build 2f1cbfa4を確認。実施済OFFで完了行が消え、ONで実績行が表示されること、追加トレーニング右側の14日●○と縦幅を通常使用時に確認。新規fixture/実Backup提出/再install/データ消去/再Restoreは不要。旧buildなら消去せず表示buildを返す。
