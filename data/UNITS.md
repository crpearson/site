# UNITS.md: column units, sources and ground-truth status

Created 2026-10-09 under the **Accuracy rule (owner, 2026-10-09)** in SOURCE_OF_TRUTH.md. Every store column is listed here. Any new column needs a row here before it is published.

**Validation key**
- **VALIDATED 2026-10-09 (screen)**: matches the DX8 IR-tab screen photo `uploads/D1-individual-20261009/dx8-screen-ir.png` (D-1, 2026-10-09: cells 3.2/2.9/2.5/2.2/3.0/2.8 mΩ, S_R 16.6 mΩ) against the v4 row `2026-10-09,D-1` (same values).
- **NOT VALIDATED**: no ground-truth reading (screen photo or meter) has been compared yet. Use for trend only, or hold.
- **DERIVED**: computed from other columns. Its status is the weakest of its inputs.
- **METADATA**: an identifier, label or text. No physical unit.

DX8 log line formats (`tools/parse_dx8.py`): `$n;128;t_ms;LR;SR;c1..c8;chk` is the IR sample, about one every 60 s, in 0.1 mΩ units. `$n;130;t_ms;c1..c8;diff;chk` appears once at the end and holds the **charge taken per cell in mAh. It is not IR.** The first data line holds the per-cell start voltages in mV.

## ir_store_v4.csv (private) / public/ir_store_v4.public.csv

The public copy drops `charger_sn`, `raw_file` and `raw_sha256_16`.

| Column | Units | Source (log line / field) | Ground truth |
|---|---|---|---|
| session | — | session_manifest / upload folder | METADATA |
| pack, label_at_time, series_at_time | — | manifest slot mapping | METADATA |
| pack_uid | — | packs.csv registry | METADATA |
| charger_alias | — | header serial → private map | METADATA |
| charger_sn | — | raw log header serial (**private, never public**) | METADATA |
| channel, file_nnn | — | log filename `[Storage_NNN_CHx]` | METADATA |
| charge_mode_at_time, session_type | — | manifest | METADATA |
| c1_mOhm … c6_mOhm | mΩ (cell IR) | `;128;` fields c1..c6, run median ÷10 | **VALIDATED 2026-10-09 (screen)**, exact match on all 6 cells. DX8 IR has limited absolute accuracy, so use it for relative/trend comparison |
| avg_mOhm | mΩ | mean of c1..c6_mOhm | DERIVED from validated cells |
| spread_mOhm | mΩ | max − min of c1..c6_mOhm | DERIVED from validated cells |
| pack_SR_mOhm | mΩ (pack/total IR) | `;128;` field SR, run median ÷10 | **VALIDATED 2026-10-09 (screen)**, 16.6 = 16.6 |
| LR_mOhm | mΩ (line/lead resistance) | `;128;` field LR, run median ÷10 | **NOT VALIDATED**. The screen showed L_R 38.4 mΩ and the store has the run median 34.8 mΩ. L_R changes over the run, so the field mapping is plausible but no value has matched |
| n128 | count | number of `;128;` lines | METADATA (count) |
| ir128_constant | bool | all `;128;` cell tuples identical | METADATA |
| start_c1_mV … start_c6_mV | mV (cell V) | first data line, cell fields | **NOT VALIDATED** against a meter or screen |
| floor_mV, floor_cell | mV / cell index | min of start_cN_mV | DERIVED (not validated) |
| imbalance_mV | mV | max − min of start cells | DERIVED (not validated) |
| low_cell_gap_mV | mV | median(sibling start cells) − floor | DERIVED (not validated) |
| rest_V | V | sum of start_cN_mV ÷1000 (the start-of-run pack voltage, **not** a separately measured rest voltage) | **NOT VALIDATED** |
| cap_c1_mAh … cap_c6_mAh | mAh (charge taken per cell) | `;130;` fields c1..c6 (the old "130 values") | **NOT VALIDATED**. **Never label these IR or mΩ** |
| cap_diff_mAh | mAh | `;130;` diff field | NOT VALIDATED |
| cap_note | text | constant label | METADATA |
| duration_s | s | last data line t_ms ÷1000 | NOT VALIDATED |
| raw_file, raw_sha256_16 | — | file path / hash (**private**) | METADATA |
| v4_note | text | build note | METADATA |

## public/ir_store_v2.public.csv (legacy, `;130;`)

| Column | Units | Source | Ground truth |
|---|---|---|---|
| c1 … c6, avg, spread | **mAh, charge taken per cell** (historically mislabelled "IR mΩ") | `;130;` c1..c6 / mean / max−min | NOT VALIDATED. **Not IR. Never publish as IR** |
| start_floor_mV | mV | first data line min cell | NOT VALIDATED |
| session, pack, note, pack_uid, label_at_time, series_at_time, charger_alias, channel, file_nnn, charge_mode_at_time, session_type | — | as in v4 | METADATA |

## public/packs.csv

| Column | Units | Ground truth |
|---|---|---|
| pack_uid, label, series, brand, model, charge_mode, status, parallel_call, in_service, retired, vendor, notes | — | METADATA |
| cells | count | METADATA |
| capacity_mAh | mAh (nominal, from the brand tag, approximate) | NOT VALIDATED (no capacity test) |
| charge_count | count of logged storage sessions | DERIVED from the store |
| purchase_date | date (blank = unknown) | METADATA |
| price_usd | USD | METADATA (blank until the owner supplies it) |

## public/pack_events.csv
date (date or session id), pack_uid, event, from_label, to_label, reason: all METADATA, no units.

## public/rest_tests.csv

| Column | Units | Ground truth |
|---|---|---|
| test_id, pack_uid, label, reading, result, cycle, source, note | — | METADATA |
| suspect_cell | cell index | METADATA |
| start_date, due_date, reading_date | date | METADATA |
| c1_mV … c6_mV | mV (cell V at the reading) | **NOT VALIDATED** (day-0 rows come from the DX8 log end cells, with no meter check) |
| sibling_median_drop_mV, suspect_drop_mV, excess_mV | mV | DERIVED (not validated, still blank) |

## public/session_manifest.public.csv
session, charger_alias, channel, series, mode, slots, notes: METADATA. nnn_first/nnn_last: file numbers. days_since_last_use: days (owner-reported, "unknown" allowed).

## public/status_calls.csv
date, pack_uid, label_at_time, status, reason, source, ir_basis: text, METADATA. Numbers inside `reason` carry their own units. Rows whose `ir_basis` starts with "pre-v3" quote `;130;` mAh values that were mislabelled IR/mΩ at the time. Do not reuse them as IR.

## Plausibility bounds (Accuracy rule 2)
Cell IR 0.5–15 mΩ · pack IR (S_R) 5–60 mΩ · cell V 2.5–4.35 V. Check with `python3 tools/plausibility_check.py [csv]`. Exit code 1 = flagged rows, hold the release.
