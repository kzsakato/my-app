# Issue #30 localhost / ADB reverse 最小実証 RETURN

2026-10-26 JST、App Development / Codex。Authority: PMO #6405935086、Technical #6405918941、Owner localhost方式GOをGitHubから実取得。

**RESULT: BLOCKED（Android実測待ち）。PC構築/分離スモークはPASS。Android Chrome到達・PWA install/relaunch未実測。QA最終LIMITED・Owner MAN HOLD継続。**

## 固定対象と差分

- b86f14458dd33d8e8d201c3b29594424d55935b7起点。実装source **36dbb58009709b0244dae39aa114fec50597ce1d**、branch `codex/issue30-local-adb`。PR #4 branch、本番main、src/、既存vite config、workflow、release artifactにdiffなし。
- 追加: `vite.v12-local.config.ts`、`tooling/v12-local/{main.ts,serve.mjs,smoke.mjs,README.md,icon-192.png,icon-512.png}`、専用dist ignore1行。既存product画面再設計なし。検証入口の識別文だけを追加。
- build inventory SHA256 **2446dd36e3ad80d465065ffa546c12f83fc9418e3ee348ebbd1886b029042923**、10 files。各SHA256/サイズ/再現するinventory計算形式はartifact.json。これは公開配信先のSHAではなくローカルbuildのもの。
- 入口 `http://localhost:4182/`、127.0.0.1 bind、Host localhostだけ許可。専用DB `training-check-v12-local-man` v7、canonical/app・cutover/state。PWA id=/v12-local-man、scope/start_url=/、PNG192/512、SW cache prefix=v12-local-man。
- 初回全store空だけcanonical合成fixture/authorityを同一transactionで配置。valid既存DBは保持、不完全な非空DBは非破壊停止。実データ/実Backup入力禁止。production/旧stagingのDBを開く処理なし。

## 実施Evidence

Windows、Playwright bundled Chromium **153.0.8010.12**、隔離context、locale ja-JP、timezone Asia/Tokyo。Ownerの通常browser profile/端末DBは使用しない。最終smoke 2026-10-26 01:13:16 UTC（10:13:16 JST）。

- `pnpm exec tsc --noEmit` PASS、`pnpm test` **144/144 PASS**。
- `pnpm exec vite build --config vite.v12-local.config.ts --configLoader runner` PASS、専用PWA生成。最初のbuildでtransform順序不一致を検出し、pre transformへ修正。旧入口が残る初回smokeは中断、最終入口/専用DB/SWの実測PASSを採用（初回を成功とは扱わない）。
- `node tooling/v12-local/smoke.mjs` **7観点 PASS**：secure context＋専用DBのみ作成、canonical authority、再読込/新規tabで不変・SW controller、専用manifest、dummy Backup警告preview/復元disabled/DB不変、wrong Host403、wrong originでDB作成前停止、非空不完全DB停止と非対象dummy sentinel保持（観点はJSONの7 record参照）。
- `Get-NetTCPConnection`は127.0.0.1:4182のみlisten。0.0.0.0/LAN bindなし。production/旧stagingへ接続なし。
- smoke.json、artifact.json、pc.png、backup-preview.pngを保存。画像は担当が目視し、識別文/ダミーメニュー/警告/補正後設定を確認。Backup実適用なし。
- synthetic sentinelは**隔離テスト用**の`training-check`/旧candidate名/新candidate名にだけ置いた。Owner実DBの不変を直接読んだという意味ではない。
- distは専用output、publicDir=false、sourcemap/Ownerファイル/.env/credential/実Backupのcopyなし。fixtureは既存canonical unit-test合成データ由来。新しい公開配信・repository作成・Access/DNS設定なし。

## Android実測の境界

ADBは`Get-Command adb`と標準`%LOCALAPPDATA%/Android/Sdk/platform-tools/adb.exe`で未検出。他の未指定場所すべてに不存在とは断定しない。device/USB/RSA認可状態は未照合。SDK/driver契約や端末設定を独断導入せず、ADB reverseは実行していない。**PCでSW/manifestを確認した結果は、Android installabilityやstandalone再起動のPASSではない。**

担当側のbuild/serve/ADB reverse・安全停止/終了手順はtooling README。Ownerにはshell/test/Git操作を依頼しない。Owner固有の最小操作は、使用するAndroidのUSB接続、必要な場合のUSBデバッグ有効化と当該PCのRSA許可、準備通知後のAndroid Chrome到達・候補PWA install/relaunchのみ。デバッグを望まなければ停止。ADBの導入済み所在があれば所在だけ担当へ伝える（token/serial不要）。未導入の場合の公式Platform Tools導入/driver・規約同意はPMO/Ownerと担当で別途確認し、OwnerへCLI一式を転送しない。

実行計画は対象1台に `reverse --no-rebind tcp:4182 tcp:4182`。既存mappingを上書きせず、終了時は今回追加分だけremove。remove-all/kill-serverなし。本番PWA削除・全サイトclearなし。

根拠: [Android adb](https://developer.android.com/tools/adb)、[Chrome USB port forwarding](https://developer.chrome.com/docs/devtools/remote-debugging/local-server)、[secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts)。localhost USB接続は公開HTTPS配信の証明ではなく、USB切断時のoffline保証もしない。

## MAN適合と残件

既存M01–M08を置換しない。最小fixtureは初回ローカル日付基準・一種目の合成データで、単一予定/Sessionの確認用。M01/02/04/06とM08 previewの準備は可能、M03は単一行の限定確認。M05の複数部位/日付比較、M07の分類警告fixtureは未準備。日付跨ぎで再seedしないため、実施日の期待値をQAが照合する。PWA install/relaunch/standaloneとAndroid固有表示は未実施。公開HTTPSのTLS・実ホスト配信・長期起動条件は残件。

**RETURN TO: PMO→Technical/QA。BLOCKED BY: ADB利用経路・Owner端末USB認可/到達の未実測。WAIT FOR: 担当が利用できるADBの確認/用意とOwnerの最小USB操作、その後のAndroidスモーク・M01–M08範囲照合・PMO Ready。** ローカルserverは実証後に停止する。再開は同一sourceをbuild/serveし同一URLを使うだけで、DBを初期化しない。

新公開配信、production/旧staging変更、実データ操作、既存SW/cache/IDB消去、PR#4 mergeは一切なし。今回の成果でOwner MAN開始を自己承認しない。
