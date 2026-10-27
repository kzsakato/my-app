# V12-01 混在3キーソート — 部分実装・QA疑義RETURN（2026-10-27）

RESULT: BLOCKED（Fixture B/C受入期待の疑義待ち／Worker再配信は保留）。独立した修正・回帰はPASS。Owner GOは受領済み、Ownerの再承認待ちではない。

## Authority / source

Issue #30 QA #6433103067、Technical #6433073812、正式SoT e30edcb9/d6732ce8/f9b653bc、TEST_SPEC cbafbcea48444ebb3f99496f35691af6e950121eを実取得。開始時app c39c4d715c56ebc3b2aefd3317bab761a8bdf6a6、branch codex/issue30-local-adb、clean。Project repoとの区別を維持。受領時の疑義はIssue #6433178544 / #6433217673へ先に返し、独立部分は継続した。

## Implemented

Product filesは src/CanonicalApp.tsx / src/canonical/topProjection.ts のみ。filter後の未完了Entry＋個別Sessionを単一配列へ投影し、Default/Optionの3キーを辞書式比較。曜日はEntry推奨/Session保存date、部位はcurrent/snapshot、completionはEntry未実施/Session実施済。方向はcompletionだけ反転。完全同値は名称→種類→stable ID。Entry/Session別配列の固定連結・混在一覧へのSession日時割込を除去。3キーはREGIONでも同じ比較器を適用する。

各行は既存render/押下を維持、React keyは種類をprefixにし異種ID衝突を防ぐ。新規control・表示項目・CSS・折りたたみなし。表示集合/既存filter/completion判定/canonical/保存/Backup/取消本体/独立履歴の実装は変更なし。

Source commit: 7d9a42aa55a5a33731404b5aec40cf683257aac3、push先 kzsakato/my-app codex/issue30-local-adb。
Tests/helpers: e2e/mixedSortFixtures.ts、owner-v12-mixed.spec.ts、owner-v12-sort.spec.ts、canonical/mixedTopSort.test.ts、mixed configs。既存01/07/issue30テストは正式な混在比較への変更とEvidence別保存に限定更新。旧FAIL Evidence mixed-sort-diagnosisは保持。

## Evidence / validation

- QA Fixture A 12設定（Default/Option×completion第1/2/3×両方向）をPC1280/360pxで実施。設定UIの変更→明示保存→再読込、他方定義保持、Option初期OFF、TOPの期待ID順・実際Y座標、REGION胸/背中の同じ比較器による部分列、OFFのEntryのみ、canonical不変を確認。
- Fixture Dの両方向/両定義、同キー・同名のEntry/Session各ID保持、特定Session取消/非対象不変/reload。Sessionのみ・空集合、曜日月/火/全OFF。対象E2E38＋追加8＝46件PASS。
- 前回01/07/接続回帰16件PASS。予定/実績二重表示解消、正常Restore後の複数Session、残存当週Sessionのcompletion維持、最後の取消後の予定再表示、再実行・保存値不変、EXTRA除外/14日右寄せ/行高57pxを維持。旧Session日時順のassertionは正式な新契約による順へ変更し、そのAuthorityを明記。
- E2E計62件PASS。results.json（38件）、regression-results.json（16件）、追加8件はコマンド `pnpm exec playwright test --config playwright.v12-mixed.config.ts --grep 'no phantom' --reporter=list` でPASS。写真/設定/期待・実測ID順を保存。
- 旧4/4 FAILの同じ受入期待が4/4 PASSへ。過去FAIL JSON/画像は上書きせず、今回reproduction/へ出力。
- Unit19 files/159件PASS（既存144＋混在比較15）。QA A固定6期待順×両定義、QA C比較器単体、D ID順、Technical同キーSessionの名称/ID優先・日時非優先を確認。Cの画面filter期待/Bの食違うID表をCodexだけで確定したPASSではない。
- typecheck / Worker build / Wrangler dry-run PASS。committed source SHAを埋めたローカルbuild10asset inventoryをartifact.jsonに保存、deployed=false。

## BLOCKED BY / WAIT FOR

1. Fixture B：QAコメント #6433103067 の同曜日/同部位・completion第3のU順 E-10,S-10,E-20,S-20 と、正式TEST_SPECの E-10,E-20,S-10,S-20 が不一致（Dも同様）。技術契約は3キー→名称なので後者と一致するが、Codexで一方を自己承認しない。TEST_SPEC B説明の『表示名を先に比較するため』も同段落の比較順と不整合。QA/Technicalで期待IDと説明の訂正/確定を要する。
2. Fixture C：比較前配列はE-A,S-X,S-M,E-Nで確定。一方既存TOP曜日filterはrecommendedDay未設定E-Nを全曜日ONでも除外し、REGION胸は曜日で絞らずcurrent部位一致のE-A/E-Nを表示する。QA表の『TOP E-N含む／REGION胸E-Aのみ』が比較器単体の例か画面例か不明。既存filterを変更せず、QA/Technicalへ画面期待を返している。

上記B/Cは未実施/判定保留として、62件PASSで全QA受入完了を主張しない。疑義解消前に受入不明の比較器を既存Workerへ配信しない。新しいOwner採否・新Gateは要求しない。

## Deployment / return

Deploy: 未実施。read-only GETで現在検証Workerのsourceは2f1cbfa473f91c4058234cf9c4b56f57cf14551eのまま（current-worker-readonly.json）。新しい公開版/Android PASSは主張しない。本番・他Worker・Access/route/DNS・Owner実データ・PR mergeは不変更。
RETURN TO: QA / Test＋Technical Advisor（疑義解消）→Codex（B/C回帰と既存Worker反映）、PMO。
OWNER ACTION: QAへ「Issue #30のCodex疑義 #6433178544 / #6433217673 のB/C期待を訂正・確定しCodexへ連携」で既存Roleを起動。Owner再承認・画像/Backup再提出・再Restore・再install不要。QA LIMITED／本番非GO維持。
