# H-14 temporary read-only診断

Product source / accepted distは変更しない。`build-diagnostic.mjs` がaccepted manifestを検証し、`.generated/diagnostic-dist` にコピーする。変更は `sw.js` の固定path `/__staging/diagnose.html` のnavigation denylistだけ。query付きURLや一般 `/__staging/*` は除外しない。診断shellはWorker text moduleであり、Product precacheへ含めない。

`diagnostic-client.ts` はpure validatorのみをbundleし、Product startup / storage adapter / initializerをimportしない。IndexedDB enumerationでDB存在を確認してからversionなしopen。競合によるupgradeはabortする。既存3storeのreadonly transactionのみ。存在・version・validation成否・authority分類を表示し、payload/validation issue/raw errorは出力しない。診断pageから通信しない（CSP connect-src none）。SW登録/更新/解除やWeb Storage書込みもしない。

servedProductはWorkerとともに固定されたartifact宣言であり、Ownerが直前に実行していたProduct JSを採取したものではない。UI discriminatorも推測しない。結果にはこの制限を明示する。

## build / verification

```powershell
node tooling/staging/build-diagnostic.mjs
pnpm exec tsc -p tooling/staging/tsconfig.json
pnpm exec vitest run --config tooling/staging/vitest.config.ts
node tooling/staging/verify-diagnostic.mjs
```

local検証は隔離persistent legacy/canonical profileで旧accepted SW→temporary→accepted復帰を通常navigationだけで検証する。全store/Web Storage snapshot一致、診断中SW/cache不変、書込み/登録操作0、networkは診断GETのみを確認。pristine no-DB、read error STOP、canonical欠損/不正、store欠損も対象。

## Stagingのみ配信

```powershell
node tooling/staging/verify-diagnostic-remote.mjs before
npx --yes wrangler@4.147.0 deploy --config tooling/staging/.generated/diagnostic-wrangler.json
node tooling/staging/verify-diagnostic-remote.mjs after
```

remote検証は既存automation profileを使用し、Owner partitionを検査しない。beforeのraw snapshotはignored `.generated/*.local.json` にのみ保存する。共有EvidenceにはSHA-256と最小診断結果のみ。

temporary SW配信中はH-10全8hash一致を流用せず、`diagnostic-manifest.json` との配信hash一致を検証する。他7fileはacceptedと同一。prepare gateは閉じたまま。

## 撤去・accepted artifact復帰

Owner診断結果を受領してPMOへ返した後、V1R Close前に必ず実施する。Owner storage修復とは別操作。

1. accepted `dist` が `evidence/h-20261006-09/build-manifest.json` 全8hashと一致することを確認。Product sourceが118ff493から変わっていないことも確認。
2. `npx --yes wrangler@4.147.0 deploy --config tooling/staging/wrangler.json` を実行。元のWorker entrypointとaccepted distへ戻る。prep gateは空のまま。
3. HTTPで全8fileがaccepted manifestと一致し、`GET /__staging/diagnose.html` が403で診断shellを返さないことを確認。新Worker versionを記録する。
4. automationで通常起動/再読込によるaccepted SW復帰を確認。storage snapshot不変、同origin SWを確認。forced update/unregister/cache clearを使わない。`node tooling/staging/verify.mjs revoked` で通常canonical/readback/restart・閉じたgateを再検証する。
5. Productionのhash/deployment/main不変、temporary page撤去、accepted SW hash復帰のEvidenceをH-14へ返す。未復帰ならClose HOLD。

配信直後のautomation到達性がFAILした場合も、この復帰手順を実施しOwnerへURLを渡さない。temporary URLがProduct画面/白画面を出した場合、Ownerへ反復reload・削除等を依頼せずSTOPとして返す。
