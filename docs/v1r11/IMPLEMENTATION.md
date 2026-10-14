# V1.1 工程⑦ 実装返却

基準HEAD: `03e83ef8cb371ffccebe2cee95ff5d192bbb2faa`。新規checkout、着手時clean。
指示: training-project Issue #27 [#6165498930](https://github.com/kzsakato/training-project/issues/27#issuecomment-6165498930)。
追加確定: Data Design [#6165657957](https://github.com/kzsakato/training-project/issues/27#issuecomment-6165657957)とOwnerの直接投入。
独立provenance fieldは作らず、現在authorityだけをmanagementModeに保存する。

|要求|実装接続|
|---|---|
|UI-01|Topの部位表示ラベル|
|UI-02|推奨曜日を初期モード、今日の曜日選択は独立|
|UI-03|曜日指定ラベルと狭幅の一行表示|
|UI-04|状態と14日履歴の右端配置。history計算関数は無変更|
|UI-05|重量ボタン44px、1kg/0.25kg群間8px|
|UI-06|seatラベル右に入力|
|UI-07|実績見出し除去、snapshot/actualのread-only表示、取消操作維持|
|UI-08|設定履歴の最終v0.3配置、初回削除なし、時間系表示|
|UI-09|追加候補すべて、初期値すべて|
|UI-10|FIXの部位と名称の横並び、44px以上の編集入口|
|TR-01|重複JSON key/未知key/null/型/参照を検査、詳細preview、Owner確認、新規App ID|
|TR-02|TrainerPanelの2ブロック、ファイル選択→確認、出力1操作|
|TR-03|実行local dateの100暦日、metadata、0件正常、read-only context|
|TR-04|TI/Menu required managementMode、Owner既存MAN初期化、確認OFFのみ、Sessionとは独立|
|TR-05|保存時TRAINER確認、Entryは親Menu、許可operationのみ、全体拒否・変更ゼロ|
|TR-06|latest rootで再検査、candidate ID別namespace、proposalId fence、値の変更だけで一律stale拒否なし|
|TR-07|同一readwrite transaction、独立fresh readback、盲目的rollbackなし、UNKNOWN保持|
|TR-08|診断の明示保存、raw dataset/Session/proposalを診断に含めない|
|TR-09|固定7文言、成功はreadback確定後のみ|
|TR-10|activeMenuId無変更、保存結果にcandidate→App ID mapping|
|TR-11|Trainer導線と必要OFFのみ。通常restore画面は無変更|

UI-11対象外。B1〜B3再審査・B4再開なし。QA TEST_SPECのケース・期待値・合否基準は未変更。

## 保存境界

`data.ts:applyTrainerCanonical`はtransaction内でlatest canonicalとcutover状態を読み、許可操作差分を適用する。データとappliedProposalIdsを同じcanonical/appへ保存する。
既存cutover/stateの`trainerPendingProposalId`は現在の1操作だけの未確認マーカー。同じtransactionで保存し、独立readbackの対象recordとproposalIdの肯定照合後に解除する。新store、長期deny set、全writer revision gateはない。
起動時と画面再入場時にこのマーカーがあればAI提案を封鎖する。通常restoreはこのマーカーを解除しない。未知結果の手動照合・解除手順を本実装が発明することはせず、Owner/Technicalの個別復旧判断へ返す。

通常Owner保存は旧root丸ごと書戻しから、latest rootへの明示変更差分へ接続した。変更のない権限・ID・他の更新は保持する。新規設定履歴は保存する最終標準値へ合わせる。
旧V1 MenuProposalのUI経路は新TrainerPanelへ置換。旧domain helperは既存互換参照用に残るが通常UIから呼ばない。DEV限定の旧MAN bootstrapは今回の配信候補では無効。

既存canonical Owner TI/Menuにfieldがない場合のみread boundaryでMAN初期化する。既存の不明値をTRAINERへ補正しない。次の明示保存でrequired fieldを永続化する。Backup Restoreは新required shapeを検証し、旧V1R JSONの互換変換は追加しない。
`baseRevision`は採用wireどおりnonempty stringとして受領する。B4で閉じた全root revision gateや新しい発行体系は追加せず、保存時の権限・identity・参照・collision・proposalIdで判定する。

## 実source4点

- exact wire: #6165498930 §4。旧1.0 helperから新wireを推測していない。
- authority: #6164568105 / #6165657957。独立provenance保存は追加しない。
- local date: 既確認runtime.localDateとbaseline.shiftLocalDateを再利用。SettingChangeは対象日のlocal 00:00から翌日00:00のinstant窓、残存baseline最大1件、同時刻曖昧順は拒否。
- 保存: #6164496581。最新transaction・fresh readbackへ接続。通常restore後は旧preview/YESを保持せず、新提案・新確認から再開。

## 現行保護と候補起動

現行URL: `https://kzsakato.github.io/my-app/`（既存production-release.jsonによる）。配信artifact `release/118ff493/product`、Pages workflow、hosting、Chromeのstorage/SW/cacheへ変更しない。
候補: `http://127.0.0.1:4177`、DB `training-check-v1r11-candidate`、PWA pluginなし。異なるoriginでの候補起動はDB open前に拒否する。production configとrelease artifactは無変更。

候補build: `pnpm run candidate:build`。出力は`dist-v1r11-candidate/`。実行テスト・deployは未実施。
Ownerの別途実行指示後、対象checkoutで`pnpm run candidate:preview`を実行し、Braveで専用URLを開く。strictPortなので既存listenerへ自動的にportを変更しない。
候補は空の隔離storageから開始する。初回は既存のデータ管理→正規データ切替をOwnerが明示操作する。Chromeから自動コピー・データ移行しない。
手動復帰は候補タブを閉じ、serverをCtrl+Cで止め、Chromeの現行URLへ戻る。現行版を候補へ自動切替しない。

## 検証と未完了

型検査と候補buildのみ。unit/E2E/browser実行、failure injection、Owner MAN、QA PASS、deployは行っていない。
MagicPath component `460289934197166080` / revision `460377996864405504`を取得して反映。UI-04案2のLibrary画像原本は未取得で、GitHubの右端FIXに従った。視覚一致の実測は未確認。
QA TEST_SPEC本文はLibraryのみで未取得。QA管理の正本提供と別途実行指示が必要であり、独自ケースは作らない。
既存開発fixtureはrequired managementMode=MANのschema追従だけ。QAケース・期待値の追加変更ではない。
