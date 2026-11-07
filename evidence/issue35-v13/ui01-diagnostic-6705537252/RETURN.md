# UI-01 #6705537252 原因特定

Source cfe668b8903ad9e41c2b4e7189762cdcb73e09c3、実行head d7e7fcf1a7ba3cba8364205babe589cd5d8c1572。Windows Chromium、Playwright 1.63.0、360×400 touch、合成canonical。

再現は repro.spec.ts.txt を e2e/issue35-ui01-followup.local.spec.ts、playwright.local.ts.txt を playwright.qa2.local.ts として配置。

    pnpm exec playwright test -c playwright.qa2.local.ts issue35-ui01-followup.local.spec.ts --grep "touch handle reorder" --reporter=json

1本完走。Default/Option全draftと方向、無効/pendingなし、scrollY・取消時DB不変を確認。戻るtap (27,17.75) と保存tap (180,347) はいずれもhit target一致、trusted pointer/touch down/up/endまで。DOM clickは観測されずroute不変。保存tap後はreadonly読取りのみで旧順。戻るを実クリックにすると設定へ遷移し、保存を実クリックにするとreadwrite get→put→transaction complete、設定へ遷移、警告なし。保存後とreload後の全canonicalは期待と同じ。global revisionは通常合成DBに存在せず前後とも欠損。

分類A。観測した失敗はブラウザ入力からclickが成立する前。実クリック対照の書込み・遷移・read-backから製品の保存経路はこのfixtureで成立。React内部spyは設置フラグtrueだが対照clickでも記録されず、直接のcallback/commit戻りやguard/rebase内部値は未観測。touch直後のclickが生成されないブラウザ側の詳細条件と実端末への一般化は未立証。最小のテスト手順案はtouch dragを維持し、保存の永続化を別に確かめる場合に戻る・保存を実クリックしてrouteとread-backを待つこと。touchのみで保存できるという合否への転用は不可。
