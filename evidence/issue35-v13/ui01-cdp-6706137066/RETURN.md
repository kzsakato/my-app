# UI-01 C1–C3 #6706137066

製品source cfe668b、実行head cf4d698、src差分なし。Windows Chromium／Playwright 1.63.0、360×400、mobile+touch、Asia/Tokyo、各ケースで独立context／合成DB。

| ケース | 結果 | 根拠 |
| --- | --- | --- |
| C0 CDPなし | 既存PASS | #6705911642 T0戻るtap。 |
| C1 CDP静止 | PASS | 非操作領域で移動なし。scroll 41→41。戻るtapでclick発生、設定に遷移。JSONのend座標はC2比較用の計測点でC1では送出していない。 |
| C2 CDP移動・非ハンドル | FAIL | section上を88px移動、touch-action auto、scroll 41→114、pointercancelあり。戻るボタンにtouch/pointerは到達したがclickなし、画面維持。 |
| C3 CDPハンドルドラッグ | FAIL | 88px移動、touch-action none、scroll 41→41、pointercancelなし、capture解放あり。Default並べ替え、Option不変。戻るtapにclickなし、画面維持。 |

全ケースでcanonical不変。C1/C2は同じ非操作領域の同じ開始点。C2/C3は同じ移動量でも領域・touch-action・scroll・pointercancelが異なる。C1 PASS／C2 FAILを根拠に、CDP移動ジェスチャー後の入力系列を優先調査対象とする。ハンドルの明示capture／React並べ替え、実スクロール、pointercancelのいずれも、今回観測した失敗の共通必要条件ではない。ブラウザ内部のclick生成条件、実機挙動、製品側の寄与は未確定。

最小案（テスト）：tapのclick／routeを明示assertし、CDPドラッグ検証と永続化対照は独立contextへ分ける。純touch結果はFAILを保持する。製品：現時点の差分案なし。実機または一貫したtouch入力経路で再現してから、製品修正の要否を判断する。救済クリックや追加試行は未実施。

再現は repro.spec.ts.txt を e2e/issue35-ui01-cdp.local.spec.ts、playwright.local.ts.txt を playwright.qa2.local.ts に置く。

    pnpm exec playwright test -c playwright.qa2.local.ts issue35-ui01-cdp.local.spec.ts --grep "CDP gesture contrasts" --reporter=json

C2/C3のsoft assertionで実行はexit 1。各CASEのイベント列とDB比較は contrast.json。
