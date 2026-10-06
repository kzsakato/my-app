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

smokeは動的localhost portをorigin guardへ埋めて検証する。最後のbuildで配信候補origin固定版へ戻す。現在の名前`my-app-simple-118ff493`は未配信の候補であり、新規originであることの実環境確認は次工程。実配信・Owner MAN・Production昇格は今回実行していない。

再初期化はApp Developmentによる新originへの再配置を選ぶ。入口URLの通常navigationで準備する設計で、`/app/`直リンクやインストール済みPWAのstorage消失を修復する機能は含めない。

## 同一artifact境界

`.generated/product/`はaccepted manifestの8fileだけに限定し、余分なfileがあればbuildを失敗させる。ここが将来のProduction昇格入力。**`.generated/site/`をProductionへ配信しない。** fixture/入口/_headers/Wrangler設定はProduct artifact外。既存Production workflowは変更していないため、再buildなし昇格workflowの接続はまだ未実装。

DB version 7の5store構成と既存keyを使用する。初回はcanonical/app、cutover/state、cutover/simple-staging-fixtureを同一transactionで保存。legacy state/recovery/baselineは空のまま。markerはProduct schema内に入れない。初回失敗ではtransactionをabortし、authorityだけ残さない。未知versionのDBをupgradeしない。

## Evidence

`evidence/smoke.json`: **PASS**。fresh fixture完全一致/canonical画面、通常Profile編集、入口再訪でput 0・reload後保持、SW scope分離、不明データ/旧DB拒否、初回transaction中断時の全store空、模擬Production originでDB未作成を確認。Production originテストは全通信をbrowser routeでローカル応答し、実サイトへ送信していない。

`evidence/manifest.json`: accepted Product全8hashとfixture hash。これは配信実績ではない。

検証器の初回実行では、pagehide時の非同期通知がdocument破棄で届かず書込count取得に失敗した。Product/入口の不具合とせず、各put時点の通知に修正して初回3件・再訪0件を確認。その後、最終sourceでsmoke PASS。型検査はProjectと同じstrict条件を使用した。
