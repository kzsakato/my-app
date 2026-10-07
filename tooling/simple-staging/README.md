# H-17 Simple Staging入口・fixture

2026-10-07 Technical承認範囲の最小実装。Product baselineは118ff493。旧Staging toolingは呼び出さない。

## 構成

- `fixture.ts`: 承認済み3種目packageをpure関数で生成。固定ID/時刻、Profile 66、Monday、3 initial setting changes、active Menu、Session=0。
- `entry.ts`: 固定origin guard→空DBへのatomic初期配置→read-back→`/app/`。再訪はmarker/authority/validator確認だけで、MAN変更を保持。不明状態はSTOP。reset/repair/importなし。
- `build.mjs`: accepted全8fileをbyte無改変で`.generated/site/app/`と`.generated/product/`へ複製。前者のrootに入口を追加し、静的配信用Wrangler設定を生成。
- `smoke.mjs`: local HTTP + Chromiumで承認範囲を確認。実Production通信・remote deployは行わない。

Productの相対SW登録によりscopeは`/app/`。root入口はSW制御外であり、同originのIndexedDBを共有する。新origin/空状態でのみ使用する。既存originの修復やSW解除は行わない。

## 再現

App rootで以下を実行する。

```powershell
pnpm exec tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --lib 'ES2022,DOM,DOM.Iterable' --skipLibCheck tooling/simple-staging/entry.ts tooling/simple-staging/fixture.ts
node tooling/simple-staging/smoke.mjs
node tooling/simple-staging/build.mjs
```

smokeは動的localhost portをorigin guardへ埋めて検証する。最後のbuildで配信origin固定版へ戻す。初期実装では未配信だった。新origin配信の実績は末尾を参照。Owner MANとProduction昇格は別工程。

再初期化はApp Developmentによる新originへの再配置を選ぶ。入口URLの通常navigationで準備する設計で、`/app/`直リンクやインストール済みPWAのstorage消失を修復する機能は含めない。

## 同一artifact境界

`.generated/product/`はaccepted manifestの8fileだけに限定し、余分なfileがあればbuildを失敗させる。ここが将来のProduction昇格入力。**`.generated/site/`をProductionへ配信しない。** fixture/入口/_headers/Wrangler設定はProduct artifact外。既存Production workflowは変更していないため、再buildなし昇格workflowの接続はまだ未実装。

DB version 7の5store構成と既存keyを使用する。初回はcanonical/app、cutover/state、cutover/simple-staging-fixtureを同一transactionで保存。legacy state/recovery/baselineは空のまま。markerはProduct schema内に入れない。初回失敗ではtransactionをabortし、authorityだけ残さない。未知versionのDBをupgradeしない。

## Evidence

`evidence/smoke.json`: **PASS**。fresh fixture完全一致/canonical画面、通常Profile編集、入口再訪でput 0・reload後保持、SW scope分離、不明データ/旧DB拒否、初回transaction中断時の全store空、模擬Production originでDB未作成を確認。Production originテストは全通信をbrowser routeでローカル応答し、実サイトへ送信していない。

`evidence/manifest.json`: accepted Product全8hashとfixture hash。これは配信実績ではない。

検証器の初回実行では、pagehide時の非同期通知がdocument破棄で届かず書込count取得に失敗した。Product/入口の不具合とせず、各put時点の通知に修正して初回3件・再訪0件を確認。その後、最終sourceでsmoke PASS。型検査はProjectと同じstrict条件を使用した。

## 新origin配信・到達確認 — 2026-10-07

H-17 Technical承認（Project `ba882ec`）により、App `8ac0ca1` の生成済み静的配信物を配信した。Cloudflare API code 10007で同名Workerの不存在を確認後、新規作成した。

- Owner入口: https://my-app-simple-118ff493.kzsakato-lab.workers.dev/
- Worker version: `cd7c4861-1f57-4faa-86a0-a2fa9aa39af3`
- Product baseline / Build: `118ff493838fa35aa0a80e88532d8731e4005c38` / `2026-10-06 / 118ff493`
- 実行: `npx --yes wrangler@4.147.0 deploy --config tooling/simple-staging/.generated/wrangler.json`

`evidence/remote-reachability.json`: PASS。root/entry実応答とローカル配信物のbyte一致、Product全8hash、fresh隔離Chromiumでroot→canonical app、fixture完全一致/Session=0/active Menu、トレーナー連携あり・カテゴリなし、Build一致、SW scope `/app/` のみ・root controllerなしを確認。Production全6hashとPages deployment `6828068757` は配信前後不変。

旧Staging未操作。Owner partition未参照。automation PASSはOwner MANや独立QA acceptanceを代行しない。Ownerにはroot入口URL一つを提示し、通常navigation/MANを依頼する。今回の到達確認用ブラウザはOwnerとは別partitionである。

## MAN済みartifact Production昇格 — 2026-10-07

Ownerの直接指示「V1R Simple Staging MAN済み118ff493同一artifact Production昇格・最小release確認 H-20261006-17」に基づき、保存済みProduct全8fileを `release/118ff493/product/` へbyte無改変で保存。MAN済みの申告はOwner指示に基づき、個別MAN結果を推定していない。

App `7ecad20` でPages workflowを再build方式から保存artifactのhash検証・直接upload方式へ変更し、mainへfast-forward。Product source/SWの変更なし。Staging entry/fixture/configurationは配信物に含めない。以後、sourceだけのpushで未MAN candidateが自動releaseされることはない。

- Production: https://kzsakato.github.io/my-app/
- Actions run: https://github.com/kzsakato/my-app/actions/runs/37550195100 — success
- Pages deployment: `6898243024`（前回 `6828068757`）
- Build: `2026-10-06 / 118ff493`
- `evidence/production-release.json`: 全8file HTTPS hash/size一致、fresh browser設定到達・Build一致、SW scope `/my-app/`、page error/request failure 0、PASS。

最小検証は `node tooling/simple-staging/release-check.mjs`。検証用fresh partitionではcanonical authorityがないためaccepted Product既定のlegacy画面（カテゴリあり／トレーナー連携なし）。これは同一artifact配信とは別のstorage条件。Owner Production partitionのcanonical-readyやMANを代行・推定していない。Owner storage/SW/cacheの操作なし。旧Staging未操作。
