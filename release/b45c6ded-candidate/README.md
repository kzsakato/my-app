# V1.1 candidate reference archive — v1.0 / 2026-10-23

**Pages配信不可・参照保存のみ。mainへmergeしない。**

Issue #28 [PMO #6356206281](https://github.com/kzsakato/training-project/issues/28#issuecomment-6356206281) の本番準備。既存2026-10-19 buildをコピーし、再buildなし。manifestの3ファイルは当日配信記録と今回のWorkers HTTP GETに完全一致。現行Production旧V1Rの8ファイルも保存manifestとHTTP GETで一致。HTTP証跡は `http-verification.json`。

検査: `node release/b45c6ded-candidate/verify.mjs`。既存Production検査は変更せず `node release/verify.mjs`。

## 同一artifact昇格が成立しない根拠

source b45c6ded の `vite.candidate.config.ts:4-7,12-19` はWorkers固定origin、base `/`、candidate=true、PWAなし。`src/data.ts:23-26` はorigin不一致でthrowし、専用DBを選ぶ。index.htmlは `/assets/` を参照しPages `/my-app/` 配下と不整合。HTMLだけ直してもJSのorigin制限は解消しない。DBもProduction `training-check` と異なる。同一sourceと同一artifactは別。

## 最小変更案（未適用・Technical判断待ち）

承認済みsource b45c6dedを固定し、既存 `vite.config.ts` のProduction設定（相対base、candidate無効、通常DB、PWAあり）を使う別artifactを一度だけ作成・確認・保存し、その確定artifactをdeploy時に再buildしない方式を推奨。ただしこれは実機確認済みcandidateとバイト同一ではなく、環境差分を認める判断が必要。今回はbuildしていない。candidate configやWorkers設定は変更不要。

Technicalが必要な環境差分と最小確認を確定した後の変更箇所:

1. `release/<確定Production識別子>/product/**` とmanifestを追加。
2. `release/verify.mjs` の固定directory/sourceSHA/ファイル数をそのmanifestに対応させ、全ファイルsize/hash照合は維持。
3. `.github/workflows/deploy-pages.yml` のupload pathをそのproduct directoryへ切替。build stepは追加しない。

未作成artifactへ向く実行可能workflowは用意しない。既存workflowはmainのrelease/** pushでも自動deployするため、この参照保存branchを含めOwner本番GO前のmain mergeは禁止。候補branch全体をmainへmergeする必要はなく、配信対象を保存artifactと検証設定に限定する案。

## 復旧

現行main `03e83ef8cb371ffccebe2cee95ff5d192bbb2faa` の旧 `release/118ff493/product` / manifest / verifier / workflowを保持。将来の配信差分を戻して旧8ファイルをhash検証し再配信する方法を準備対象とする。今回は実行しない。

これはサーバー上の静的配信物の復旧のみ。V1.1が書いたcanonicalデータをV1Rが安全に読める保証、既存PWA/SWを持つ端末への反映時間、Owner本番データの復元可否は未確認。自動DB rollbackや削除を行わず、Technical/Dataへ限定照会。本番データbackupはBrave backupと別origin・別DBであり代替にならない。

## 境界

Production/Workers deploy、App source変更、workflow変更、Owner storageアクセス、fixture投入、build、QA全件再試験は実施なし。案件CLOSE維持・QA LIMITEDをPASSへ読み替えない。
