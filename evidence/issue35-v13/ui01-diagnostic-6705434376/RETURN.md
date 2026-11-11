# UI-01 診断1shot #6705434376

対象製品 cfe668b8903ad9e41c2b4e7189762cdcb73e09c3。Windows Chromium、Playwright 1.63.0、隔離合成DB、360×400 touch、Asia/Tokyo。診断用specを e2e/issue35-ui01-diagnostic.local.spec.ts に複製し、既存のローカル設定 playwright.qa2.local.ts（Vite :4188）で次を1回実行。

    pnpm exec playwright test -c playwright.qa2.local.ts issue35-ui01-diagnostic.local.spec.ts --grep "touch handle reorder" --reporter=json

初回drag後「1 部位」、Option不変、scrollY維持を通過。戻るtapはPlaywright上で送出完了し、直後の独立DB読取りはfixtureと全等値。次の「表示設定」ボタンを待ったところで30秒timeout。保存tap、save対象のonClick、commit、validation/rebase/revision、保存後read-back/reloadの測定へ未到達。計測用リスナーは保存直前に設置する構成のため、今回の停止点におけるDOM click受理を直接確認していない。

分類はA候補（保存前の画面操作条件不成立）およびD（前回保存FAILの原因はUNPROVEN）。戻るtap完了はアプリのroute変更を証明しない。B/Cを判定できるcommit証拠なし。前回の保存FAILと停止点が異なる。再試行なし。trace.zipとresult.jsonに停止点、repro.spec.ts.txtに計測定義を保管。
