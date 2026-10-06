# H-20261006-09 Q5 identity 責務分離 Evidence

実行日: 2026-10-06 JST。App Development自身によるlocal非対話実行。Owner browser/storage不使用。

Product commit: `118ff493838fa35aa0a80e88532d8731e4005c38`
Branch: `codex/h-20261006-09-q5-identity`
基点: `e0e6578dc48c89e63f7a8287b95afdede3652e63`（既存accepted Product `d34b3927` + H08 tooling/evidence）
Build: `Build 2026-10-06 / 118ff493`

## 実装

- `src/canonical/topProjection.ts`: Exercise完了をEntry IDのSetへ集計。Session代表値を返さない。
- 各completed rowは1 canonical Sessionを保持し、snapshotの名称・bodyRegionから表示する。planned MenuEntry候補は新規Runへの入口のみで、individual actualをbindしない。
- recommendedは今週の各Sessionを独立表示。Categoryはsnapshot部位で同じSession行を表示。current candidateがないsnapshot部位にも実績用の到達先を確保する。OFF時に通常実施候補を増やさない。
- snapshot-onlyの到達先ではplanned候補の存在を偽らず「実施記録」と表示する。既存Entry数・完了数はplanned candidatesに対する指標として保持する。
- actual遷移・取消は明示Session IDの既存経路。Run見出しもcompleted Sessionのsnapshot表示名に整合。
- classification欠損はCategoryへ推測配置しない。recommendedでは引き続き表示・参照可能。「未分類」の新設、backfill、schema/migration変更はない。

## 検証

- `pnpm test`: 既存16 files / 121 tests PASS。
- 追加後 `pnpm exec vitest run src/canonical/topProjection.test.ts`: 3 tests PASS。合計124件。全体再実行としては記録しない。
- `pnpm exec playwright test`: 53件 PASS。詳細は `dev-results.json`。
- `$env:VITE_BUILD_DATE='2026-10-06'; $env:VITE_BUILD_SHA=(git rev-parse HEAD); pnpm build`: TypeScript + Vite + PWA build成功。8生成物のhashを `build-manifest.json` に保存。
- `pnpm exec playwright test --config playwright.release.config.ts`: release artifactをlocalhostで検証し46件 PASS。結果は `release-results.json`。

追加E2Eはsame Exercise/different Item（MenuEntryなしExtra含む）、same Item/different Entry、同一membershipの複数Sessionを使用する。各取消前後・reload後に両modeで行数、visible label、Session membership、遷移先見出し、actual数値、memoを検証。非対象Sessionのserialized factsと他canonical collection、legacy storage不変も検証する。today distinct count / weekly Entry aggregation / 14-day dotsは独立期待値で確認。

別caseでcurrent Item改名・snapshot-only部位・classification欠損を確認する。current masterを借用せず記録時の名称と分類を使い、欠損Sessionもrecommendedから参照できる。

既存E2Eの期待値変更は3箇所のみ。1 Sessionを複数planned Entryへaliasしていた期待を「1 Session = 1実績行」へ修正した。集計期待値は変更していない。

## Release境界

これはAppDev実装・検証のEvidenceであり、独立QAのPASS/CLOSE判断ではない。Production / Stagingへのdeployは実行していない。既存Staging toolingのaccepted source指定も変更していない。PMO再投入判断とQA limited re-verificationを待つ。
