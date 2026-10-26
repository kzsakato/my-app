# V1.2 ダミー候補 — Android Chrome / PWA 最小確認

**配信先： https://my-app-staging-v1r.kzsakato-lab.workers.dev/**

設定のbuild表示：**V1.2 MAN候補・ダミー専用 / 0c978837**。
メニュー名：**MANダミーメニュー**、種目：**ダミー胸プレス**。
これは本番ではなく公開ダミー専用です。実データ/実Backupは持ち込まないでください。

USB・ADB・Android Studio・証明書追加・Firewall変更・PCローカルserverは不要です。インターネット接続のある同一Wi-Fiから通常のAndroid Chromeで確認できます。PCを起動したままにする必要もありません。

## 確認手順（環境スモークのみ）

1. 当該URLの旧V1Rタブ/PWAが開いている場合だけ閉じる。本番PWA/他siteは操作しない。サイトデータやcacheは消さない。
2. Android Chrome通常タブで上記URLを開く。警告なしのHTTPS、ページ上部の「V1.2 MAN候補・ダミー専用」、MANダミーメニューを確認する。
3. 共通メニュー→設定でbuild **0c978837**を確認してスクリーンショット。本番の名称/実データ/古いV1R表示、証明書警告、エラーなら、その最初の状態で止めて返す。reloadの反復・全サイトclear・SW解除はしない。
4. Android Chromeのメニューから「アプリをインストール」等が出るか確認し、**V12ダミー / V1.2 MAN候補・ダミー専用**の候補だけをインストールする。単なるショートカット追加しかできない場合は、その表示を返す（PWA成功としない）。操作名はChrome/OSにより異なる。
5. 候補PWAを開き、候補名・ダミーメニュー・設定のbuildを確認。Chromeタブと候補PWAを閉じ、候補アイコンから再度開いて同じ表示を確認する。Androidのタスク削除/ブラウザデータ消去/本番PWAアンインストールは不要。
6. 結果を下記形式で返す。本スモークではデータ編集・復元・取消はしない。M01〜M08の本MANはPMO Ready通知を待つ。

```text
Android機種 / OS / Chrome版：
HTTPS到達・候補名：OK / NG / 未実施
設定build 0c978837：一致 / 不一致 / 未実施
インストール案内：アプリ / ショートカットのみ / なし
候補PWA起動：OK / NG / 未実施
閉じる→候補アイコンから再起動：OK / NG / 未実施
最初のエラー・気になった点：
候補画面のスクリーンショット：
```

token/cookie/OTP、実データ、端末serial、メール全文を送らない。Ownerにshell/Git/DevToolsを依頼しない。Android内部のDB/SW詳細とstandalone判定は、PC自動EvidenceやOwnerの見た目だけで実測済みにしない。

## 現在の確認範囲

担当は公開URLのPC隔離ChromiumでHTTPS/候補SHA、専用DB training-check-v12-local-man v7/authority、root SW制御、新規タブでcanonical同一、360px表示を確認済み。Androidのinstall/relaunch・実機表示/内部状態は未確認。ネット切断/offline・自動同期は保証しない。

fixtureは初回起動日の合成1種目/1TI/1Menu/1Entry/1Sessionで、再起動で自動再seedしない。PCスモーク基準日は2026-10-26。M03複数行、M05比較、M07分類警告等のfixture追加/QA照合は残件。
