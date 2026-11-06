# Issue #35 §7 Codex 中間RETURN

Owner GO: https://github.com/kzsakato/training-project/issues/35#issuecomment-6679255155
Scope FIX: https://github.com/kzsakato/training-project/issues/35#issuecomment-6676959284

基点は承認済みV1.2製品ソース c4fe4514ab093a9e2084dc286310d46f81ab8864。
origin/main 90552c9 の release/c4fe4514-v1.2-production/README.md が製品ソースを固定し、main側は固定成果物と配信接続の反映のみと明記。候補PR #6/#8は作業基点・受入結果に採用していない。

| Scope / QA ID | 事前期待値 | 実装・観測 | 結果 |
|---|---|---|---|
| V13-01 / UI-01 | Defaultの末尾キーを先頭へ移動、Option不変。戻るで破棄、保存後に再表示 | DisplayPreferencesEditor、360px Chromiumで実操作 | 実施した観測はPASS。タッチscroll、keyboard/focus、独立DB read-back未実施 |
| V13-02 / UI-02 | 固定文言が行内にあり、説明箇所のクリックで遷移 | CanonicalApp、360px Chromiumで実操作 | 実施した観測はPASS。拡大文字未実施 |
| V13-03 / UI-03 | 固定確認、標準値と管理OFFの保存確証、失敗/取消/UNKNOWN境界 | 未実装 | NOT_RUN |
| V13-04 / ENV-01–05 | 同一originの実build正副、SW/IDB/cache/manifest非干渉 | 未実装 | NOT_RUN |
| V13-05 / CTX-01–02、PR-01–06、MIG-01 | Context全件・元lifecycle、原子保存/独立read-back、隔離初回Restore | 未実装 | NOT_RUN |
| V13-05 / AN-01、AN-G01–07 | 独立AX-01 oracle。週PT 36/530、計566、D7/U3/T10。登録後D10/U0、PT不変 | 未実装。下記fixture矛盾。実plot/PNGなし | NOT_RUN |
| V13-06 / UI-04 | 行末装飾なし、14マーカー、行から既存Runへ遷移、360px | CanonicalApp、360px Chromiumで実操作 | 実施した観測はPASS。IDB全件比較やfilter/sort網羅は未実施 |
| F-5 / IDX-01 | 合成Aの固定形式、全ID・元lifecycle・参照と投影の整合 | 未実装。private live read未実証 | NOT_RUN |

## 合成fixture契約の衝突

QA TEST_SPEC §5A AX-01 は ex-Z の全6部位の率が0である状態を健全ZEROと記述。
正式 Data Contract v1.0 §2 は6値の合計を厳密に100とし、全0率を明示的にINVALIDとする。0+0+0+0+0+0=0。分析03のZEROは正常な記録なし・計算結果0。影響はAX-01の入力妥当性、AN-G01–07での健全/異常判定と画像、および同一fixtureをContext v2へ流用した場合のCTX-02全Export拒否。QA/Dataに、ex-Zを合法な率＋実績なしへ置換するか、全0率を独立した破損variantへ移すかを判断依頼。現行期待値・契約は変更していない。数値表の36/530/566に算術不一致は確認していない。

## 実行

Windows / Node v24.21.0 / pnpm 12.6.0、loopback、合成canonicalのみ。
- pnpm test: 163/163 PASS。
- pnpm build: tsc / Vite / SW生成 PASS。
- pnpm exec playwright test e2e/issue35-v13-ui.spec.ts: 2/2 PASS。
- 初回のUI試験はcanonicalの合成seedが不足。既存owner-v12-07.spec.tsはcandidate DBを参照するため、通常viteではstoreがなく起動失敗。新ケースは実際の通常ビルド系DB名に合成seedを明示。既存試験・期待値は変更していない。
- この差分はレビュー用の途中成果。製品QA、実機、正副非干渉、最終受入の証拠は未取得。
