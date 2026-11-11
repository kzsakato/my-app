# Issue #30 Owner NG/追加要求 一次対応 RETURN

2026-10-27 JST、App Development/Codex。

**RESULT: BLOCKED（V12-01原因未確定の残件）。V12-04は最小修正・再配信PASS、V12-07は照合/提案返却まで実施。Owner実機NGをPC PASSで取り消さず、QA最終LIMITEDを維持。**

Authority：[PMO #6431436266](https://github.com/kzsakato/training-project/issues/30#issuecomment-6431436266)、[QA Owner報告 #6431419651](https://github.com/kzsakato/training-project/issues/30#issuecomment-6431419651)をGitHubから実取得。OKのV12-02/05/06は再調査しない。V12-07は実装せず最小案だけ返す。既存Worker以外への配信/production mergeは非GO。

両repo fetch後開始clean、App local/remote 3ab25c7、Project local/remote main 8b938f3。TRAINING_PROJECT、Role、handoff/README、正式app-design TOP/REGION/EXTRA・06 §4.5、既存target testsを確認。PS/Library/旧root資料は前提にしない。

## V12-01 調査結果・修正保留

正式06 §4.5とTOP/REGION追補は、OFFでも**完了表示を持つ予定Entryを残す**、ONのときだけ**別の実績Sessionを1 ID=1行**で追加する契約。現在renderEntryはEntry.idで1行、renderCompletedはSession.idで1行。TOPはshowCompleted、REGIONはcategoryShowCompletedのtrue条件下だけ実績projectionを描画する。OFF branchからSessionを描画する経路は確認できない。

対象既存回帰（TOP/REGION各PC/360px）**4件PASS**。さらに通常canonical BackupのRestoreを通して、同Exerciseに2予定Entry/2異なるSessionを持つ合成ケースで再現確認した（Ownerファイル/追加提出なし、検証サイトへfixture追加配信なし）。

|画面|OFF|ON|切替/保存データ|
|---|---|---|---|
|TOP|予定2、実績0。予定の実施済badgeは残る|予定2＋実績2、Session IDはsession-2/session-1各1回|繰返し切替でも実績増加なし、canonical不変|
|REGION|予定2、実績0。予定の実施済badgeは残る|予定2＋実績2、Session IDはsession-2/session-1各1回|同上|

新規対象E2EもPC/360pxでPASS。`*-projection.json`、`*-TOP/REGION-OFF/ON.png`を保存。合成ケースの画面/IDだけで、Owner実機の同一現象を再現したとはしない。

**確定できたこと**：現在の再現ケースでSession二重描画/RestoreによるSession増殖はない。**未確定**：Owner環境で実績SessionがOFFでも表示/ONで重複した根因。予定行にも同じ名称/「実施済」が出て、実績行と視覚的に似ることは原因候補だが、Ownerの誤認と断定しない。

根拠のないfilter/dedup/Session削除や、完了予定EntryをOFFで隠す変更は行わない（正式契約と保存データを変えてしまう）。**V12-01のproduction code修正は未実施**。見分け改善の最小候補は予定/実績セクションの明示ラベルだが、新しいvisible deltaなので今回自己承認して追加しない。PMO/Technicalへ、現contractとOwner期待の照合・その表示改善scopeを限定判断として返す。Ownerに実Backup/追加fixture/再installを要求しない。

## V12-04 修正・検証

- 曜日群DOMの後へ全ON/全OFFを移動。
- `.weekday-actions`をfull-basis flex/nowrapとし、2buttonを同一行に維持。
- ラベルは既存inherit16pxから**14.6667px（−1 CSS pt）**、white-space:nowrap。min-height44px、7曜日checkbox、選択semanticsは維持。
- PC/360pxの両方で位置（全曜日の下）、両button同じY、fontsize、文字clipなしをPASS。全ON=7、全OFF=0、「実施済も表示」値不変を確認。`*-weekday.json/png`。

product差分は**CanonicalApp.tsx内の全ON/OFF div位置1件とv1r11.css内の当該2selectorだけ**。新control・Data Contract・保存処理・status文字サイズ・他3件のOK機能は変更なし。型検査/専用build/dry-run PASS。今回対象のE2Eは4件（V12-01/04×PC/360px）、既存V12-01回帰4件。OK3項目の再調査や広範な異常系試験はしていない。

## V12-07 未実装の最小案

**[V12_07_MINIMUM_PROPOSAL.md](V12_07_MINIMUM_PROPOSAL.md)**。現EXTRAは14日●○なし。既存14日関数はTOP/REGIONにあり、snapshot.exerciseId×保存date、13日前〜今日の14暦日、左古/右今日、週開始に｜。

第一案は既存行2行目の数値左・14日●○右へ横並び、既存行高/矢印/操作を維持し新しい行/画面/buttonを増やさない。N日除外/今週completion/データは不変。Ownerの「14日履歴」が**●○列追加か、文字ラベルだけか**は未FIXなのでPMO/所管へ確認事項として返す。V12-07のUI/コードは今回変更していない。

## 配信結果（V12-04のみ反映）

- URL：**https://my-app-staging-v1r.kzsakato-lab.workers.dev/**
- source：**71390afc2754e109d01b9c8c28d564a36c0e4883**（設定build71390afc）
- version：**5e978e9c-db4d-4775-ac55-8e5e5d055652、100%**
- deployment：2462aa43-a534-4820-94a4-06d3620101a2
- deploy：2026-10-27 **01:37:11 UTC / 10:37:11 JST**、1Workerのみ成功。
- artifact inventory SHA256：**96fc1313cea166720a25b54a9941290a683b9c2ca69c23ddc42817a10a4d6b69**、10assetsすべて公開GET/hash一致。
- 公開URLの隔離PC/360pxでV12-04 geometry/源SHA一致を再確認。Parent16px→14.6667px、両button Y同値、文字nowrap/clipなし（remote-weekday.json/png）。Androidの修正後受入は未実施。

同じDB/PWA ID・Restore対応を維持。Owner実データ/Backup/通常profileは一切使用・取得しない。追加fixtureを配信せず、既存非空DBの再seed/clearなし。他2 Worker/bindings/subdomain、本番Pages/main前後不変（before/after/invariants.json）。Access/route/DNS/production/PR#4 merge不変更。

## RETURN / 残件

**RETURN TO: PMO→Technical/QA。**

- V12-01：Owner実機NG/原因未特定を残し、PC再現事実と契約の整合から最小表示改善の判断を依頼。実データに合わせた推測修正やNG相殺はしない。
- V12-04：修正配信済み。新build71390afcでOwnerの指定配置に合うか確認可能。再install/実Backup再提出/復元し直しは不要。
- V12-07：案と未FIX1点を返却。承認前の実装なし。

**OWNER ACTION:** 現時点で追加fixture/実Backup/再install要求なし。PMOのまとめた結果案内で04を確認し、01の表示意図/07形式の限定判断が必要なら一度に扱う。QA最終LIMITED（既知NGあり）、本番release非GO維持。
