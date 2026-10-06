# H-14 temporary SW除外 / read-only診断

2026-10-06 JST、App Development実行。
RESULT: **実装・隔離automation・Staging automation到達性 PASS。Owner診断結果待ち。**

- Authority: H-14 Technical SW reachability resolution（Project `ee8606e`）とOwnerの実装・automation検証指示。前turnのtemporary Staging限定deploy許可を継続。
- Product: `118ff493838fa35aa0a80e88532d8731e4005c38`。Product source / canonical/legacy logic / schema / accepted distは変更なし。
- Temporary Worker version: `e9be1703-70eb-4bfe-9eb5-2d4acf7020c7`。
- Staging限定URL: https://my-app-staging.kzsakato-lab.workers.dev/__staging/diagnose.html
- 実装commit: `87edd58`。後続Evidence commitにはremote検証器のserialization比較修正・manifest byte数修正も含むが、deployしたWorker/shell/SW bytesは不変。
- 一時SW SHA-256: `1deab9e7e852380cc34fb8983cc8bb4a31e490847fec09b3202663a1bd9ad8af`。
- 診断shell SHA-256: `b896213101927b29c064c24daa114e0bd321d61f98c2d8984197aa75287a3440`。

## 境界

Staging専用artifact copyのSW navigation denylistへ固定path1本のみ追加。query付きpathや一般 `/__staging/*` は対象外。Product application sourceや他7配信fileはacceptedと同一。H-10の全8file一致をtemporary期間へ流用せず、`temporary-manifest.json` と `served-temporary.json` で証明する。

診断はpure validatorだけを含む独立shell。DB不存在ではopenしない。versionなしopen、upgrade競合時abort、既存store readonly transactionのみ。payload/raw error/validation issuesは出力せず、存在・version・authority・validation成否を最小summaryにする。POST/upload/telemetry、Product startup、prep、cutover、restore、storage書込み、SW操作なし。CSP `connect-src 'none'`。結果は端末DOMにのみ表示。

servedProductはWorker artifact宣言であり、直前のOwner Product JSの測定ではない。Product UI discriminatorを推測しない。Ownerの同一partition結果はまだ採取していない。

## 検証

- tooling TypeScript PASS / tooling unit **21 PASS**。
- local persistent legacy/canonicalの両profileで旧accepted SW controllerから開始。各1回の通常navigation cycleでtemporary診断へ到達し、各1回でaccepted SW復帰も確認。同じ2profile形状で再実行しても1回ずつで成立。
- 診断前後の全IndexedDB store / localStorage / sessionStorage snapshotの完全一致、SW controller/registrations/cache keys一致。診断中のmutation呼出し0、SW register/update/unregister呼出し0、診断GET以外の通信0。
- pristineはDB新設なし。read errorはSTOP。authority=trueのcanonical missing/invalidはrecovery-required。store欠損は非破壊missing扱い。payload sentinelはDOMへ出ない。
- 実Stagingは配信前の既存prepared automation profileから開始。通常navigationでtemporary SW→diagnosticへ到達し、2回の成功確認とも1cycle。更新前後の全storage serialization SHA-256 `0347cbf314813038b3c955040f92573f33ea4b02df2be1caa1770406ae3de821` 一致。診断前後はundefinedフィールドも含むdeep equality確認。mutation 0 / SW操作0 / requestは診断GETのみ。
- remote初回は検証器のbaseline JSON保存でundefinedプロパティが脱落し、raw object deep comparisonがFAIL。Product/storage不具合ではなく検証器の比較境界を修正。配信前baselineはserialized hash比較、診断前後はin-memory deep equalityで検証してPASS。初回FAILを到達性PASSとして数えない。
- HTTPSでtemporary全8file、shell hash/no-store/no-referrer確認。prep gateのauthorize/initializerは403、binding run/hash/expiryは空のまま。
- Production HTML/JS/CSS/manifest/registerSW/SW hash、Pages deployment `6828068757`、main `d4e5c09...` は配信前後一致。

Evidence: `local-evidence.json`, `remote-before.json`, `remote-evidence.json`, `temporary-manifest.json`, `served-temporary.json`, `pre-integrity.json`, `post-integrity.json`, `deploy.log`, `diagnostic.png`。

## Owner操作 / STOP

問題が出た同じAndroid通常Braveで通常Stagingを一度開き、10秒ほど待ってから上記診断URLを開く。「Staging read-only診断」「診断完了（変更なし）」が表示されたら、結果全文をコピーしてチャットへ貼り付ける。payload本文は含まれない。

通常Product画面・白画面・READ ERROR / STOPになった場合はそこでSTOPし、その表示だけ報告。再読み込み実験、cache削除、unregister、再prepを依頼しない。automationの通常更新成功をOwner端末の更新保証とは扱わない。

## 撤去待ち

Owner結果を受け取りPMOへ返した後、`tooling/staging/DIAGNOSTIC.md` の撤去手順に従い元の `wrangler.json` でaccepted dist / Workerへ復帰。診断route 403、accepted全8hash、automation通常SW復帰・全storage不変、閉じたprep gate、Production不変のEvidenceを返す。復帰までV1R Close HOLD。現在はtemporary診断のため**未撤去**であり、accepted H-10 artifact状態への復帰完了を主張しない。
