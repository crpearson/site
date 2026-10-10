# Units and validation: public data files

This covers every column in the public CSVs. Validation means the value was compared against a ground-truth reading.

**Validation key**
- **Validated**: validated 2026-10-09 against a DX8 screen photo (pack D-1, 2026-10-09: cell IR 3.2 / 2.9 / 2.5 / 2.2 / 3.0 / 2.8 mΩ and pack S_R 16.6 mΩ both match the data row exactly).
- **Not validated**: not yet compared with a screen photo or meter. Use it for trends only.
- **Derived**: computed from other columns. It is only as reliable as its inputs.
- **Label**: an identifier, date or text. No physical unit.

**DX8 log lines.** The IR line (`;128;`) is sampled about once a minute in 0.1 mΩ steps and holds each cell's IR, the whole-pack IR (S_R) and the lead resistance (L_R). The end-of-run `;130;` line holds the **charge taken per cell in mAh. It is not internal resistance.** The first data line holds each cell's start voltage in mV.

**Plausibility bounds.** Values outside these are held and not published: cell IR 0.5–15 mΩ, pack IR (S_R) 5–60 mΩ, cell voltage 2.5–4.35 V.

## ir_store_v4.public.csv (true IR)

| Column | Units | Source | Validation |
|---|---|---|---|
| session | — | storage night (PT date or S-number) | Label |
| pack, label_at_time, series_at_time, pack_uid | — | slot label at the time / permanent pack ID | Label |
| charger_alias, channel, file_nnn | — | charger alias (DX8-1 / DX8-2), channel, log file number | Label |
| charge_mode_at_time, session_type | — | parallel / individual; night type (`rest-test-day0` = rest-test baseline, not a regular night) | Label |
| c1_mOhm … c6_mOhm | mΩ, cell IR | `;128;` cell fields, median over the run | **Validated** (DX8 IR is best used for relative/trend comparison) |
| avg_mOhm | mΩ | mean of the six cell IRs | Derived from validated |
| spread_mOhm | mΩ | highest minus lowest cell IR | Derived from validated |
| pack_SR_mOhm | mΩ, whole-pack IR | `;128;` S_R field, median over the run | **Validated** |
| LR_mOhm | mΩ, lead/line resistance | `;128;` L_R field | **Not published, not yet validated.** The site must not show it |
| n128 | count | number of IR samples in the run | Label |
| ir128_constant | true/false | all IR samples identical | Label |
| start_c1_mV … start_c6_mV | mV, cell voltage at arrival | first data line | Not validated |
| floor_mV, floor_cell | mV / cell number | lowest start cell | Derived (not validated) |
| imbalance_mV | mV | highest minus lowest start cell | Derived (not validated) |
| low_cell_gap_mV | mV | median of the other five start cells minus the lowest | Derived (not validated) |
| rest_V | V | sum of the six start cell voltages (pack voltage at arrival, not a separate rest measurement) | Not validated |
| cap_c1_mAh … cap_c6_mAh | **mAh, charge taken per cell** | `;130;` line | Not validated. **Not IR** |
| cap_diff_mAh | mAh | `;130;` difference field (highest minus lowest) | Not validated. **Not IR** |
| cap_note | text | label for the mAh columns | Label |
| duration_s | seconds | run length | Not validated |
| v4_note | text | processing note | Label |

## ir_store_v2.public.csv (legacy `;130;` archive)

| Column | Units | Validation |
|---|---|---|
| c1 … c6, avg, spread | **mAh, charge taken per cell** (`;130;` line). Earlier versions mislabelled these as IR in mΩ. **They are not IR** | Not validated |
| start_floor_mV | mV, lowest start cell | Not validated |
| session, pack, note, pack_uid, label_at_time, series_at_time, charger_alias, channel, file_nnn, charge_mode_at_time, session_type | — | Label |

## packs.csv

| Column | Units | Validation |
|---|---|---|
| pack_uid, label, series, brand, model, charge_mode, status, parallel_call, in_service, retired, vendor, notes | — | Label |
| pool, pool_since | — / date (`Rest` = Rest pool: off every board, not charged, during a 7-day rest test) | Label |
| cells | count | Label |
| capacity_mAh | mAh, nominal (brand tag, approximate) | Not validated |
| charge_count | count of logged storage nights | Derived |
| purchase_date | date (blank = unknown) | Label |
| price_usd | US dollars (blank = not supplied) | Label |

## pack_events.csv
date, pack_uid, event (commission, move, rest_test_start, rest_pool_enter, rest_pool_exit), from_label, to_label, reason: all labels, no units.

## rest_tests.csv

| Column | Units | Validation |
|---|---|---|
| test_id, pack_uid, label, reading, result, cycle, source, note | — | Label |
| suspect_cell | cell number | Label |
| start_date, due_date, reading_date | date | Label |
| c1_mV … c6_mV | mV, cell voltage at the reading | Not validated |
| sibling_median_drop_mV, suspect_drop_mV, excess_mV | mV (result PASS ≤10, BORDERLINE 10–30, FAIL >30) | Derived (not validated) |

## session_manifest.public.csv
session, charger_alias, channel, series, mode, slots, notes: labels. nnn_first, nnn_last: log file numbers. days_since_last_use: days, owner-reported ("unknown" allowed).

## status_calls.csv
date, pack_uid, label_at_time, status, reason, source, ir_basis: text. Numbers inside `reason` carry their own units. Rows whose `ir_basis` begins "pre-v3" quote `;130;` charge-per-cell mAh values that were mislabelled IR at the time. **Those numbers are not IR.**
