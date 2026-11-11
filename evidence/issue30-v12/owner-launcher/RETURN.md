# Issue #30 Owner PCワンクリック起動・終了／Android準備 RETURN

2026-10-26 JST、App Development / Codex。

**RESULT: PASS（WindowsパッケージとAndroid実測準備）。Android実機到達/PWA install/relaunchは未実測。Owner MAN開始HOLD・QA最終LIMITEDを維持。**

## Authority / 固定版

- GitHub current取得：PMO #6406407986、Technical #6406297796、Owner決定 #6406275606。TRAINING_PROJECT、roles/AppDevelopment、handoff/README、既存localhost手順を再確認。旧root AI_BRIEF/AI_ROLESは取得せず、PS/Library閲覧を前提にしない。
- App開始時clean、branch `codex/issue30-local-adb`、HEAD/remote f38d950。Project main dc0e7c3。別repositoryを混同しない。
- candidate source **36dbb58009709b0244dae39aa114fec50597ce1d**、build inventory SHA256 `2446dd36e3ad80d465065ffa546c12f83fc9418e3ee348ebbd1886b029042923`を保持。新たなアプリbuild/fixture/UI/Data Contractの変更なし。
- launcher source **57f088314cef65e174934f7f1ec5e6af2a685e9d**。追加はowner配布用controller/server/読取collector/CMD/README、組立・模擬ADBテスト、Evidenceのみ。src/既存vite config/workflow/release/PR#4 branchに変更なし。

## 配布物とOwner操作

**[owner-package.zip](owner-package.zip)** をWindows PCへ保存し「すべて展開」。Git/pnpm/build/test/shell入力は不要。Node.js 22以上と既存ADBが必要（両runtimeを同梱・自動導入しない）。作成セッションはWindows・Node.js v24.21.0。使用するOwner配信PCのOS/runtime/USB実接続は別途確認が必要。

ZIP SHA256 **470cc194e54bfd8ff0d372d857b9e94b46941882809f8c4471faa98117a0dfc0**、136256 bytes、19 files（package.json参照）。候補static build10件とlauncher等9件のみ。実Backup、credential、ADB/Node実行binary、run/private state、Ownerファイルを含まない。

1. WindowsでZIPを展開。配信する同じPCへAndroidをUSB接続。
2. 必要な場合だけ端末のUSBデバッグを有効化し、当該PCのRSA許可を本人確認。端末機種/OSとPC OSを担当へ要約する。既に有効なら再設定不要。
3. **START.cmd** をダブルクリック。既存ADB優先探索、単一USB device状態、4182空き、既存reverseなし、同梱artifact全SHAを確認してから、reverse --no-rebind＋127.0.0.1 bind serverを開始。未認可/複数台/port/hash/mapping衝突は非破壊停止。
4. 成功時にAndroid Chromeで **http://localhost:4182/** を開く。候補名/ダミーメニューを確認。候補タブを1つだけ開き、**CHECK.cmd** をダブルクリックすると対象URLに限定してreadonlyのSW/DB情報を採取する。
5. 担当のAndroidスモーク案内に従い、候補PWAだけinstall→閉じる→候補アイコンで再起動。PC配信＋USB接続中に実施。MAN M01–M08開始はPMO Ready待ち。
6. **STOP.cmd** をダブルクリック。今回のserver/session/PIDとmappingを照合し、自分が追加した分だけ停止/解除。二度目STOPは既に終了と表示。終了後USBデバッグをOFFにする。

起動成功はPC配信/reverseの準備成功でありAndroid到達の証明ではない。CHECKの成功も候補ChromeタブのSW/DB読取だけで、PWA install/relaunchのPASSではない。候補PWAのstandalone情報は、そのタブが同CDPで可視な場合に限り採取可能。不可なら手動の候補画面/再起動結果を別証拠とする。

## 安全境界・採取情報

- localhost:4182以外のHostは403。serverは127.0.0.1限定、LAN公開/Firewall変更なし。起動sessionとserver PIDを相互照合し、PID再利用や他processの一括停止を避ける。
- reverseは単一USB端末だけ、既存4182は上書きしない。終了は同じmapping値を照合し、変更済みなら停止。remove-all/kill-serverなし。同一値のmappingを外部で入れ替えた場合の履歴までは識別できないため、実証中に他ツールから当該portを操作しない。
- CHECKは空きportの一時ADB forwardでChromeのread-only CDPに接続。/json/listから**URL完全一致の候補1タブだけ**を選び、評価内でもorigin再照合。専用DBの存在を確認してからreadonlyでauthority/件数を読む（不存在時にDBを新規作成しない）。収集はorigin/secure context/browser版/display mode/候補識別文/専用DB名・version・authority・件数/SW scope/controller/cache名のみ。canonical本文・Session内容・他site storageは出力しない。
- forwardも今回作成したport/端末/remoteを照合して解除し、異値なら解除しない。異常終了時はprivate stateに残しSTOPで照合可能。Chrome CDP不可・対象タブ不明・SW/DB不成立で停止、権限を広げず返却。
- `run/result.json`、`run/android-check-*.json`が共有用の最小Evidence。`run/session.private.json`は端末serial等のローカル管理情報なので**共有禁止**。server.logも通常共有不要。
- 起動/終了/CHECKに失敗した場合は最初の失敗点を返し、無期限再試行やSDK/driver/端末権限の自動変更をしない。

## 実施検証

**Windows/Node v24.21.0、模擬ADB executable＋Playwright隔離Chromium 153で10群PASS**（tests.json）。Owner実Androidは使用していない。

- 実CMD wrapperをcmd.exeで実行し、no-device時START/CHECK停止とSTOPの冪等性を確認。
- deviceなし、unauthorized、複数device、ADB未検出、既存mapping、artifact hash不一致、port既存listenerで安全停止。
- 成功時の配信/manifest/health read-back、二重START拒否、PID不一致時に他processを停止しない、変更されたmappingを解除しない、own-session cleanup、二重STOP。
- PC隔離candidateのCDPから専用DB authorityと件数、secure context、SW controller/scope、cache名を採取。一時forwardの模擬作成/解除を照合。**これはPC＋模擬transportでありAndroid成功ではない。**
- 最終テスト後4182/9338 listenなしを確認。実ADB/driverは導入せず、Owner端末・既存本番・旧stagingへ接続しない。
- candidateは前回PC smoke7観点/型検査/unit144/build PASSの固定buildを再利用し、配布時に10ファイルhashを再照合。今回はlauncher検証であり既存unit/機能E2Eを新規再実行したとは申告しない。
- `node tooling/v12-local/package-owner.mjs <出力先>` で担当が組立可能。source SHAとcandidate SHAはpackage-info.jsonで区別。Ownerはこの組立を実行不要。

## 前提不足時の最小案内

既存ADBのPATH/標準SDK/ANDROID_HOME/ANDROID_SDK_ROOT/同梱先platform-toolsを優先し、標準外の所在は担当が指定する。ADB未検出は「Owner PCの全領域に存在しない」や「localhost方式不成立」を意味しない。

必要な場合だけ[Google公式Platform-Tools](https://developer.android.com/tools/releases/platform-tools)を規約本人確認後に導入する案を担当が整理。Windows Google端末は[Google USB Driver](https://developer.android.com/studio/run/win-usb)、他機種はメーカー公式driverが必要な場合がある。自動download/インストール/規約同意/管理者権限変更はしない。Node未検出も[公式Node.js](https://nodejs.org/en/download)の導入案を担当へ返し、Ownerにshellを丸投げしない。署名/セキュリティ警告を解除して通さない。

## RETURN / 残件

**RETURN TO: PMO→Technical/実機支援/QA。WAIT FOR:** 使用PCがWindowsか・既存Node/ADB経路・Android機種/USB認可を最小確認し、端末接続→START→Android到達→CHECK→候補PWA install/relaunchの実測へ。最初の不成立点でSTOPして結果を返す。

**OWNER ACTION:** ZIP展開、USB接続、必要時USBデバッグ/RSA許可、START/CHECK/STOPのダブルクリックと候補Chrome操作だけ。端末固有の許可をCodexが代行せず、OwnerにGit/test/DevTools/shell入力を依頼しない。未導入SDK/driver/Nodeは担当への返却事項。

Android実測・PWA install/relaunch・公開HTTPS固有確認は未了。M03複数行/M05比較/M07分類警告等のfixture不足はQAの別Routingで照合待ちであり、このlauncherで解決済みにしない。QA最終LIMITED・Owner MAN HOLD維持。

production/旧staging/実データ/既存PWA・SW・IDB/PR#4 production mergeは不変更。GitHub branchの配布ZIP保存は本番/新サイトdeployではない。受け手の実読・PMO Readyは別判定。
