# H-20261006-10 Q5 QA PASS candidate Staging再投入

実行: 2026-10-06 JST / App Development。
RESULT: **配信・通常remote検証完了。Owner visible checkpoint / Q5最小MAN待ち。Owner Android確認済みとは扱わない。**

- Authority: Project GitHub `12f3f7f` のH-10、H-09 QA PASS、AI_BRIEF v20、H-20261005-08。
- URL: https://my-app-staging.kzsakato-lab.workers.dev/
- Product: `118ff493838fa35aa0a80e88532d8731e4005c38`
- visible Build: `2026-10-06 / 118ff493`
- Worker version: `bc703b36-1eaa-41e2-acfc-acdd40092016`
- Tooling advancement: `1e5434d`、branch `codex/h-20261006-10-staging`。
- Gateは全期間CLOSED（run/hash/expiry空）。新run発行・initializer実行・Owner storage操作・reset/reprepなし。

## Evidence

1. 更新前の同じautomation profileで旧Build d34b3927のcanonical discriminator、prepared全state、reload/restartを確認（`pre-update.json`）。Owner Android partitionとは別物。
2. Product sourceは118ff493から差分なし。全8fileがH-09 accepted manifestと一致。Worker/client/prepare/wrangler runtimeは174398fから差分なし。initializer bytesも更新前後で同一（SHA-256 `02bc088861ea0add5cb9705e75af6e93e9b97094dde73e81ab5f334690e137d1`）。tooling build / TypeScript PASS、unit 20 PASS。
3. `deploy.log` にstable Worker identity、空gate、versionを記録。`served-artifact.json` は全8fileのHTTPS配信SHA-256一致。Productは再buildせずQA済みartifactを配信した。
4. `update-evidence.json` は同じpersistent automation partitionの新Build・canonical discriminator・同origin root SWを確認。全canonical/baseline/authority/receiptの更新前後一致hash `323e4c462d8ffd20a51dada4c77b312b038288cea99be0e7538462b81321b8d9`。IndexedDB writes 0、準備経路request 0。
5. `post-update.json` は全配信hash、旧Owner tokenのauthorize/initializer 403、非公開path 404、Monday control、active menu、reload/browser restartの全state一致を確認。旧tokenをHTTP失効確認にだけ使用し、Owner runをautomationで実行していない。
6. `pre-integrity.json` / `post-integrity.json`: ProductionのHTML/JS/CSS/manifest/registerSW/SW hash、Pages deployment `6828068757`、main `d4e5c09b1dd3119d58a3d8e6c4fc74e907e4a288` が一致。Production deploy/mergeなし。

## 更新直後の失敗と制限

初回update確認は `updated canonical discriminators`、次の通常検証は `Build` でFAIL（`update.log`, `remote.log`）。HTTP artifactは新candidateに一致したが、既存browserは旧JSを使用していた。

同じprofileで30秒間のread-only観測を行った（`sw-observation.json`）。cache削除、SW unregister、registration.update、fixture再投入、storage resetはしていない。その後の再起動・通常reloadで新Buildを確認し、`update-retry.log` / `remote-retry.log` がPASS。厳密なSW切替時刻・遅延原因は未特定。「どの端末も1回reloadで即時更新」とは保証しない。

Owner既存partitionはH-11 PREPAREDと通常画面全項目OK、その後H08 candidateのQABox確認履歴がある。今回のProductはprojection修正でstorage契約変更なし。以上から再準備を要求せず、同じAndroid通常Braveでのvisible確認から進む。ただしPC/automation PASSはOwner Android PASSの代替ではない。

## Owner最小手順（visible条件成立後のみQ5 MAN）

1. 前回と同じAndroid通常Braveで上記URLを開く。既に開いていれば通常reloadを1回。設定でBuild `2026-10-06 / 118ff493`、トレーナー連携あり・legacyカテゴリなし、既存メニュー/データが残ることを確認。
2. 元Q5の同一種目「ダンベルプレス重」「ダンベルプレス軽」の確認用実績を各1件用意する（既に確認用実績があれば使用。必要なら通常操作で重を実施、軽は追加トレーニングから実施）。不要に他の記録を取り消さない。
3. カテゴリ「胸」で「実施済も表示」ON。重・軽がそれぞれ自身の名称とactualで開くことを確認し、対象の重の確認用実績だけを取り消す。戻り後は必要に応じ同checkboxをONにする。軽が独立して残り、軽自身のactualへ開け、重名の行に軽actualが付かないことを確認。
4. 推奨曜日表示でもONで軽が自身の名称/actualで参照できることを確認。通常reload後、両modeでONにして同じ軽実績が維持されることを確認。確認用実績以外の広範な探索MANは不要。

成功報告: `Build一致・既存データOK・Q5 OK`。
STOP条件: Build不一致、legacy画面、既存データ欠落、軽の消失/別名alias/actual不一致/取消対象不一致/保存エラーのいずれか。そこで操作を止め、該当項目（Build不一致なら表示Build）だけ報告。cache/site data削除・再install・準備リンク再実行・Owner shell/Git診断は求めない。

RETURN TO: PMO / Owner。Owner結果後にPMOへ返す。Production releaseは引き続き未許可。
