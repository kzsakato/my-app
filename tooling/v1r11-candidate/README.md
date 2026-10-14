# Owner承認済み携帯Brave候補環境

根拠: training-project Issue #27 #6167072460。Product baselineは81019dd8。
この設定の配信対象は既存Worker `my-app-simple-118ff493`のみ。
GitHub Pages/main/携帯Chromeの現行版は対象外。

## Accessを先に確認

このWorkerだけをCloudflare Accessで保護し、Ownerの明示した利用者だけをallowする。
全Worker保護、全員allow、bypass、未保護のpreview代替URLは使用しない。
未認証要求がアプリ本体へ到達しないことと、policyの宛先/allow対象を確認できるまで配信しない。
Access APIの有効化・管理権限・認証済みsessionがなければSTOPしPMOへ返す。

## 固定origin build

App rootで、作業branchのcommit/cleanを確認して以下を実行する。

```powershell
$env:VITE_V1R11_ORIGIN = 'https://my-app-simple-118ff493.kzsakato-lab.workers.dev'
$env:VITE_BUILD_SHA = (git rev-parse HEAD)
pnpm run candidate:build
```

設定はloopbackと上記HTTPSの2値だけを受け付け、artifactには選択した1originを固定する。
DBは`training-check-v1r11-candidate`。PWA/SWは含めない。
既存V1R用simple-staging build/fixture/entryを流用しない。

## 配信（Access保護の実確認後のみ）

```powershell
npx --yes wrangler@4.147.0 deploy --config tooling/v1r11-candidate/wrangler.json
```

候補URL: https://my-app-simple-118ff493.kzsakato-lab.workers.dev/
旧`/app/`へのリンクではなくrootへ入る。
配信version/commit、artifact SHA256、Access有効状態、未認証拒否を記録する。
認証後のorigin/build/必要API/専用IndexedDB保存は環境スモークに限って確認し、QA本試験・Owner MANを代替しない。

## 携帯Braveの切替

Ownerは旧Brave V1Rテストデータの保持を必須としていない。必要なbackupは当該Braveサイトだけで扱う。
旧サイトのタブ/PWAを閉じ、当該workers.devサイトの旧SW/cacheのみ必要範囲で整理する。
旧SWの記録scopeは`/app/`。新root候補の専用DBは旧`training-check`と別であり、一律の旧DB削除は不要。
対象サイトを限定した操作経路を確認できなければ削除しない。Chrome・全ブラウザ・全サイト消去は禁止。
rootをBrave通常タブで開き、Access認証後、設定のbuild表示を配信commitと照合する。
TechnicalのQA隔離データ初期化に従う。携帯時計は変更せず、TR-03時刻制御はPC隔離QA補助とする。

## STOP

Accessが未有効/未確認、公開経路が残存、origin/build不一致、必要APIやDB保存が不成立、対象サイトだけの整理を保証できない場合。
QAの21ケース＋RG-01〜03と合否基準はQA管理のまま。
