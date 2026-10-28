# V12-01 completionDirection diagnosis — Issue #30

RESULT: FAIL（Owner指摘をPC自動で再現）。実装修正はBLOCKED（PMO #6432524698指定の混在ソート設計/oracle確定待ち）。Owner GOは受領済み、再承認待ちではない。

Source: my-app da06f78f8021af1b72f174ce994d732da887123d / codex/issue30-local-adb、製品コード不変更。training-project最新origin/main a564ab3814ebab908ce8d7ddab9ac17ad30971ceをfetch・正式06§4.5/TEST_SPEC/TEAM_CASE§5確認。混在ソート禁止の旧契約が残り、是正仕様は未取得。

QA #6432486797 / PMO #6432524698に明示された期待だけをoracleとし、合成データの未完了Entry1＋Session1、実施済表示ON、completion第1キー/completeFirst、Default/OptionをPC1280/360pxで実行。4/4 FAIL。全ケースplannedY473、actualY535で、期待actualY<plannedYに反する。JSON・画像を保存。Owner画像/実Backupは不使用。

原因: CanonicalAppのsortEntriesには未完了Entryのみを渡し、actual Sessionを後続divに固定追加。既存sortDisplayRowsのcompletionDirectionには実績が渡らない。既知仕様を変えずに単なる二群反転だけを入れるとcompletion第2/3キーの上位キー優先を破るため実施しない。

設計/QAへの最小接続事項:
- SessionのrecommendedDay比較値は保存Session.dateの曜日か。menuEntryIdなしExtra、元Entry推奨曜日と実施日不一致も含む。
- 部位比較は予定current/実績snapshotを維持することと、snapshot欠損時の比較位置を明記。
- completion第2/3キー時は上位キーを優先する具体的混在ID順を提示。例：曜日が第1キーなら月の未完了予定と火の実績は、completeFirstでも曜日優先となることをどの値で比較するか。
- 同群内の既存予定3キー/実績日時順と、全体3キー辞書比較の適用境界・最終tie-breakを明記。
- Default/Option各方向×completion第1/2/3、OFF・片群0件、TOP/REGIONの具体的期待ID順をQAから伝達。

変更は再現test e2e/owner-v12-sort.spec.tsと当Evidenceのみ。test期待は実施済先を後ろへ合わせずFAIL保持。アプリbuild/新unitは未実行（製品コード不変更）。配信なし、本番・他Worker・Ownerデータ・PR merge不変更。現在検証build2f1cbfa4は既知NGのまま。

RETURN TO: PMO→設計所管/QA→Codex。WAIT FOR: PMOが先行指定した混在ソート契約と具体的受入期待。Owner再GO・再Restore/再install/実Backup提出は不要。設計受領後に実装修正・回帰・既存Worker反映。QA LIMITED／本番非GO維持。
