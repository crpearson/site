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

C3 and C4 are in rotation: CNHL V2 6S 1300 Black, purchased 2026-10-13. Storage night 2 was 2026-10-16, one pack per run, so it is not a board night. Charge rules v4: every pack charges on its own parallel board, and Watch is a note. C3 and C4 each have all six packs on their board. Neither series has a recorded Rule B yet. The next-night outlook is C3 0.629 V check first (0.430 V without C3-P5) and C4 0.249 V Go, including C4-P2. Those outlook figures are not board results. The Go limit is 0.60 V. C3 and C4 do not share a board with each other or with C1 or C2. C1 and C2 latest IR stays the 2026-10-11 storage night.

C1-P3 is Go. The 2026-10-10 storage night was clean (floor 3636 mV on Cell 4), so the pack is back on the C1 board. Cell 4 low-cell gap stays on monitor (61/92/65 mV over the last 3 nights), and Cell 4 has no rest test.

C1-P5 is Go, on the C1 board, with Watch. The watch note is low Cell 4 (started 61, 77 and 50 mV below the other cells on 2026-09-27, 2026-10-10 and 2026-10-11; lowest cell 3539 mV on 2026-09-27). On 2026-10-11 the C1 board charged C1-P2, C1-P3 and C1-P6 together, 0.186 V apart.

C1-P1 is empty. CNHL-2026-001 moved to D-1 on 2026-10-08. Rest pool, day 0 2026-10-09, due 2026-10-16: D-1, C1-P4, and C2-P2. They keep their labels and are off every board. Next parallel, as of 2026-10-16: C1 is C1-P2, C1-P3, C1-P5, C1-P6 (last measured 2026-10-11). C2 is C2-P1, C2-P3, C2-P4, C2-P5, C2-P6 (last measured 2026-10-11). C3 is C3-P1 through C3-P6. C4 is C4-P1 through C4-P6. Recorded Rule B on 2026-10-11 is C1 0.186 V over C1-P2, C1-P3 and C1-P6, and C2 0.230 V over C2-P1, C2-P3, C2-P4 and C2-P5. The next-night outlook, which is not on the chart, is C1 0.384 V and C2 0.425 V. The 2026-10-10 C1 figure for P2, P3, and P6 stays 0.135 V. C2 that night stays 0.479 V. Both are under the 0.60 V Go limit.

IR is true milliohms from `ir_store_v4` (215 rows, including the 2026-10-11 storage night, two 2026-10-11 charge-run rows, 24 C3/C4 rows from 2026-10-14, and 12 storage rows from 2026-10-16). The 2026-10-14 charge run is not a storage night. The 2026-10-14 and 2026-10-16 storage rows are. DX8-2 IR is validated; a figure is marked provisional only when its `ir_validation` says so. Charge rules v4: every pack charges on its parallel board, Watch is a note, and Rule B goes at or under 0.60 V. A spread of 2.0 mΩ or a cell at 1.5× the pack median is a watch note. A pack is pulled only for safety, or for trouble on 3 of its last 4 nights.

`2026-10-09-restday0` is an individual rest-test baseline: DX8-1 channel 1 is C2-P2, channel 2 is C1-P4. Those rows are not latest IR, not a series or fleet mean, and not Rule B. The chart marks a Rest pool night as Rest pool. D-1's 2026-10-09 run is series D only. Day 0 is 2026-10-09. The 7-day reading is due 2026-10-16 and has not been read. Superseded placeholder rows are not shown. Line resistance is not shown.

## Gaps
- C1 and C2 last public storage measurement 2026-10-11; D-1 measured 2026-10-09. C1-P4 and C2-P2 also have the rest-day baseline. C1-P5 and C2-P6 also have a 2026-10-11 charge run, excluded from latest readings and means. C2-P6 stays conditional Go. The Cell 4 watch on the charge-run call is not the latest call.
- Partial nights stay incomplete. Aggregate charts (series mean, Rule B, bake-off, and the fleet trends) draw a solid line through a night with no reading. No value is invented, and those charts have no dotted join, no hollow ring, and no "not charged" legend. Pack pages and tile sparklines still use a faint dotted join between two readings when that pack was not charged, and a hollow ring before the first reading or after the last, while that line is in service. Nights before the pack or series existed, and nights after a move, are not marked. A single reading is a dot. The rest-day baseline does not create those marks for packs that did not run. Series mean IR skips that night entirely. Rule B is N/A when a series ran as an individual baseline. Pack-chart legend: dotted = not charged · ○ = not charged (start/end).
- No capacity in/out series — storage runs are top-ups, not capacity tests.
- DX8 cell IR reads about 2–3.5 mΩ per cell (whole pack about 11–21 mΩ). The DX8's IR accuracy is limited, so IR is used for relative and trend checks only.
- Mapping uses the night's manifest. The usual-low-cell check is advisory only.
- C3 and C4 storage night 2 was 2026-10-16, one pack per run. Each parallel board holds all six packs, and neither series has a recorded board night. The next-night outlook is C3 0.629 V check first (0.430 V without C3-P5) and C4 0.249 V Go over all six, including C4-P2. The Go limit is 0.60 V. C3 and C4 do not share a board with each other or with C1 or C2. DX8-2 IR is validated against the charger screen.
