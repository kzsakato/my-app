# V1.2検証版 — Owner端末でのV1.1 Backup復元

入口：https://my-app-staging-v1r.kzsakato-lab.workers.dev/

**設定のbuild：V1.2 検証版・Restore対応 / 4d0392db**。
同じURL・DB・PWA IDを維持しています。再install・再seed・データclearは不要です。アイコン名が旧表示でも、画面内の新buildで確認してください。

1. 検証版のタブ/PWAを閉じて開き直し、設定でbuild **4d0392db**を確認。古いbuildのままなら復元を始めず結果だけ担当へ返します。
2. 共通メニュー→設定→**データ管理**→**正規バックアップを選択**で、Android端末にあるV1.1のcanonical Backup JSONを選びます。ファイルをCodex・Issue・チャットへ送る必要はありません。
3. 作成日時、種目/メニュー/履歴等の件数、復元後の設定を確認します。現在の検証データ全体を置き換えます（今のダミー1件の保持は不要というOwner承認済み）。任意設定の補完警告が出た場合は内容を読み、表示された確認欄を確認します。
4. **全データを置き換えて復元**→全置換の最終確認で了承します。
5. **「復元しました。保存後の読み戻し一致を確認しました。」**を確認。画面を戻って内容を確認し、候補PWAを閉じて再度開いて保持を確認します。そのままOwnerの通常系MANをまとめて実施できます。

復元はファイルを端末で読み、同originの専用IndexedDBへ保存する処理です。サーバへBackup本文を送信する実装やanalytics追加はありません。PC正常系テストでは通信を切った状態で復元と再読込まで成功しています。

対象は通常のcanonical Backup envelope（format=training-check-backup、schemaVersion=1）。旧v5/raw JSONの自動変換を追加したものではありません。復元不可/保存成否未確認等が出た場合、内容を無理に編集・変換したりサイトclearをせず、結果だけ返してください。実Backupや実データのスクリーンショット提出は不要です。

異常系MAN、追加ダミー投入、旧1件の保全調査、再install、USB/ADB/証明書設定は不要。本番アプリや他originのデータは変更しません。QA最終LIMITED・本番release/PR#4 merge非GOは維持します。
