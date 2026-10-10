# Live fleet status (2026-10-09)

Calls below are the latest status row per pack in `data/v2/status_calls.csv`. A later row marked `unchanged (factual measurement)` records the rest-test baseline and does not replace the parallel call. The wording is the recorded text. Lamp colour uses the parallel half.

| Pack | UID | Parallel | Service |
| --- | --- | --- | --- |
| D-1 | CNHL-2026-001 | Off (Rest pool) | D pool (Watch); rest test RT-001-1 due 2026-10-16 |
| C1-P2 | CNHL-2026-002 | Go | In service |
| C1-P3 | CNHL-2026-003 | Caution; Go after one clean night | In service |
| C1-P4 | CNHL-2026-004 | Off (Rest pool) | Watch; rest test RT-004-1 due 2026-10-16 |
| C1-P5 | CNHL-2026-005 | Caution; charged individually until one clean night, then Go | Watch |
| C1-P6 | CNHL-2026-006 | Go | In service |
| C2-P1 | CNHL-2026-007 | Go | Watch (IR spread) |
| C2-P2 | CNHL-2026-008 | Off (Rest pool) | Watch; rest test RT-008-1 due 2026-10-16 |
| C2-P3 | CNHL-2026-009 | Go | In service |
| C2-P4 | CNHL-2026-010 | Go | In service |
| C2-P5 | CNHL-2026-011 | Go | In service |
| C2-P6 | CNHL-2026-012 | Go | In service |

C1-P3 is an owner override: Caution, then Go after one clean night. The strict 60 mV gap rule is not applied to that pack, the low-cell gap stays on monitor, and Cell 4 has no rest test.

C1-P1 is empty. CNHL-2026-001 moved to D-1 on 2026-10-08. C1-P5 is charged individually (Rule B N/A). Rest pool, day 0 2026-10-09, due 2026-10-16: D-1, C1-P4, and C2-P2. They keep their labels and are off every board. Next parallel as of 2026-10-09: C1 is C1-P2, C1-P3, C1-P6. C2 is C2-P1, C2-P3, C2-P4, C2-P5, C2-P6.

IR is true milliohms from `ir_store_v4` (159 rows). Rules v3: spread caution at 2.0 mΩ and individual at 3.0 mΩ, two nights in a row, with the low-cell gap, floor, and rest-test cuts in `data/status.json`. Rule B is unchanged: go at or under 0.30 V, caution through 0.60 V, hard stop above 0.60 V.

`2026-10-09-restday0` is an individual rest-test baseline: DX8-1 channel 1 is C2-P2, channel 2 is C1-P4. Those rows are not latest IR, not a series or fleet mean, and not Rule B. The chart marks a Rest pool night as Rest pool. D-1's 2026-10-09 run is series D only. Day 0 is 2026-10-09. The 7-day reading is due 2026-10-16 and stays pending. Superseded placeholder rows are not shown. Line resistance is not shown.

## Gaps
- C1 last fleet night 2026-09-27; C2 last fleet night 2026-09-30; D-1 measured 2026-10-09. C1-P4 and C2-P2 also have the rest-day baseline.
- Partial nights stay incomplete. On every line chart, a not-charged night between two readings in the same service span is a faint dotted join with no invented value. A not-charged night before the first reading or after the last is a hollow ring on the bottom edge, with no value. The rest-day baseline does not create those marks for packs that did not run. Series mean IR skips that night entirely. Rule B is N/A when a series ran as an individual baseline. Legend: dotted = not charged · ○ = not charged (start/end).
- No capacity in/out series — storage runs are top-ups, not capacity tests.
- DX8 cell IR reads about 2–3.5 mΩ per cell (whole pack about 11–21 mΩ). The DX8's IR accuracy is limited, so IR is used for relative and trend checks only.
- Mapping uses the night's manifest. The usual-low-cell check is advisory only.
- No C3/C4; second charger is not in service yet.
