# USB/ADB不要 Wi-Fi HTTPS 準備（未Ready）

Authority: Issue #30 PMO #6406832357 / Technical #6406809943。USB/ADB/Android Studioは使用・要求しない。

同一Wi-FiでPWAを使うにはAndroid Chromeが信頼できるHTTPSが必要。LAN IPのHTTP、自己署名証明書の警告無視、insecure-originのsecure扱いflagは採用しない。

## 担当側の準備済み構成

- `vite.v12-wifi.config.ts`：V12_WIFI_ORIGIN必須、HTTPS/private IPv4/8443だけ許可。localhost用entryのorigin guardをbuild時にその1originへ固定。既存src/本番config不変更。
- `wifi-server.mjs`：指定IPが現在のPC interfaceか、build/config/inventory originと全artifact hash、証明書SAN/期限/鍵一致を確認。指定IPだけbind、Host一致必須。inventory掲載assetだけ配信し、鍵/config/inventoryのsite配下配置は禁止。0.0.0.0、HTTP、公開tunnel、Firewall変更、証明書trust追加を自動実行しない。
- DB名は承認済み`training-check-v12-local-man`を維持。originがlocalhostと別なので保存領域も別。PWA id=/v12-local-man、scope/start_url=/はoriginを含む実効identityで分離。空DB限定seed/非空保持/不完全DB停止は既存検証entryを再利用。
- test-only loopback例外はV12_WIFI_TEST=1でのみ使用。証明書試験用でありAndroid用の入口ではない。

## HTTPS信頼のGate（未成立）

LAN用証明書の発行元/Android側の信頼は未確定。端末への専用CA信頼追加は端末設定を変える操作なので、既承認と推定せずTechnical/PMOが具体的な証明書・fingerprint・鍵管理・削除方針とともにOwnerへ限定承認を求める。root CA private keyは配布/commitしない。信頼追加をしないなら、Owner管理domainの信頼済みHTTPS、または別途承認された公開HTTPS経路が必要。

またPrivate networkの8443 inboundを既存Firewallが許可するか、Wi-Fi guest/client isolationがないかは未確認。必要な例外は対象program/port/Private profile/LocalSubnetに限定する案を別承認とし、全profile許可/Firewall無効化はしない。DHCP変更はPWA origin/DBの別環境化を招くので、固定URL方針も先に決める。

## Gate成立後だけ担当が行う手順（Ownerのshell作業ではない）

1. 対象PCのLAN IPと固定URL、Androidが信頼する証明書/鍵を担当が確認。
2. 対象originで専用build。source/build各hashを保存し、build originとcert SAN一致を照合。
3. PC非公開の`wifi.private.json`を作る。例（値は担当が確定、実鍵は送らない）：

```json
{"origin":"https://<PC-private-IP>:8443","site":"<absolute-path-to-dist-v12-wifi>","cert":"<local-leaf-or-chain.pem>","key":"<local-private-key.pem>","inventory":"<absolute-path-to-artifact.json>"}
```

4. 担当が`node tooling/v12-local/wifi-server.mjs <config-path>`で開始。鍵ファイルをsite配下へ置かない。
5. Ownerは同じWi-Fiに接続し、通知されたHTTPS URLをAndroid Chromeで開く。証明書警告なら回避せず停止。
6. 候補識別→secure context/専用SW・DB→候補PWA install→終了→同じ候補アイコンからrelaunchを担当と確認。USB/CDPの旧CHECK.cmdは使用しない。Android画面の最小Evidenceとreadonly検査方法を、信頼経路確定後に整備する。
7. 担当が当該serverをCtrl+Cで停止。DB/PWA/SWを消去しない。今回追加したtrust/Firewall例外の後片付けは、事前承認した範囲だけ別手順で照合する。

**今はOwner用START配布を行わない。** 未信頼HTTPSを起動してからOwnerへ警告回避や設定変更を要求しない。信頼経路が決まった後、ワンクリック手順とAndroid実測を一度で確認する。

## 比較と推奨

|方式|Owner操作・制約|判断|
|---|---|---|
|LAN IP+HTTP|接続は簡単でもSW/PWA要件を満たさない|不採用|
|直接LAN HTTPS＋専用CA|端末trust追加が一度必要。PC起動/停止、IP/Firewall管理。LAN内で完結|同一Wi-Fi限定を維持するなら第一候補、承認と実測待ち|
|管理domainの信頼済みHTTPS|端末trust追加不要。domain/DNS/cert管理権限と安定URLが必要|既存の管理済み経路があれば有力、現時点未指定|
|一時HTTPS tunnel|端末trust追加不要。外部公開・新binary/provider・Internet依存。Quick Tunnelは毎回hostnameが変わりDB/PWA継続性に不利|限定比較のみ。開始/自動導入しない。恒常手順には非推奨|

根拠：[W3C secure contexts](https://www.w3.org/TR/secure-contexts/)、[Service Workers](https://www.w3.org/TR/service-workers/)、[Chrome local trust](https://chromium.googlesource.com/chromium/src/+/main/net/data/ssl/chrome_root_store/faq.md)、[Android certificate操作](https://support.google.com/pixelphone/answer/2844832)、[Quick Tunnels制約](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)。Android機種・OS差は実測が必要。
