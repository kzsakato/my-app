# Issue #30 QA訂正受領・混在ソート検証版配信RETURN

RESULT: PASS（実装・PC自動検証・検証Worker配信）。前回B/C待ちは解消。QA全体LIMITED・本番/PR#4 merge非GO維持。Android実機/QA独立最終受入は未実施。

## Authority・差分
QA #6435758117、正式TEST_SPEC bad82b1c4bcdebca1aea3e4317bd5b86109a9c7c、Technical #6433073812と06/TOP/REGIONの混在3キー契約をGitHubから実取得して照合。開始app HEAD934d60d、codex/issue30-local-adb、clean。Project repoと分離してfetch。

公開旧build2f1cbfa4からの製品差分は前回実装7d9a42aのsrc/CanonicalApp.tsx / src/canonical/topProjection.tsのみ。filter後の未完了Entryと個別Sessionを同一配列でDefault/Optionの3キー辞書比較。曜日=Entry推奨/Session保存date、部位=current/snapshot、completion方向は当該キーだけ反転。上位キーを優先、同値は名称→行種類→stable ID。混在一覧のSession日時割込を除去、独立履歴は不変更。表示資格・保存データ・個別押下/取消・集計・Backup・CSS/controlは変更なし。

今回の追加Product変更なし。訂正QA oracleをfixture/テストへ追加：e2e/mixedSortFixtures.ts、owner-v12-mixed.spec.ts、owner-v12-sort.spec.ts、src/canonical/mixedTopSort.test.ts、playwright.v12-mixed-release.config.ts、tooling/v12-worker/remote-mixed-smoke.mjs。以前のFAIL/部分PASSは保持、新Evidenceは当directory。

## 検証
- 型検査PASS、unit19 files/163件PASS、Worker build/Wrangler dry-run PASS。
- pnpm exec playwright test --config playwright.v12-mixed-release.config.ts：PC1280/360px、78/78 PASS、FAIL/skip/flakyなし。results.json。
- A：Default/Option×3優先順位×両方向の12設定を各幅で保存/reload。QAの6固定ID順、他方定義の保持、Option初期OFF、TOP/REGION部分列、Y座標、OFF/保存値/集計不変を確認。
- B：同曜日/同部位、名称「あ」「い」、completion第3でU=E-10,E-20,S-10,S-20、D=S-10,S-20,E-10,E-20。両定義・両方向・両幅のTOP/REGIONで訂正期待に一致。
- C：比較器単体E-A,S-X,S-M,E-N、TOP全ON/月E-A,S-X,S-M、全OFF空、REGION胸E-A,E-N／前腕S-X。両定義・両方向・両幅で一致。欠損部位を推測補完せず、既存filterを変更していない。
- D：同キー同名ID順、複数Entry/Session、実績のみ/空、個別Session参照・選択取消/read-back。前回4 FAILも同じ期待でPASS、過去FAILは保持。
- 既存01/07回帰もPASS：OFF0/ON8、正常Restore後の複数Session、残存completion/最後の取消後予定再表示、再実行/非対象保存値、EXTRA除外・14日右寄せ/57px行高。OK3件の再調査testは選択せず。
- 公開新buildのfresh browser profilesでA12設定＋B/C両定義両方向を各幅照合、40ケースPASS。B/C REGIONとcanonical切替不変も確認。remote-results.json。合成QA fixtureを一時profileのIndexedDBへ設定しただけでOwner環境/Backupへ接触なし。

## 配信・分離
URL: https://my-app-staging-v1r.kzsakato-lab.workers.dev/
Build/source: c4fe4514ab093a9e2084dc286310d46f81ab8864（画面c4fe4514）
Worker version: 0dd2be1c-2d8a-4069-aa67-de0cb194d4a0、100%
配信: 2026-10-27 16:02:47 JST
Push先: kzsakato/my-app codex/issue30-local-adb

my-app-staging-v1rのみ更新。公開10asset hash一致、inventory SHA256: 81d72c1b04ea2c2c92737c62053a89eb360fa78a1598fc6317a2ee9d84c5faaa。
before/after.jsonで本番Pages/main・他2 Worker deployment・対象settings/bindings/subdomain/custom domain不変。Access/route/DNS変更なし。DB training-check-v12-local-man v7、PWA id /v12-local-man、Restore機能を維持。clear/reseed/migration変更なし。本番操作・Owner実データ/Backup操作・PR mergeなし。

## 残件・返却
BLOCKED BY: なし（B/C期待待ちは解消）。
WAIT FOR: Owner Android Chrome/PWA通常利用確認、QA所管の最終受入。PC結果はAndroid実測PASSではない。
RETURN TO: PMO（親分）／QA / Test→Owner。
OWNER ACTION: 同URL/PWAを閉じて開き直し、設定build c4fe4514を確認。実施済表示ONで未実施先/実施済先、Default/Optionを確認可能。実施状況が第2/3キーなら上位の曜日/部位が優先され、その同値内で方向が効く。再install/データ消去/再Restore/追加fixture/実Backup提出不要。古いbuildなら消去せず表示buildを返す。
