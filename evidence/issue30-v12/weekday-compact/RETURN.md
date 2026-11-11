# V12-04 Owner追加指定への対応（2026-10-27）

RESULT: PASS（本項目のPC自動検証・配信）。Android実機確認は未実施。V1.2全体QA LIMITEDは維持。

Authority: Issue #30 PMO #6431436266と今回Ownerの直接指示・添付例「プルダウンの縦幅を増やさない」。以前の専用操作行・44px操作高で増えた行を今回指定に従い解消。旧Evidenceは上書きせずowner-fixesに保持。

## 実装
src/v1r11.cssの曜日操作2selectorだけ。全ON/全OFFの100%幅専用行を解除し、コンパクトな同一行pairとする。360pxでは月〜金が1段目、土・日・全ON・全OFFが2段目。−1pt（14.6667px）とnowrapを維持。DOM順・選択動作・Data Contract・Restore・DB・PWA idは変更なし。

## 検証
型検査、Worker build、Wrangler dry-run PASS。対象Playwright PC/360px 2件PASS：panel最大2段、360pxで土日右に操作pair、文字−1pt、文字切れなし、全ON7/全OFF0、実施済checkbox不変。テストの従来「全曜日の下に専用行」oracleは今回Owner指定の2段配置へ更新。公開URLのPC/360px smokeもPASS、panel高PC83px/360px86px。360px画像はremote-360-weekday.png。公開10asset hash一致。他2 Worker、本番Pages/main、対象settings/subdomain/custom domain前後不変。

## 配信
URL: https://my-app-staging-v1r.kzsakato-lab.workers.dev/
Build/source: d4bbe3e86484e47b196f6cf42ad491305482438c
Version: dbf70697-97db-42a4-8fa0-2e9a0b7c5b9c (100%)
配信: 2026-10-27 10:48 JST
Push: kzsakato/my-app codex/issue30-local-adb
変更: src/v1r11.css、対象local/remote検証、当Evidence。その他仕様変更なし。

## 残件・返却
RETURN TO: PMO（親分）→Owner任意タイミングの目視。
OWNER ACTION: 同URL/PWAを開き直し、build d4bbe3e8で曜日プルダウンの2段配置を確認可能。再install・データ消去・再Restoreは不要。
V12-01原因未確定/未修正、V12-07形式判断待ちは前回RETURNから変更なし。OKの02/05/06再調査なし。本番release/PR mergeなし。Owner実データ・Backup取得/操作なし。
