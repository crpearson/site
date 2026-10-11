# Live fleet status (2026-10-10)

Calls below are the latest status row per pack in `data/v2/status_calls.csv`. A later row marked `unchanged (factual measurement)` records the rest-test baseline and does not replace the parallel call. The wording is the recorded text. Lamp colour uses the parallel half.

| Pack | UID | Parallel | Service |
| --- | --- | --- | --- |
| D-1 | CNHL-2026-001 | Off (Rest pool) | D pool (Watch); rest test RT-001-1 due 2026-10-16 |
| C1-P2 | CNHL-2026-002 | Go | In service |
| C1-P3 | CNHL-2026-003 | Go | In service |
| C1-P4 | CNHL-2026-004 | Off (Rest pool) | Watch; rest test RT-004-1 due 2026-10-16 |
| C1-P5 | CNHL-2026-005 | Caution; charged individually until one clean night, then Go | Watch |
| C1-P6 | CNHL-2026-006 | Go | In service |
| C2-P1 | CNHL-2026-007 | Caution (reduced current) | Watch (IR spread) |
| C2-P2 | CNHL-2026-008 | Off (Rest pool) | Watch; rest test RT-008-1 due 2026-10-16 |
| C2-P3 | CNHL-2026-009 | Go | In service |
| C2-P4 | CNHL-2026-010 | Go | In service |
| C2-P5 | CNHL-2026-011 | Go | In service |
| C2-P6 | CNHL-2026-012 | Go (conditional: join C2 board only if rest V within 0.30 V of board-mates; otherwise charge alone) | In service |

C1-P3 is an owner override. The 2026-10-10 night was clean under that override, so the parallel call is Go and the pack is on the C1 board. The strict 60 mV gap rule is not applied, the low-cell gap stays on monitor, and Cell 4 has no rest test.

C1-P1 is empty. CNHL-2026-001 moved to D-1 on 2026-10-08. C1-P5 is charged individually (Rule B N/A) and stays off the board. Rest pool, day 0 2026-10-09, due 2026-10-16: D-1, C1-P4, and C2-P2. They keep their labels and are off every board. Next parallel: C1, last public measurement 2026-10-10, is C1-P2, C1-P3, C1-P6. C2, last public measurement 2026-10-10, is C2-P1, C2-P3, C2-P4, C2-P5, C2-P6. C2-P6's newest 2026-10-10 call supersedes the earlier Go that night: it joins the C2 board only if its rest voltage is within 0.30 V of the board-mates, and otherwise charges alone. C1 Rule B for P2, P3, and P6 that night is 0.135 V, Go. C2 Rule B that night is 0.479 V, Caution.

IR is true milliohms from `ir_store_v4` (168 rows). C2 IR on 2026-10-10 is provisional until the charger screen check; those figures are marked †. Rules v3: spread caution at 2.0 mΩ and individual at 3.0 mΩ, two nights in a row, with the low-cell gap, floor, and rest-test cuts in `data/status.json`. Rule B is unchanged: go at or under 0.30 V, caution through 0.60 V, hard stop above 0.60 V.

`2026-10-09-restday0` is an individual rest-test baseline: DX8-1 channel 1 is C2-P2, channel 2 is C1-P4. Those rows are not latest IR, not a series or fleet mean, and not Rule B. The chart marks a Rest pool night as Rest pool. D-1's 2026-10-09 run is series D only. Day 0 is 2026-10-09. The 7-day reading is due 2026-10-16 and stays pending. Superseded placeholder rows are not shown. Line resistance is not shown.

## Gaps
- C1 and C2 last public measurement 2026-10-10; D-1 measured 2026-10-09. C1-P4 and C2-P2 also have the rest-day baseline. C2 IR on 2026-10-10 is provisional until the charger screen check.
- Partial nights stay incomplete. Aggregate charts (series mean, Rule B, bake-off, and the fleet trends) draw a solid line through a night with no reading. No value is invented, and those charts have no dotted join, no hollow ring, and no "not charged" legend. Pack pages and tile sparklines still use a faint dotted join between two readings when that pack was not charged, and a hollow ring before the first reading or after the last, while that line is in service. Nights before the pack or series existed, and nights after a move, are not marked. A single reading is a dot. The rest-day baseline does not create those marks for packs that did not run. Series mean IR skips that night entirely. Rule B is N/A when a series ran as an individual baseline. Pack-chart legend: dotted = not charged · ○ = not charged (start/end).
- No capacity in/out series — storage runs are top-ups, not capacity tests.
- DX8 cell IR reads about 2–3.5 mΩ per cell (whole pack about 11–21 mΩ). The DX8's IR accuracy is limited, so IR is used for relative and trend checks only.
- Mapping uses the night's manifest. The usual-low-cell check is advisory only.
- No C3/C4. C2 IR on 2026-10-10 is provisional until the charger screen check.
