# Issue #30 localhost + ADB reverse 最小実証

Authority: PMO #6405935086 / Technical #6405918941。b86f144起点のローカル検証用追加。production source/config・旧staging不変更、公開配信なし。実データ/実Backup禁止。

App rootで担当が実行：

```powershell
pnpm exec vite build --config vite.v12-local.config.ts --configLoader runner
node tooling/v12-local/serve.mjs
```

別terminalで担当が `node tooling/v12-local/smoke.mjs`。Port占有時は他processを止めたり別portへ自動退避せず停止。bind=127.0.0.1:4182、Host=localhost:4182だけ許可。入口 **http://localhost:4182/**。127.0.0.1/LAN IP/既存Pages/Workerは入口にしない。URLにはHTTPSでなくHTTPを指定する。localhostのsecure-context扱いをPCで実測し、Androidでも要確認。

ローカルconfigだけがdata.tsのcandidate DB文字列を専用名へ変換。元ファイルは変更しない。入口はorigin/secure context確認→専用DB全store count→全件空の場合だけsynthetic canonical/authorityを1transactionで配置→App読込→SW登録。非空かつ不完全なら非破壊停止。非空valid DBは再seedしない。空の新検証DB以外は初期化せず、既存DB/SW/cacheのclear機能は提供しない。

- DB: training-check-v12-local-man v7、canonical/app、cutover/state authoritative=true。
- fixture: canonicalFixture由来の合成1種目/1TI/1Menu/1Entry/1Session。名称はダミー。初回起動のローカル日付、Mon=0の推奨曜日を固定保存し、再起動日が変わっても再seedしない。初回基準日はsmokeの保存データ/実行時刻と照合。M05の多部位/多日比較・M07の分類警告fixtureは未準備。
- PWA id=/v12-local-man、start_url=/、scope=/、name=V1.2 MAN候補・ダミー専用、PNG192/512。cache prefix=v12-local-man。productionとはscheme/host/portが異なるorigin。PCとAndroidの同じlocalhost表記はそれぞれの端末の保存領域で、データ同期ではない。
- dummy-backup-warning.jsonは合成fixtureのdisplayPreferencesのみ不正にしたM08 preview用。復元は押さない。ファイルを必要に応じ担当が渡す。Owner実ファイルは使用しない。
- SW生成時のcleanupOutdatedCaches/clientsClaim/skipWaitingはfalse。既存環境のSWへ解除要求を送らない。localhost専用scopeのみ。USB切断時offline保証はしない。

## Android前提と担当操作（未実測）

ADBは調査時PATH/標準Android SDK位置に未検出。新規SDK契約・driver・端末設定を勝手に導入しない。Ownerは使用するAndroidをUSB接続し、必要なら端末側の開発者向けオプション→USBデバッグ、当該PCのRSA許可を自分で行う。デバッグの許可を望まない場合は停止してPMOへ返す。既に有効なら再設定不要。完了後の無効化もOwnerが判断する。

ADB導入済みの所在が確認できればCodex/担当がdevicesを確認し、状態deviceの対象1台だけを選ぶ。serialはIssueへ載せない。unauthorized/offline/複数台なら自動選択せず停止。

```powershell
adb devices
adb -s <対象端末> reverse --list
adb -s <対象端末> reverse --no-rebind tcp:4182 tcp:4182
adb -s <対象端末> reverse --list
```

既存4182 mappingがあれば上書きしない。OwnerはAndroid Chrome通常タブでlocalhost:4182を開く。V1.2 MAN候補/ダミー表示を確認し、候補PWAだけインストール→閉じる→候補アイコンから再起動。productionのPWA/データは操作しない。到達/manifest取得/SW controller/専用DB persist/表示モードを担当が照合してからPMO Readyへ返す。インストール操作はOwner側未実測、PCでmanifest/SWを確認しただけでAndroid PASSにしない。

終了時、担当が**今回追加したmappingだけ** `adb -s <対象端末> reverse --remove tcp:4182` で除去。remove-all/kill-server/端末データ消去をしない。今回起動したローカルserverはCtrl+Cで終了。次回は同じport/URLを使い、再build/serveだけでDBを消さない。

## MAN範囲・停止条件

既存Owner MAN M01〜M08を変更せず、現状fixtureではM01/02/04/06とM08 previewの一部を準備可能、M03は単一予定/Sessionの限定確認、M05/M07はfixture追加/QA照合待ち。Android/PWA・公開HTTPS固有の配信/TLS/実install/relaunch・USB切断時の到達は未確認。最終QA LIMITED、Owner MAN開始はPMO ReadyまでHOLD。

誤origin、実データらしい表示、既存DB非空かつauthority不正、port/ADB mapping衝突、端末未承認、SW/DBの分離不一致なら停止。production/旧stagingの修正で解決しない。
