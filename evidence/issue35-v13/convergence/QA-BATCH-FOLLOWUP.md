# QA再指示の実測

基準はCI #42316438802（1726d8d）の通常105 PASS / 14 FAIL、release 34 PASS / 12 FAIL。前回の全件分類と固定V1.2比較は [CAUSE-BATCH.md](CAUSE-BATCH.md) および [batch-ci-before-after.json](batch-ci-before-after.json) を引き継ぐ。

| 項目 | 根拠と処置 | 実測と次担当 |
| --- | --- | --- |
| OIC-008/009/010/012 | TOP T-07。Session 2件、推奨Exercise 1種類。今日の期待値2箇所を2/1へ。曜日ボタンの現行表示にテスト操作を合わせた。T-08と後続期待値は維持。 | Windows Chromium。2/1、土曜選択、実施済ON、Extra 2行と初期行レイアウトを通過。月曜ON・土曜OFF後、実施済ONのまま期待2行に対し0行。OFF・非保存・reloadの検証には未到達。固定V1.2との同一条件での後続挙動は未比較。TechにH06 A3の適用範囲と現行のExtra表示条件の確認を依頼。 |
| V12-07 | Owner追加承認の±1pxを行高アサーション1箇所に適用。 | Windows Chromium PASS。基準57px、実測57px。14日、右寄せ、データ不変、行操作を通過。Linuxの従前58pxに対する修正後実測は新CI待ち。 |
| H-07 | Tech #6699787432、JSON交換仕様 §2/4/6/6.3/7。旧MenuProposalと現行TrainerProposalは別契約。 | manMenuProposal.test.ts 4件PASS。形式、ID/order、任意の時間項目、無効参照拒否、candidate適用時のactiveMenu維持を確認。非対象Master全体の不変を直接比較する検証や旧E2Eの代替としての十分性は未確認。旧E2Eの扱いはQA判断待ち。 |
| 残りの旧導線11件 | 前回の個別観測を引き継ぐ。 | 今回の修正・後続再測定は未完了。 |

対象Chromium実行は1 PASS / 1 FAIL。manMenuProposal、trainer、v13-projectionsの単体実行は29 PASS / 0 FAIL。正式TrainerPanel v1/v2の独立ブラウザ回帰は未確認。
