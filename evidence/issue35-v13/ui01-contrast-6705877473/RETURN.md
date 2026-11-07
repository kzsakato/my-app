# UI-01 #6705877473 対照診断

Windows Chromium、Playwright 1.63.0、360×400、touch有効、mobile、Asia/Tokyo。各ケースで新しいcontextと合成DB。製品source cfe668b、実行head 1bd2a38。source差分なし。

| ケース | 結果 | 観測 |
| --- | --- | --- |
| T0 戻る | PASS | trusted click、設定へ遷移、canonical同値 |
| T0 ↑2回→保存tap | PASS | 変更済draft、trusted click、readwrite get/put、complete、設定へ遷移、保存後とreload後の全canonical一致 |
| T1 CDP drag→保存tap | FAIL | 正しいボタンにtouch到達、clickなし、画面維持、readonlyのみ、保存前後とreloadで旧canonical |
| T1 CDP drag→戻るtap | FAIL | 正しいボタンにtouch到達、clickなし、画面維持、canonical不変 |

A2。T1でdrag後にpointer capture解放を観測。キャンセルイベントやdefaultPrevented=trueは観測されず、ボタン中心のhitは一致。異なるのはCDP dragを経た系列で、クリック生成停止のブラウザ内部理由や実機での再現性は未確定。click対照は前回 #6705713850 を再利用。今回の測定はDOM/IDB観測で、React内部callback差替えなし。

最小のテスト対策案はtouch並べ替えの確認と永続化確認を分離し、永続化対照では実クリックまたはドラッグなし変更済tapを使う。純touchのT1はFAILのまま保持。実機での再現やブラウザ側の追加切り分けが必要かはQA/Tech判断。製品修正根拠はこの対照だけでは確定しない。

再現は repro.spec.ts.txt を e2e/issue35-ui01-contrast.local.spec.ts、playwright.local.ts.txt を playwright.qa2.local.ts に配置して実行。

    pnpm exec playwright test -c playwright.qa2.local.ts issue35-ui01-contrast.local.spec.ts --grep "isolated tap contrasts" --reporter=json

外側の検証spec成功は4ケースの計測完了を意味する。ケース別のPASS/FAILは contrast.json を参照。
