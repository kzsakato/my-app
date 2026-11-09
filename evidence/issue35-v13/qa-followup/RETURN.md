# QA／Tech follow-up — Issue #35

## H12
QA #6681979271 に従い、必須managementModeを持つfixtureをH12に限定して準備。欠損optionalを持つ旧Backup入力、Export、保存済みcanonical、正規化候補、apply後の独立IDB read-backを別々に記録。Export非破壊、無効入力非破壊、warningのack gateとダイアログ取消、明示承認後の全件・順序同値、legacy store不変、reloadを検証。TOP T-08は1 Session／2 active Entriesなので1/2を期待。旧2/2との差は正式TOP T-08の分子定義による。

同じテスト・Chromium・fixture・通常4173で、固定source c4fe4514とPR #9 28e8698の両方でH12 PASS。両snapshotの全factsは一致（生成時刻を含む外側envelopeとpayloadを区別）。PRのrelease configでも対象H12 PASS。固定V1.2製品artifactと製品ソースは未変更。

## 残存E2E
- run 42187660246 は通常64 PASS/55 FAIL、release 9 PASS/37 FAIL。代表比較で旧Trainer導線名のH12 SettingsとH13のRun行locatorは両基点で同様にFAIL。これらはこの比較ではhead固有と判定しない。
- V13追加ドラッグハンドルにより、既存混合ソート試験が各行からspanを2つ数え、移動回数を誤算していた。ラベルのselectorだけを限定し、順序、全件一致と保存/reload期待値を保持。QA AのDefault/Option 12パターンを再実行。
- Linux CIのV12-07行高57対58は、Windowsの対象成功とは分離し原因未確定。全残存ケースへの分類の一般化はしない。

## ENV-04/05
固定artifactを正先行で配信するとroot SWが副pathにroot HTMLを返し、DBは正のみ。比較では同じ固定ファイルを読取り、loopbackサーバーが返す親workerのNavigationRouteに副path denylistをメモリ上で追加。正先行で副controller、DB二系統、cache/manifest、Restore後の正の全store不変と副offlineを確認。env-fixed.json と env-diagnostic-denylist.json に固定・配信workerのSHA-256を収録。固定ファイル・正式配置・本番に書込みなし。これは修正親workerの合成診断であり、ENV-04/05はBLOCKを維持。
