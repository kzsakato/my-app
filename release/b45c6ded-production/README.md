# V1.1 Pages Production準備返却 v1.1 — 2026-10-23

RETURN TO: PMO（親分）。Status: **PREPARED / NOT DEPLOYED / Owner本番実行GO待ち**。

根拠: training-project Issue #28 [Technical #6357153509](https://github.com/kzsakato/training-project/issues/28#issuecomment-6357153509)、[PMO #6357165105](https://github.com/kzsakato/training-project/issues/28#issuecomment-6357165105)。旧candidate保存版v1.0の「別artifact判断待ち」「旧V1Rデータ互換照会」は本判断で解消・対象外。本書が今回の準備結果。

## source・build・環境差分

- 承認source: `b45c6ded5e7457d80018d1cc6986a4f591739f8a`。
- Build: `Build 2026-10-23 / b45c6ded`。
- 保存先: `release/b45c6ded-production/product`、全8ファイルのsize/SHA-256は同directory上位の `manifest.json`。
- source基点から追加されたcandidate保存資料を持つ専用branchで構築。`src/`、`public/`、`vite.config.ts`、package/lockfile等のbuild入力は承認sourceと差分なし。Production設定は改変せず使用。buildで生成されたtsbuildinfoだけを元に戻した。
- `VITE_BUILD_DATE=2026-10-23`、`VITE_BUILD_SHA=b45c6ded5e7457d80018d1cc6986a4f591739f8a`、candidate環境変数unset、.envファイルなしで `npm run build` を1回実行しexit 0。Node 24.21.0/npm 11.19.0。既存installed dependencies利用、再install/lock更新なし。実際の依存版は `evidence/issue28-production/dependencies.json`。Vite 7.3.7/PWA 1.3.0。
- 保存artifactをそのまま検証し、deploy時の再buildは禁止。Buildはsource識別子であり準備commitとは区別する。

| 環境 | 実機確認candidate | 今回Production |
|---|---|---|
| origin | Workers固定guard | 固定guardなし。Pages用 |
| base | `/` | `./`、`/my-app/` 配下で検証 |
| IndexedDB | training-check-v1r11-candidate | training-check v7 |
| PWA/SW | なし | autoUpdate、manifest/start_url `.`、scope `/my-app/` |
| build表示 | V1.1 candidate / b45c6ded | Build 2026-10-23 / b45c6ded |

これは**同一source・環境別artifact**。candidateのJS/HTMLとバイト同一ではない。CSSは同一hash。通常Production設定に含まれる既存prototype HTMLも削除せず8ファイルへ含めた。

主要hash:

- JS `assets/index-Bl9rZEDk.js`: `8ed25d8484f609acaa28f695cddd55c4ed33edc343c1b014fb71b14dcb06c644`
- index.html: `42d729f74de03190fd8e7ac10babc882c1cbb885bb0ae907eb04612ff8cf39d4`
- CSS `assets/index-CxqZBreo.css`: `cd95a5ede2ff652da678c77a6b5a9a32bfe43bf9be41ad9a9ff3a7197140d048`

## 限定検証結果

`node evidence/issue28-production/smoke.mjs`: PASS。Chromium 156.0.8078.4、一時nonpersistent context、390×844、Asia/Tokyo、loopback secure contextで保存artifactを `/my-app/` 配下へそのまま静的配信。

1. 初回起動・設定のBuild表示一致。
2. 空の隔離DBはlegacy表示から始まる。通常UI「設定→データ管理→正規データへの切替を準備→切替準備を確認→2確認チェック→正規データへ切替」でcanonical入口を準備。
3. 合成canonical Backup JSONを通常UIで全量Restore。成功表示とIndexedDB全payloadの完全一致を確認。
4. プロフィール体重を66→67でUI保存、reload後のUI表示とDB read-back一致。
5. 通常UIのBackup出力にも更新値67が含まれる。
6. DB名training-check/version7、candidate DBなし。SW controller `/my-app/sw.js`、scope `/my-app/`。offline reload後もUI/保存値67を確認。
7. pageerror/HTTP 4xx以上なし。

証跡: `evidence/issue28-production/result.json`、`profile-after-reload.png`、再実行可能な `smoke.mjs`。

初回smokeの合成データで初回設定履歴を省略したため、validatorが拒否して検証が停止した。fixtureに必須初回履歴を追加して再実行PASS。App修正・artifact再buildなし。初回拒否の画面はfailure.pngとして保存（最終結果ではない）。

`node release/verify.mjs`: manifest全8ファイルの一覧/サイズ/hash一致。candidate archive検証も別のverifierで継続可能。これらは限定技術検証であり、QA全件再試験・Owner MAN・本番HTTPS検証を代替しない。

## 配信設定変更案（専用branchのみ適用済み）

- `.github/workflows/deploy-pages.yml`: upload pathだけ `release/118ff493/product` → `release/b45c6ded-production/product`。
- `release/verify.mjs`: 対象directory/sourceSHA/成功表示を切替。8ファイル全件size/hash照合を維持。workflowにbuild追加なし。
- 旧118ff493のartifact/manifestは保持。Workers設定/sourceに変更なし。
- mainのrelease/** pushでも自動deployされるため、**本番GO前にこのbranchをmain merge/cherry-pick/pushせず、workflow dispatchしない**。今回main変更・workflow実行・deployなし。
- この準備branchはcandidate起点。将来の配信時もbranch全体をmainへ無検討mergeせず、本番用保存artifact・verifier・workflowの必要差分を採用する。準備成果物の固定commit/hashを照合する。

## 運用と復旧

Technical確定シナリオを採用: 旧Chrome V1Rデータ引継ぎ・旧V1R rollback互換調査は不要。今後Owner本番GO後の配信完了時に実HTTPSでBuild/assets/起動を確認し、OwnerがBrave最新BackupをChromeへ全量Restoreして保存/再表示を確認する。初回Chromeがlegacy画面の場合には上記通常UIでcanonical入口を準備後Restoreする。こちらがOwnerデータの操作を代行するものではない。

Braveに取得済みBackup以降の追加記録があれば移行直前に最新Backupを取得。Restoreは全量置換で、自動同期/mergeではない。移行後Chromeを記録正本としBraveはV1.1を変更せず代理本番機として待機。

Chrome障害時は維持したBrave V1.1へ戻る。Chromeだけに追加した記録はBraveへ自動反映されないため必要なら最新Backupで手動移行（実行は別途Owner判断）。旧V1Rへデータを自動rollbackしない。

静的配信が不完全な場合は本保存manifestで検証済みV1.1 artifactを再配信する手順を採る。旧V1R静的artifactは保持しているが、運用復旧先と混同しない。V1.2検証開始まではWorkersを変更しない。将来V1.2へ更新した後はそのままV1.1代理本番機として使えない。

## 未確認・次Action

- 実GitHub Pages HTTPS配信・既存Chrome SW更新・Android Chrome/Brave実機・Owner最新Backup Restoreと本番保存は未実施。今回の隔離smokeから保証しない。
- Next: PMO（親分）が本返却を確認しOwnerへ本番実行別GOを取得。その後Codexが固定artifact採用・配信・実HTTPS最小確認、Ownerが最新Backup Restore/保存再表示確認。今は配信しない。
- V1.1案件CLOSE維持、QA LIMITEDを最終PASSへ変更しない。
