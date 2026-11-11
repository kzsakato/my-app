# QA追補 #6700263964 の検証

基準CI #42323015517 は通常108 PASS / 11 FAIL、release 36 PASS / 10 FAIL。V12-07、OIC-008/009/010/012、OIC-011は既存確定結果を維持。

| ケース | 仕様と処置 | Windows Chromium |
| --- | --- | --- |
| H12 grouped | T-08はSession 1件／有効Entry 2件。R-15/RO-05は成功通知なし。TI標準値・履歴差分の永続化とSession不変を確認してから完了・取消へ。 | PASS。取消後とreloadまで。 |
| OIC-003/006/007 | R-05/R-12/RO-02。Session IDを選択し、旧独立カード非表示と現行Runの保存値・disabled・canonical不変を確認。 | PASS。故障、再試行、reloadまで。 |
| H06 A6/A7/A8 | S-13〜17/SO-02/07/15。現在のTI一覧とMAN付きfixtureでゼロ既定値、入力検証、画面離脱時のエラー消去を再実行。 | PASS。 |
| D-03/OIC-016 | S-08/09/11/SO-05/11。種目一覧の名称と現行既定部位順を使用。 | PASS。空白拒否・保存・非表示と再表示・reloadまで。 |
| PRESERVE Profile | S-04〜06/S-14〜17/SO-03/07。TI選択を修正し、保存完了をSettingChange件数で待つ。 | PASS。失敗時の不変、再試行とreloadまで。 |
| PRESERVE list | S-13/SO-02/11/15。既存部位フィルターと一覧行、正規MAN fixtureで検証。 | PASS。表示状態、Menu guard、キャンセルまで。 |
| Run read-back | RO-04・共通§2.2。書込み1回、transaction complete、独立readonly getの注入を個別観測。 | PASS。編集停止、再試行不可、保存済Sessionをreload後に確認。 |

旧契約のH-07・D-01・QA-C01（2 variants）は既存テストを保持。交換仕様§2／TR-02/04／TRO-01〜04により旧MenuProposal用検証を現行Trainer v1/v2の証拠に流用しない。現契約へのケース別独立ブラウザ再マップは未完了。今回の修正後に固定V1.2との同条件比較は未実施。
