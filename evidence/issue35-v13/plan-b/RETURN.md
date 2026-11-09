# Issue #35 — 案B合成loopback限定実証

実施日 2026-11-06 JST。Authority は [Tech限定実証GO](https://github.com/kzsakato/training-project/issues/35#issuecomment-6682741856) と [§7既存GO](https://github.com/kzsakato/training-project/issues/35#issuecomment-6679255155)。QAのENV-04/05事前期待値を参照。判定対象は合成fixtureを用いた配置の技術実証。

## 実測結果

|ケース|結果|証拠|
|---|---|---|
|固定V1.2無改変配信|PASS|source `c4fe4514ab093a9e2084dc286310d46f81ab8864`。配布物の記録commit `ecc760c`。公式inventory全8ファイルのサイズ・SHA-256とHTTP配信バイトのSHA-256を照合。SW SHA-256 `ea2611aad2dbac4e11add67e330c15d428f8dc8b110906d812ca15aa58536115`。|
|新規profile・正先行・副への初回直接navigation|PASS|正 `/my-app/sw.js` が `/my-app/` を制御した後、副HTMLとJSがHTTP 200、fromServiceWorker=false。副 `/v13-test/v13-worker.js` が `/v13-test/` を制御。manifest start/scope、JS asset URL、DB名、cache URLと登録scopeを実測。|
|副の合成Restore / Proposal / Context / 分析|PASS|旧envelope拒否、明示承認後のRestore独立read-back、Proposal全件read-back・再適用・不正batch、Context v2、AX-01/AX-01b数値を今回の兄弟prefixで再実測。保存read-back故障のUNKNOWN_HELDとreload後保持は同じ配信先の別の合成browser contextで実施。|
|正の全storeと正副の再起動|PASS|副初回前に正へ合成canonicalとrecovery sentinelを投入。独立readonly transactionで全storeのキー・全値・配列順を比較。正→副のonline reload、副→正のoffline reloadとも制御・副保存値・正の全store不変を確認。正のsnapshot 3本のSHA-256は `1fc0d6f2a95fdc36c4c80593b0f72285723cd8770f744035b0ddf43bf114b36e`。cache entryとSW登録も再照合。|
|旧root scope workerを保持した別profile|FAIL|固定workerを先にroot scopeで実際に登録。正の兄弟prefix workerがactiveでも、副初回navigationを旧root workerが捕捉し、HTTP 200/fromServiceWorker=trueで旧HTMLを返す。副DBは未作成。後続Restore等はNOT_RUN。SW unregisterやstorage消去は実施していない。|

[fresh.json](fresh.json) にscope・DB・cache・配信とreloadの実測値。[legacy-root.json](legacy-root.json) に互換variantの実測値。[primary-before.json](primary-before.json)、[online後](primary-after-online.json)、[offline後](primary-after-offline.json) に全storeの合成snapshot。固定正のDBは `training-check`、副は `training-check-v13-test`。

## 再現

Windows、Node 24.21.0、pnpm 12.6.0、Playwright 1.63.0、Chromium 153.0.8010.12。製品コードは PR #9 の `f3ed05d109b275b020e75e4e60c87f9bd222f024`。TypeScript buildおよびVite副実build成功。以下はPowerShellでリポジトリ直下から実行。

```powershell
git worktree add --detach ../fixed ecc760c
pnpm install --frozen-lockfile
$env:GITHUB_SHA = 'f3ed05d109b275b020e75e4e60c87f9bd222f024'
pnpm exec tsc -b
pnpm exec vite build --config vite.v13-test.config.ts --configLoader runner
$fixed = '../fixed/release/c4fe4514-v1.2-production/product'
node tooling/v13-isolation-smoke.mjs $fixed dist-v13-test ../plan-b-fresh --siblings
node tooling/v13-isolation-smoke.mjs $fixed dist-v13-test ../plan-b-legacy --siblings --legacy-root
```

新規profile exit 0。旧root variant exit 1。今回の実証はローカルChromium実測。Actions専用run、実機・本番既存利用者の移行、製品としての全ENV-04/05はNOT_RUN。判定は **案B合成loopback限定PASS（新規profile）／旧root worker残存variant FAIL**。正式配置の採択・製品ENV/QA PASSは未判定。固定V1.2、本番、実データ、実Aへの変更なし。

RETURN TO — Tech（旧root worker残存を含めた配置成立性）、QA（独立照合）、PMO（工程整理）。OWNER ACTION — なし。
