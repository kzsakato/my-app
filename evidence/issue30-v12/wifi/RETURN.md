# Issue #30 USB/ADB不要 Wi-Fi方式 調査・準備 RETURN

2026-10-26 JST、App Development/Codex。**RESULT: BLOCKED（Androidが信頼するHTTPS経路の確定待ち）。Wi-Fi用build/serverの準備と安全境界テストは実施。Android Chrome到達・SW/PWA install/relaunchは未実測。**

## Authority / scope

最新GitHub取得のPMO #6406832357、Technical #6406809943に従う。USB/ADB/Android Studioは不採用、導入/再要求なし。Ownerの「V1.3の前に簡単確実な手順を構築」も今回の明示指示として受領した。

fetch後、App開始HEAD/remote `2231131c17e297d9bf186ccf76a7c8f4dfce7601` clean、Project main `dc0e7c3` clean。TRAINING_PROJECT、roles/AppDevelopment、handoff/README、現在のcandidate configを確認。旧root AI_BRIEF/AI_ROLES/PS/Libraryを参照済みとはしない。

## 実物と調査結果

- 現セッションWindowsにはWi-Fi IPv4 `192.168.11.6`を確認（Androidが同ネットワークか、同じPCを配信に使うか、DHCP固定かは未確認）。SSID等は採取しない。
- [W3C Secure Contexts](https://www.w3.org/TR/secure-contexts/)と[Service Workers](https://www.w3.org/TR/service-workers/)を照合。LAN IPのHTTPはlocalhost例外ではない。同Wi-Fiで画面表示できてもSW/PWAの成功証明にならない。
- [Chrome certificate verifier](https://chromium.googlesource.com/chromium/src/+/main/net/data/ssl/chrome_root_store/faq.md)はTCP TLSでlocal trustを考慮する。直接LAN HTTPSには、Androidが信頼する発行元とIPのSAN等が必要。端末CA追加は[端末設定操作](https://support.google.com/pixelphone/answer/2844832)で、Ownerの限定承認と本人操作が必要。実機で有効かは未実測。
- [Quick Tunnel公式仕様](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)では別HTTPS originを得られるが、外部公開/新binary/Internet依存、起動ごとのhostname変更があり、DB/PWA継続性と再現性に不利。今回開始/導入していない。旧Worker Access調査へ戻らない。

## 準備済み（条件付き、Owner Readyパッケージではない）

source **f5bb5942872d11f4d8e2b170b4692aca23da9f6c**。`vite.v12-wifi.config.ts` / `tooling/v12-local/wifi-server.mjs` / `wifi-smoke.mjs` / `WIFI_PREPARATION.md`、専用dist ignoreとEvidenceを追加。src/既存config/workflow/releaseとPR#4 branchは変更なし。

**候補originは `https://192.168.11.6:8443`（現在PCのbuild設定値のみ、配信未開始・OwnerへアクセスReady案内禁止）。** private IPv4/HTTPS/8443を明示しなければbuildしない。serverは当該interfaceだけbindし、0.0.0.0やHTTPへ自動退避しない。build/config/inventory origin、全asset hash、証明書SAN/期限/鍵の対応を照合し、inventory掲載assetのみ配信。鍵/config/inventoryはsite配下禁止。cert/private keyをGitHubへ保存しない。

DB名は承認済み`training-check-v12-local-man` v7を維持し、環境都合で無断変更しない。localhostとLAN HTTPSは異なるoriginなので、実際のstorageは別。PWA id=/v12-local-man・scope/start_url=/も実効identityはoriginにより分離。既存の空DB限定atomic fixture/authority、非空再seed禁止・不完全DB非破壊停止を再利用。既存環境DBやPWAを消さない。

専用build PASS。11ファイルinventory SHA256 **c0b47db09e4aa9151d10cdbba5396627f70b57b28817f6d875bb5d5af1b62311**、各hashはartifact.json。TLS試験はloopback/testOnly buildを使い、試験用自己署名leaf/keyはrepo外のローカル非公開workにだけ生成。OS/Androidへtrust追加せず、実LANへserverを公開せずに終了した。

## スモークEvidenceと限界

tests.json：2026-10-26 02:35:30 UTC（11:35:30 JST）、Windows/Node/隔離Chromium。**4観点PASS_BOUNDARIES_ONLY**。

1. 標準TLS clientは未信頼の試験証明書を拒否。
2. そのテストclientだけに当該certを明示するとTLS GET200。異なるHostは証明書名不一致で拒否。これはAndroid trustの証明ではない。
3. 通常ChromiumはERR_CERT_AUTHORITY_INVALIDで停止。ignoreHTTPSErrors、警告無視、security flagなし。
4. 模擬LAN HTTPはisSecureContext=false、candidateはDBアクセス前停止、DB一覧=[]。network実到達試験ではない。

初回テストのwrong-Host要求がHTTP判定前にTLSの名前不一致で拒否されることを確認し、失敗を隠さず期待層をTLS拒否として分けた。最後の結果だけをHTTP403実測とは呼ばない。

8443 listenerは最終確認でなし。実Android・同一Wi-Fi到達・端末trust・Firewall・PWA install/relaunch・保存persistの実測なし。unit/既存機能E2Eの新PASSを申告しない。本番/旧staging/実データ/既存SW・PWA・DB/PR#4 mergeは不変更。

## 方式比較と一度に確定すべきGate

|方式|Owner負担/未確定事項|判断|
|---|---|---|
|LAN HTTP|URLを開くだけでもSW/PWAは不成立|採用しない|
|直接LAN HTTPS＋検証専用CA|端末trust追加を一度本人操作。固定URL、鍵保管/失効・削除、必要時のみPrivate/LocalSubnet限定Firewall例外も要確認|同Wi-Fi内完結を維持するなら第一候補、限定承認待ち|
|管理済みdomainの信頼済みHTTPS|端末trust追加不要、domain/DNS/certの利用権限・安定routeが必要|経路が既にあれば代案、現在未指定|
|一時公開HTTPS tunnel|端末trust追加不要だが外部公開・新runtime・毎回origin変更等|限定比較のみ。標準方式には非推奨|

**最初の未成立点はAndroidのHTTPS信頼。** 現在の調査準備GOを、端末CA/Firewall変更や外部公開tunnel開始の包括承認へ拡張しない。同じ調査を再反復せず、Technical/PMOが次を一度で確定する。

- 直接LAN案なら、Ownerが検証専用CAの信頼追加を許可するか。具体certificate/fingerprint・保管者・有効期限・削除範囲を添える。root/private keyは配布/Issueへ出さない。
- 固定URL/IP・対象PC/Android/Chrome、必要時の限定Firewall例外と後片付け。guest/client isolation時のSTOP条件。DHCPでoriginが変わったら別DB/PWAになる点を先に判断する。
- trust変更を望まないなら、信頼済みHTTPSの安定した別origin経路を確定する。一時URL変更を「簡単確実な標準化完了」としない。

**Owner操作（Gate成立後）**：同じWi-Fiへ接続、承認した場合だけ端末の検証用trust追加、担当が示したHTTPS URLをChromeで開く→候補確認→候補PWA install/relaunch。USB/ADB/Android Studio/DevTools/shell/Git/testは要求しない。証明書警告は無視せず最初の失敗を担当へ返す。現在は新しいOwner START配布なし、旧USB ZIPへLAN IPを入力して流用しない。

**RETURN TO: PMO→Technical。WAIT FOR: 上記HTTPS信頼/安定originの限定決定、その後Android実測とPMO Ready。Owner MAN M01–M08 HOLD、QA最終LIMITED。** M03/M05/M07等のfixture照合も未完了として保持する。

## V1.3前のOwner要求

Project commit **48b4bd5c314b7a01d8d19a87bfe3ba96262c248b** の `release/V1.2/04_テスト/V13_ENVIRONMENT_PROCEDURE_REQUIREMENT_20261026.md` に、Ownerの「V1.3前に簡単確実な手順構築」を保存・pushした。初回setupと毎回の操作を分け、起動→Android SW/DB/install/relaunch→終了→次回再起動→復旧を**開発後ではなく事前に実機試行**する整備案をPMOへ返す。担当/期限/受入条件はPMOが設定し、Codex提案を自己承認済み仕様とはしない。要求記録は標準手順完成の宣言ではない。
