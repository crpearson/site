# Live fleet status (2026-10-16)

Calls below are the latest status row per pack in `data/v2/status_calls.csv`. A later row marked `unchanged (factual measurement)` records the rest-test baseline and does not replace the parallel call. The wording is the recorded text. Lamp colour uses the parallel half.

| Pack | UID | Parallel | Service |
| --- | --- | --- | --- |
| D-1 | CNHL-2026-001 | Off (Rest pool) | D pool (Watch); rest test RT-001-1 due 2026-10-16 |
| C1-P2 | CNHL-2026-002 | Go | In service |
| C1-P3 | CNHL-2026-003 | Go | In service |
| C1-P4 | CNHL-2026-004 | Off (Rest pool) | Watch; rest test RT-004-1 due 2026-10-16 |
| C1-P5 | CNHL-2026-005 | Go: on the C1 board | Watch |
| C1-P6 | CNHL-2026-006 | Go | In service |
| C2-P1 | CNHL-2026-007 | Go | Watch (IR spread) |
| C2-P2 | CNHL-2026-008 | Off (Rest pool) | Watch; rest test RT-008-1 due 2026-10-16 |
| C2-P3 | CNHL-2026-009 | Go | In service |
| C2-P4 | CNHL-2026-010 | Go | In service |
| C2-P5 | CNHL-2026-011 | Go | In service |
| C2-P6 | CNHL-2026-012 | Go: on the C2 board | In service |
| C3-P1 | CNHL-2026-013 | Go: on the C3 board | In service |
| C3-P2 | CNHL-2026-014 | Go: on the C3 board | In service |
| C3-P3 | CNHL-2026-015 | Go: on the C3 board | In service |
| C3-P4 | CNHL-2026-016 | Go: on the C3 board | In service |
| C3-P5 | CNHL-2026-017 | Go: on the C3 board | In service (watch) |
| C3-P6 | CNHL-2026-018 | Go: on the C3 board | In service (watch) |
| C4-P1 | CNHL-2026-019 | Go: on the C4 board | In service |
| C4-P2 | CNHL-2026-020 | Go: on the C4 board | In service (watch) |
| C4-P3 | CNHL-2026-021 | Go: on the C4 board | In service |
| C4-P4 | CNHL-2026-022 | Go: on the C4 board | In service |
| C4-P5 | CNHL-2026-023 | Go: on the C4 board | In service |
| C4-P6 | CNHL-2026-024 | Go: on the C4 board | In service |

C3 and C4 are in rotation: CNHL V2 6S 1300 Black, purchased 2026-10-13. Storage night 2 was 2026-10-16, one pack per run, so it is not a board night. Charge rules v5 (2026-10-17): the v4 voltage checks plus three IR checks. Every pack charges on its own parallel board, and Watch is a note. No pack is flagged by the IR checks. C3 and C4 each have all six packs on their board. Neither series has a recorded Rule B yet. The next-night outlook is C3 0.629 V check first (0.430 V without C3-P5) and C4 0.249 V Go, including C4-P2. Those outlook figures are not board results. The Go limit is 0.60 V. C3 and C4 do not share a board with each other or with C1 or C2. C1 and C2 latest IR stays the 2026-10-11 storage night.

C1-P3 is Go. The 2026-10-10 storage night was clean (floor 3636 mV on Cell 4), so the pack is back on the C1 board. Cell 4 low-cell gap stays on monitor (61/92/65 mV over the last 3 nights), and Cell 4 has no rest test.

C1-P5 is Go, on the C1 board, with Watch. The watch note is low Cell 4 (started 61, 77 and 50 mV below the other cells on 2026-09-27, 2026-10-10 and 2026-10-11; lowest cell 3539 mV on 2026-09-27). On 2026-10-11 the C1 board charged C1-P2, C1-P3 and C1-P6 together, 0.186 V apart.

C1-P1 is empty. CNHL-2026-001 moved to D-1 on 2026-10-08. Rest pool, day 0 2026-10-09, due 2026-10-16: D-1, C1-P4, and C2-P2. They keep their labels and are off every board. Next parallel, as of 2026-10-16: C1 is C1-P2, C1-P3, C1-P5, C1-P6 (last measured 2026-10-11). C2 is C2-P1, C2-P3, C2-P4, C2-P5, C2-P6 (last measured 2026-10-11). C3 is C3-P1 through C3-P6. C4 is C4-P1 through C4-P6. Recorded Rule B on 2026-10-11 is C1 0.186 V over C1-P2, C1-P3 and C1-P6, and C2 0.230 V over C2-P1, C2-P3, C2-P4 and C2-P5. The next-night outlook, which is not on the chart, is C1 0.384 V and C2 0.425 V. The 2026-10-10 C1 figure for P2, P3, and P6 stays 0.135 V. C2 that night stays 0.479 V. Both are under the 0.60 V Go limit.

IR is true milliohms from `ir_store_v4` (215 rows, including the 2026-10-11 storage night, two 2026-10-11 charge-run rows, 24 C3/C4 rows from 2026-10-14, and 12 storage rows from 2026-10-16). The 2026-10-14 charge run is not a storage night. The 2026-10-14 and 2026-10-16 storage rows are. DX8-2 IR is validated; a figure is marked provisional only when its `ir_validation` says so. Charge rules v5: every pack charges on its parallel board, Watch is a note, and Rule B goes at or under 0.60 V. A spread of 2.0 mΩ or a cell at 1.5× the pack median is a watch note. A pack is pulled only for safety, or for trouble on 3 of its last 4 nights.

`2026-10-09-restday0` is an individual rest-test baseline: DX8-1 channel 1 is C2-P2, channel 2 is C1-P4. Those rows are not latest IR, not a series or fleet mean, and not Rule B. The chart marks a Rest pool night as Rest pool. D-1's 2026-10-09 run is series D only. Day 0 is 2026-10-09. The 7-day reading is due 2026-10-16 and has not been read. Superseded placeholder rows are not shown. Line resistance is not shown.

## Gaps
- C1 and C2 last public storage measurement 2026-10-11; D-1 measured 2026-10-09. C1-P4 and C2-P2 also have the rest-day baseline. C1-P5 and C2-P6 also have a 2026-10-11 charge run, excluded from latest readings and means. C2-P6 stays conditional Go. The Cell 4 watch on the charge-run call is not the latest call.
- Partial nights stay incomplete. Every recorded reading is joined to the next one, including nights under an earlier label. Aggregate charts (series mean, Rule B, bake-off, and the fleet trends) draw that line solid through a night with no reading. No value is invented, and those charts have no "not charged" legend. Pack pages and tile sparklines use a faint dotted join between two readings when that pack was not charged. Nothing is drawn before the first reading or after the last. A pack with only its first reading is a single point. The rest-day baseline does not add a point for packs that did not run. Series mean IR skips that night entirely. Rule B is N/A when a series ran as an individual baseline. Pack-chart legend: dotted = not charged.
- No capacity in/out series — storage runs are top-ups, not capacity tests.
- DX8 cell IR reads about 2–3.5 mΩ per cell (whole pack about 11–21 mΩ). The DX8's IR accuracy is limited, so IR is used for relative and trend checks only.
- Mapping uses the night's manifest. The usual-low-cell check is advisory only.
- C3 and C4 storage night 2 was 2026-10-16, one pack per run. Each parallel board holds all six packs, and neither series has a recorded board night. The next-night outlook is C3 0.629 V check first (0.430 V without C3-P5) and C4 0.249 V Go over all six, including C4-P2. The Go limit is 0.60 V. C3 and C4 do not share a board with each other or with C1 or C2. DX8-2 IR is validated against the charger screen.

## Rules v6 (2026-10-17)
- `data/v2/next_charge.json` is `next_charge/v3`: `home_channels` (one row per slot, C1-P1 empty until the spare arrives, D-1 last on DX8-2 Channel 1), `planner_rules`, `start_order`, 31 `planner_fixtures` (all 15 flown-series sets × D-1 off/on, plus one fixture-only pulled C2-P3), per-series `parallel_boards`, `charge_alone` (pulls only), `watch` (notes), `individual`, `rest_tests_in_place`. Run order and file counts only; no log numbers.
- `loadNextCharge()` returns a v2-shaped page view (set A and set B) built by `pageView()`; `loadNextChargeV3()` returns the v3 file. `planRuns()` is the site's own planner and must agree with every fixture.
- The rest pool is retired. C1-P4 and C2-P2 are back on the C1 and C2 parallel boards; RT-004-1 and RT-008-1 complete in place from the first reading of their next storage log. D-1 stays in rotation in the D pool, charged on its own.
- Pulls only for safety or sustained failure. IR trend, board IR match and single-cell IR are notes; no reduced current.

## Rules v7 (2026-10-17)
- `data/v2/next_charge.json` is `next_charge/v4` (rules `v7`): same v6 layout, plus `measurement`, `pulled` (fire risk only; matches the pulled `home_channels` rows; not charged, slot skipped), `charge_alone` (next board night only, measured single-cell IR step), `check_before_connecting` (advisories from logs), `watch`, `performance_notes`, `self_discharge_checks`. Boards carry `cell_check_limit_V` and `outlook_rule_b.cell_check` (same-position cells over 0.10 V). No `individual`, no D rows, no `d1_flown`.
- `home_channels` has 24 rows; C1-P1 is CNHL-2026-001 again (DX8-1 Channel 1). `planner_rules.series_order` is C1–C4 (the D series is not needed by the schema). 16 `planner_fixtures`: the 15 flown-series sets plus the fixture-only pulled C2-P3. Builder (two implementations) and `planRuns()` agree.
- `loadNextChargeV4()` returns the v4 file; `pageView()` builds the v2 page view: `watch` = watch + check-before-connecting advisories; charge-alone packs leave the page boards.
- `seriesIds()` keeps a series that still has history (series D, for the D-1 nights) so moved packs keep their line.
- Pull: swelling or pouch damage; charge heat ≥45 °C or clearly hotter; a cell under 1.5 V (or under 2.0 V for about a week); self-discharge (≥0.05 V relative in 48–72 h, or ~0.10 V in 24 h); abnormal solo charge. Charge alone that night: 0.60 V pack spread; a cell 0.10 V from the same-position cell of another pack; 0.10 V in-pack spread; a cell 2.0–3.0 V; damaged connector; IR step 2× own and 2× pack median; a blown port fuse or lit balance-pin light (0.30 V personal gap if repeated). Storage nights apply only the pull list.
