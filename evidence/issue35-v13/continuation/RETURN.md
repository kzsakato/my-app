# Issue #35 §7 製造継続 RETURN

実アプリ・合成データのみ。V1.2基点 c4fe4514ab093a9e2084dc286310d46f81ab8864。実build c0d4258b1eff7bd9ecb72bf7966daa7aae4fbd83、360px対象回帰 3dbbe25。通常・副buildはlocalhost。

| QA ID | 事前期待値 → 実装・実測 | 結果 |
|---|---|---|
| UI-01/02 | キー順序とDefault/Option独立、戻るで破棄、保存、固定文言、行tap。Chromium 360pxでmouse/タッチドラッグ、keyboard、拡大説明の幅を確認 | 対象PASS。タッチスクロールとの競合全般、設定の独立IDB全件比較は未完 |
| UI-03 | TRAINER予定Runの固定確認、取消で全canonical同値。確定後weight 18→19、MAN、履歴1件、Session全件同値を別read transactionで確認 | 対象PASS。保存前故障・当該UIのUNKNOWN fault試験は未完 |
| UI-04 | 装飾なし、14マーカー、360px、既存TIのRun、旧V12-07の全件同値・行高 | 対象PASS。組合せfilter/sort網羅は未完 |
| ENV-01–05 | root V1.2固定build、副 /v13-test/ 実build。副先行の合成順序でDB二系統、SW scope/script/controller、cache名、manifest、offline、root全store不変 | 部分PASS。正先行初回副遷移FAIL_PARENT_FALLBACK。副初期化・削除・更新や正先行の包括非干渉は未証明 |
| MIG-01 | outer1拒否は変更0、合成outer2 preview/明示承認後に初回Restore。別transactionで全payload・marker。post-commit read-back故障で固定警告、reload後もHELD | 対象PASS。fault matrix、旧fixture変換由来の全件比較は未完 |
| CTX-01/02 | Context v2実download、unitで元lifecycle・任意activeMenuId・不正全0率/出自不明の拒否。実fixtureのSession ID/版を照合 | 対象PASS。100日境界と全破損variant網羅は未完 |
| PR-01–06 | 3対象一括、global 0→1、各target revision1、ledger1件、全件read-back、再適用と不正混在batchの変更0。追加初回率で腕3、Session/snapshot不変 | 対象PASS。別tab競合、全writer fault injection、marker解除故障は未検証 |
| AN-01 / AN-G01–07 | AX-01合法ZEROは胸100%＋実績なし。週末尾PT 36/530、計566、D7/U3/T10。AX-01bはPT不変、腕3、U0。unitで5期間×12bucket、実週画面で7系列と腕内訳のDOM照合、実build PNG | 対象PASS。全境界・異常・描画状態網羅、独立QA/Owner目視は未完 |
| IDX-01 | 合成Context raw bytes SHA-256、format/version、全IDと各TI最終実施日をテスト内でAへ投影 | 合成投影部分PASS。再利用判定全variant・次Trainer BODY live read未実施 |

画像は週表示の変更前後2状態。いずれも360px、Asia/Tokyo、2026-11-06、実build c0d4258。AX-01は⑤胸、AX-01bは⑤腕。5種類の描画に加えU消失・腕3を比較できる。SVGの入力値と内訳meterを自動比較。重なる系列の目視・描画位置の全点測定は未実施。QA原文の週初値表記1=月曜に対し、製品canonicalの既存契約0=月曜を合成fixtureに使用し、期待暦境界と数値を保持した。

## CI切り分け

- 同一通常Playwright config/seed/PORTでc4fe4514とa196caaの代表3件を比較。candidate DBのstore不足、4182未起動、H12 BackupでのdisplayPreferences追加を再現。追加元はV1.2時点のpreviewCanonicalRestore正規化。全件比較アサーションは維持。
- 固定candidate DBを明示する既存specは4177の既存candidate buildに接続。4182は既存worker test build/専用server。V12-07は既存360pxベースラインを該当viewportで使用。skipなし。
- unit 166/166、通常build・副build PASS。対象E2E 6/6 PASS。release E2E先行ローカル実行は9 PASS / 37 FAIL。未分類失敗を全て製品回帰または基点由来とは断定しない。
- Actions run 42187281000 は記録時点で実行中。通常E2E失敗時もrelease build/試験のEvidenceを収集する構成へ修正。

## 限定BLOCK

固定V1.2 root SWが副path初回navigationを捕捉してroot HTMLを返した。parent-first.json参照。副起動ガード以前で発生。固定V1.2 artifactは保持。Tech直接照会 https://github.com/kzsakato/training-project/issues/35#issuecomment-6680448499 。副先行の成果はこのBLOCKを解除しない。
