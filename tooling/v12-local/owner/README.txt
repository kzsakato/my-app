V1.2 MAN候補・ダミー専用 / Windows PC 起動・終了

1. このZIPをPCの書き込み可能なフォルダーへ「すべて展開」します。ZIP内のまま実行しません。
2. 配信PCとAndroidをUSB接続。必要な場合だけ端末のUSBデバッグを有効にし、このPCのRSA許可を本人が確認します。
3. START.cmdをダブルクリック。成功表示後、Android Chromeで http://localhost:4182/ を開きます。
4. 候補名「V1.2 MAN候補・ダミー専用」、MANダミーメニューを確認。実データらしい表示なら操作停止。
   Android Chromeの候補タブを1つだけ開いた状態でCHECK.cmdをダブルクリックすると、対象URLを照合して専用DB/SWの安全な最小情報を読み取ります。
   一時ADB forwardを空きportに追加し、今回分だけ即解除。ChromeのCDPが利用不能なら最初の失敗で停止し担当へ返します。無理に権限設定を変更しません。
   CHECKの成功もAndroidタブの読み取り結果だけで、PWAインストール/relaunchのPASSではありません。候補PWA操作結果は別記録です。
5. 終了は同じフォルダーのSTOP.cmdをダブルクリック。今回追加したreverseと当該serverだけを終了します。
6. 終了後、端末のUSBデバッグをOFFにします。本番PWA/ブラウザー保存領域は消去しません。

前提：Windows PC、Node.js 22以上、既存ADB、USBデバッグを許可した物理Android 1台。
このパッケージはbuild済みです。Git/pnpm/build/test/shell入力はOwnerに不要です。
Node.jsは同梱せず自動導入しません。この作成PCはWindows・Node.js導入済みですが、別のOwner PCでの有無は未確認です。
Node未検出時は担当へ返してください。必要時だけ公式 https://nodejs.org/en/download を用いた導入案を担当が整理します。

ADBは既存を優先し、同梱フォルダーplatform-tools/adb.exe、ANDROID_HOME/ANDROID_SDK_ROOT、標準Android SDK、PATHを探します。
標準外の既存adb.exeは担当がV12_ADB_PATHで指定できます。Ownerへ環境変数入力は依頼しません。
未検出時のみ、Google公式 https://developer.android.com/tools/releases/platform-tools のWindows版を、規約を本人が確認したうえで導入する案を担当へ相談します。
Android Studio既存ならそのplatform-toolsを優先。新規アカウント/自動download/規約同意/管理者権限付与はしません。
機種によってWindows USB driverが必要です。Google端末は https://developer.android.com/studio/run/win-usb 、他社端末はメーカー公式driverを担当と確認。
接続/未認可/複数台/ポート4182使用中/既存reverse/ファイルhash不一致は最初の不成立点で停止します。繰り返し再設定や全mapping解除をしません。
署名/セキュリティ警告等で実行を拒否された場合も無理に解除せず担当へ返してください。

成功表示はPC配信＋ADB reverseの準備成功だけです。Android到達/PWA install/relaunch、MAN開始のPASSではありません。
Android smoke順序：候補識別→USB/localhost到達→担当によるSW/DB照合→候補PWA install→閉じる→候補アイコンで再起動（USB接続・PC配信稼働中）。
本番のPWAアイコンを操作しません。Androidで実機操作が必要な段階は担当/PMOから通知します。MANはPMO ReadyまでHOLD。
USB切断時のoffline保証・公開HTTPS/TLS配信の代替保証はありません。

入口：http://localhost:4182/（127.0.0.1/LAN IP/他portへ変えない）
専用DB：training-check-v12-local-man v7 / authority：cutover/state
PWA id：/v12-local-man、scope/start_url：/、SW cache prefix：v12-local-man
候補build source SHA/各ファイルhash：artifact.json。起動時に全ファイルを照合します。
初回全store空だけダミーをatomic配置、非空DB再seed/自動消去なし。実データ/実Backup入力禁止。
dummy-backup-warning.jsonはダミーの警告preview専用。「全データを置き換えて復元」は押しません。

返却するもの：run/result.jsonとrun/android-check-*.json、Android機種/OS/Chrome版、候補画面のスクリーンショット、到達/候補PWA install/relaunch：OK/NG/未実施。
run/session.private.jsonはローカル管理専用（端末serial等）。共有しません。token/cookie/OTP/実データ/個人メールも送らないでください。
run/server.logも通常共有不要です。ログには保存データを収集しません。
ADB状態が不明なまま終了に失敗した場合、stateを削除してごまかさず担当へ結果を返します。USB再接続後のSTOPで今回分を照合して解除します。
二度目のSTARTはstateを上書きせず停止。二度目のSTOPは既に終了と表示。remove-all/kill-server/既存サイトclear/既存process一括停止はしません。

本番Pages・旧Cloudflare staging・Owner実データ・既存PWA/SW/IDB・PR #4は変更しません。
