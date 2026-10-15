# Live fleet status (2026-10-14)

Calls below are the latest status row per pack in `data/v2/status_calls.csv`. A later row marked `unchanged (factual measurement)` records the rest-test baseline and does not replace the parallel call. The wording is the recorded text. Lamp colour uses the parallel half.

| Pack | UID | Parallel | Service |
| --- | --- | --- | --- |
| D-1 | CNHL-2026-001 | Off (Rest pool) | D pool (Watch); rest test RT-001-1 due 2026-10-16 |
| C1-P2 | CNHL-2026-002 | Go | In service |
| C1-P3 | CNHL-2026-003 | Go | In service |
| C1-P4 | CNHL-2026-004 | Off (Rest pool) | Watch; rest test RT-004-1 due 2026-10-16 |
| C1-P5 | CNHL-2026-005 | Go (conditional on Rule B) | Watch |
| C1-P6 | CNHL-2026-006 | Go | In service |
| C2-P1 | CNHL-2026-007 | Go | Watch (IR spread) |
| C2-P2 | CNHL-2026-008 | Off (Rest pool) | Watch; rest test RT-008-1 due 2026-10-16 |
| C2-P3 | CNHL-2026-009 | Go | In service |
| C2-P4 | CNHL-2026-010 | Go | In service |
| C2-P5 | CNHL-2026-011 | Go | In service |
| C2-P6 | CNHL-2026-012 | Go (conditional per Rule B) | In service |
| C3-P1 | CNHL-2026-013 | Go (new): charges alone until 2 clean storage nights, night 1 of 2 on 2026-10-14 | In rotation (new) |
| C3-P2 | CNHL-2026-014 | Go (new): charges alone until 2 clean storage nights, night 1 of 2 on 2026-10-14 | In rotation (new) |
| C3-P3 | CNHL-2026-015 | Go (new): charges alone until 2 clean storage nights, night 1 of 2 on 2026-10-14 | In rotation (new) |
| C3-P4 | CNHL-2026-016 | Go (new): charges alone until 2 clean storage nights, night 1 of 2 on 2026-10-14 | In rotation (new) |
| C3-P5 | CNHL-2026-017 | Go (new): charges alone until 2 clean storage nights, night 1 of 2 on 2026-10-14 | In rotation (new) |
| C3-P6 | CNHL-2026-018 | Go (new): charges alone until 2 clean storage nights, night 1 of 2 on 2026-10-14 | In rotation (new) |
| C4-P1 | CNHL-2026-019 | Go (new): charges alone until 2 clean storage nights, night 1 of 2 on 2026-10-14 | In rotation (new) |
| C4-P2 | CNHL-2026-020 | Go (watch) | New (watch) |
| C4-P3 | CNHL-2026-021 | Go (new): charges alone until 2 clean storage nights, night 1 of 2 on 2026-10-14 | In rotation (new) |
| C4-P4 | CNHL-2026-022 | Go (watch) | New (watch) |
| C4-P5 | CNHL-2026-023 | Go (new): charges alone until 2 clean storage nights, night 1 of 2 on 2026-10-14 | In rotation (new) |
| C4-P6 | CNHL-2026-024 | Go (new): charges alone until 2 clean storage nights, night 1 of 2 on 2026-10-14 | In rotation (new) |

C3 and C4 are in rotation: CNHL V2 6S 1300 Black, purchased 2026-10-13, first full charge and storage night 1 on 2026-10-14. Ten packs are Go (new): charges alone until 2 clean storage nights, night 1 of 2 on 2026-10-14. C4-P2 and C4-P4 are Go (watch): watch, recheck next storage night. There is no C3 or C4 board, so there is no Rule B for them. C3 and C4 do not share a board with each other or with C1 or C2. C1 and C2 latest values stay the 2026-10-11 storage night.

C1-P3 is Go. The 2026-10-10 storage night was clean (floor 3636 mV on Cell 4), so the pack is back on the C1 board. Cell 4 low-cell gap stays on monitor (61/92/65 mV over the last 3 nights), and Cell 4 has no rest test.

C1-P5 is Go, with Watch, and stays conditional on Rule B. The 2026-10-11 storage night was clean: floor 3620 mV on Cell 4 and a 50 mV gap. It is back on the C1 board if its rest V is within 0.30 V of the other board packs, otherwise it charges alone. Last 3 storage-night gaps: 61 (2026-09-27), 77 (2026-10-10), 50 (2026-10-11) mV.

C1-P1 is empty. CNHL-2026-001 moved to D-1 on 2026-10-08. Rest pool, day 0 2026-10-09, due 2026-10-16: D-1, C1-P4, and C2-P2. They keep their labels and are off every board. Next parallel, last public measurement 2026-10-11: C1 is C1-P2, C1-P3, C1-P5, C1-P6. C2 is C2-P1, C2-P3, C2-P4, C2-P5, C2-P6. C1-P5 and C2-P6 are conditional on Rule B. On 2026-10-11 they charged individually, so that night's Rule B is C1 P2, P3, and P6 at 0.186 V, Go, and C2 P1, P3, P4, and P5 at 0.230 V, Go. The 2026-10-10 C1 Rule B for P2, P3, and P6 stays 0.135 V, Go. C2 that night stays 0.479 V, Caution.

IR is true milliohms from `ir_store_v4` (203 rows, including the 2026-10-11 storage night, two 2026-10-11 charge-run rows, and 24 C3/C4 rows from 2026-10-14). The 2026-10-14 charge run is not a storage night. The 2026-10-14 storage rows are. DX8-2 IR is validated; a figure is marked provisional only when its `ir_validation` says so. Rules v3: spread caution at 2.0 mΩ and individual at 3.0 mΩ, two nights in a row, with the low-cell gap, floor, and rest-test cuts in `data/status.json`. Rule B is unchanged: go at or under 0.30 V, caution through 0.60 V, hard stop above 0.60 V.

`2026-10-09-restday0` is an individual rest-test baseline: DX8-1 channel 1 is C2-P2, channel 2 is C1-P4. Those rows are not latest IR, not a series or fleet mean, and not Rule B. The chart marks a Rest pool night as Rest pool. D-1's 2026-10-09 run is series D only. Day 0 is 2026-10-09. The 7-day reading is due 2026-10-16 and has not been read. Superseded placeholder rows are not shown. Line resistance is not shown.

## Gaps
- C1 and C2 last public storage measurement 2026-10-11; D-1 measured 2026-10-09. C1-P4 and C2-P2 also have the rest-day baseline. C1-P5 and C2-P6 also have a 2026-10-11 charge run, excluded from latest readings and means. C2-P6 stays conditional Go. The Cell 4 watch on the charge-run call is not the latest call.
- Partial nights stay incomplete. Aggregate charts (series mean, Rule B, bake-off, and the fleet trends) draw a solid line through a night with no reading. No value is invented, and those charts have no dotted join, no hollow ring, and no "not charged" legend. Pack pages and tile sparklines still use a faint dotted join between two readings when that pack was not charged, and a hollow ring before the first reading or after the last, while that line is in service. Nights before the pack or series existed, and nights after a move, are not marked. A single reading is a dot. The rest-day baseline does not create those marks for packs that did not run. Series mean IR skips that night entirely. Rule B is N/A when a series ran as an individual baseline. Pack-chart legend: dotted = not charged · ○ = not charged (start/end).
- No capacity in/out series — storage runs are top-ups, not capacity tests.
- DX8 cell IR reads about 2–3.5 mΩ per cell (whole pack about 11–21 mΩ). The DX8's IR accuracy is limited, so IR is used for relative and trend checks only.
- Mapping uses the night's manifest. The usual-low-cell check is advisory only.
- C3 and C4 are in rotation (CNHL V2 6S 1300 Black, purchased 2026-10-13, first full charge and storage night 1 on 2026-10-14). Ten packs are Go (new): charges alone until 2 clean storage nights, night 1 of 2 on 2026-10-14. C4-P2 and C4-P4 are Go (watch): watch, recheck next storage night. No C3 or C4 board, so no Rule B for them. DX8-2 IR is validated against the charger screen.
