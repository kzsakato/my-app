# c560d8d CI closeout — PMO #6683907580

Actions #42210461418 completed/failure. Unit job PASS (188 unit tests and build). Normal Chromium 78 PASS / 41 FAIL (119), release Chromium 11 PASS / 35 FAIL (46). Both H12 backup tests pass in both suites, including read-back fault previously failing before fault injection. Full log and artifact: https://github.com/kzsakato/my-app/actions/runs/42210461418

| Classification | Evidence |
|---|---|
| Fixed V1.2 baseline common, representative | H12 grouped real route, H13 Top, H12 Run history. Identical spec/ordinary Playwright configuration and Chromium at c4fe4514 vs ff69edd; both failed at the same accessible-name locators. See base/head excerpts. The earlier Trainer heading baseline comparison remains separate. |
| V1.3-added test integration regression, already corrected | Drag-handle extra span inflated sort-label indexing. Selector-only fix f3ed05d; 12/12 locally, no oracle edits. |
| Fixture/expectation, corrected | H12 required managementMode + optional displayPreferences warning ack. c560d8d now passes both ordinary and release H12 fault test. Prior T-08 correction follows formal Session count. |
| Server, earlier resolved | Prior 4182 no-server failure; current run passes the same worker Restore case. |
| Still unclassified | Linux V12-07 row height expected 57 / received 58; Windows passed. Platform difference observed, root cause and Linux baseline comparison unresolved. Other timeout, count, or deep-equality failures are not classified by resemblance alone. |

PR #9 follow-up dc0497f: new app/plot/fault Evidence in section7-fault and calendar/UI evidence in section7-boundaries. Updated product ff69edd, 195 unit and 3 isolated app tests pass locally. Latest CI #42212489908 was still in progress at closeout. ENV-04/05 existing record remains blocked; no browser guard trial.
