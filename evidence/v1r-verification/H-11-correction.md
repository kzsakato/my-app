# H-20261003-11 — QA-C01/C02 補正 Evidence

Authority: training-project `49e378f` のH-11 / H-10 exact closure requirements。開始App SHA `b94496ac444421e34f8b117d3b8741b2509101f1`、branch `codex/h-20261003-08-v1r`。QA pre-MAN受入・Owner MANは別判定。PR #1はdraft/unmergedを維持する。

## QA-C01

- importer candidateとpreviewの無条件suffixを除去し、validated `proposal.menu.name` をそのまま使用。同名Warningも実際のvalidated nameと既存Menu名の一致だけで判定する。
- unitは未付与名とalready-marked名をparameterizeし、candidate / persist / read-back一致、既存Owner Menu・activeMenuId保持、ID App発行と重複適用拒否を確認。Warningはexact matchとsuffix推測なしを独立検証。
- D-01/02実導線も `Owner確認候補` と `Owner確認候補 (ByAI)` の両入力で、previewのexact text、取消、書込失敗/retry、保存名、既存Menu全体不変、二重投入拒否、reload一致を確認。
- 既存MAN helper取込testのsuffix期待値もH-10 C01に従い入力名保持へ修正。初回development全体runはこの旧期待値で1 FAIL / 38 PASSとなり、修正後に全体を再実行した。
- 新しいprovenance field/entity/schemaなし。既存name validationのtrim/非空条件は変更していない。

## QA-C02 — test synchronization defect

製品のcancelは`await commit`成功後に戻り、commitはwrite→read-back一致→state採用→trueの順。補正前grouped testはconfirm YES直後にreloadしており、非同期操作の完了を待っていなかった。

- 既存grouped実導線にcanonical全体のpoll/equality、対象Sessionゼロ、カテゴリ画面への完了遷移、Top今週0/2・今日0/1を追加。その後reloadしcanonical全体一致と今週0/2を再確認する。
- 専用caseは同じExerciseの前週Sessionを非対象として残す。TrainingItem/SettingChangeと他のcanonical fieldを含む全体比較で、対象Sessionだけが消え、前週Sessionが維持されることをreload前後で確認する。
- confirm NOはcanonical state不変だけでなく、IndexedDB canonical `put`呼出数0を確認する。
- write failure注入ではRunに留まり「実行を取り消せませんでした」、保存内容不変、reloadも2/2。
- read-back failure注入では「保存の成功を確認できません」+「保存状態の確認」となり、成功ナビゲーション/件数表示へ進まない。永続化済みの可能性を隠さず、reload後は実際の保存状態0/2を表示する。atomic rollbackとは主張しない。
- 両失敗caseと成功caseのlegacy store不変を確認。`cancellation-boundary` JSON attachmentに実測write/read回数とcanonical before/afterを保存する。
- cancel/commit製品コード変更なし。retry/timeout増加・期待値2/2への変更・scenario削除による回避なし。

## 検証と範囲

Windows: unit 118件/14 files、development E2E 39件、release E2E 32件、build、selected VRT 2件（zero diff）。JSON reporterから抽出した実行結果は `H-11-results.json`。Linux CI run URL・final SHA・push read-backはtraining-project H-11のdurable returnに記録する。

pre-change baseline、snapshot/oracle、selected VRT条件は変更なし。変更した名前の期待値のAuthorityはH-10 C01であり、実装に合わせた自己承認ではない。未承認visible delta、schema/migration追加、Owner MAN、merge、Pages deployは実施していない。AppDev自己検証をQA受入やFormal Auditの代替としない。
