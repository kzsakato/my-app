# PMO #6704739519 — 最小一括shot

Windows Chromium、Playwright 1.63.0、合成データ、隔離V1.3実build。製品sourceは1426e2cと同一。元の現行CI #42353938760 とOwner目視済み画像を再利用。結果と停止点は results.json。

- AN-G05 D0/U3 PASS。割合帯なし、未配賦3、未設定通知、ZERO表示なし、DB不変。新状態の代表PNGは AN-G05-unallocated-360.png。UNAVAILABLE実画面はUNPROVEN。隔離canonical入口が破損を拒否する既存証拠と投影unitを継承し、診断境界を迂回した画像は作成していない。
- AN-G06 PASS。週始まり0/1それぞれ年跨ぎ5期間×12bucket×7系列。手計算PT 50/件、年境界、期間前・未来除外、今期途中。実plotとoracleは AN-year-boundary-0/1.json。
- AN-G07 観測した軸ラベル、凡例、12点の代表座標PASS。AnalysisChartはhover tooltipを描画しないためtooltip実画面UNPROVEN。全点・全画素の座標判定は範囲外。
- CTX-02 v1構造をversion 2としたファイルを唯一のTrainerファイル入力に投入。wrong-format通知、previewなし、downloadなし、全canonical/cutover同値PASS。この画面にはContext専用importは存在せず、v2 Export経路の別検証とは区別。
- UI-01 touch×scroll FAIL。360×400、スクロール済み設定画面。Defaultのみreorder、scrollY維持、cancel不変まではPASS。再操作して保存をtapしたが、5秒poll後もcanonicalは初期順。書込みが見えず、再読込みassert未到達。入力イベントと永続化の根本原因は未確定。再現patchを保存し、現行必須suiteの定義は変更していない。適用後の再現コマンドは pnpm exec playwright test e2e/issue35-v13-ui.spec.ts --grep "touch handle reorder"。この再現の操作条件では表示順を保存できなかった。実データ損傷を示す観測なし。
- 固定V1.2比較 PASS 2/2 対2/2。c4fe4514と1426e2cで同一Playwright・clock・360px・fixture・server port 4196。V1.3固有文言とglyph期待を比較専用コピーから除外。dragではなく両版の「部位を上へ」を2回使用。Default/Option、取消、保存後全canonicalとreload、追加一覧filter/sort、14日表示、Run遷移、DB不変を比較。
