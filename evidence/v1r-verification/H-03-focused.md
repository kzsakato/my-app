# H-20261004-03 — pre-MAN focused coverage

Authority: training-project `cd07e1e`、H-20261004-02 QA RESULT / H-20261004-03。App starting HEAD `1a3d48b04387f215e6d556d52bc80d26bf1d6980`。製品変更・Freeze reopen・snapshot更新なし。

`e2e/v1r-acceptance.spec.ts`の追加test:

| Required scenario | Test suffix（共通prefix `H-03 focused`） | Exact assertions |
| --- | --- | --- |
| 1 同日複数Session | `1 same-day multiple Sessions retain marker until last cancellation` | 10/2の2件から選択したIDのみ取消。1件残存中は10/2 ●、最後に○。各段階でreload/read-backと全canonical非対象field不変 |
| 2 単一Session | `2 single Session cancellation clears its date marker` | 10/2 ●→○、対象ID absent、非対象の9/10 SessionとMaster/SettingChange等不変 |
| 3 複数曜日の過去分から連続取消 | `3 past-first consecutive cancellations change only the target date` | 9/28→9/30→10/2の順で取消。対象日のみ○になり、未取消日の●維持。各段階でcanonical全体一致/reload |
| 4 新Extraが次Runの前回実績 | `4/5 UI Extra completion becomes next Run previous actual and visible completed Exercise` | UI Extra→27kg/8回の過去実績確認→21kg/11回/3set/専用seatで完了→次Extra Runの前回実績に新Sessionの日付/actual/seatを表示。旧27kgが残らない |
| 5 Extra完了後の実施済表示 | 同4/5 | 実際のUI完了→Top推奨曜日でOFF時actual行なし→ONで当該Exercise行1件、CategoryでもOFF→ONで同Exerciseの2 Entry表示。canonical新Session ID/count、標準不変、legacy不変 |

14日marker oracleは固定Clock `2026-10-03T12:00:00+09:00` に対する `2026-09-20`〜`2026-10-03` の明示日付配列。UIの`.item-history`から各日文字を直接取り出し、日付→●/○を全14日比較する。製品のhistory関数をexpected計算に使わない。Extra caseでは10/3 ○→●も直接確認対象になる。

取消のSession選択は記録時名称をfixtureで固有にし、日付と名称の両方をUI locatorに指定する。同日実績の並び順からIDを推測しない。canonical全体のdeep equalityでSession count/identityと非対象fieldを同時に検証する。前週外の非対象Sessionを残して空集合だけの確認を避ける。

初回test authoringで2点を訂正した。日付だけ+firstで同日旧Sessionを選んだつもりになっていたが、実際の一覧は新しい順だったため固有名称指定へ変更。Extraのoptional `menuEntryId`はIndexedDB上で`undefined` keyを持ち得るため、key不存在ではなく契約上の参照値なしをassertする。これらはtest harnessの誤りであり、製品不具合や期待値●/○の変更として処理していない。

Windows releaseおよびLinux CIの最終結果・commit・artifact URLはtraining-projectのH-20261004-03返却に記録。`H-03-results.json`はWindows final release JSON reporterの実測statsとfocused test/attachmentsを抽出したもの。CI artifactにも各取消段階とExtra新SessionのJSON attachmentを含む。

QA pre-MAN受入の代替ではない。PR #1はdraft/unmerged、Owner MANはQA/PMO判断待ち。
