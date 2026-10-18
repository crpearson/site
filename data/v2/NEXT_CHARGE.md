# Next charge

`next_charge.json` says how the next storage night runs under rules v6: each pack's permanent home channel, the run order for whichever series were flown, and the checks before packs go on a parallel board. It carries run order and file counts only. It holds no log file numbers.

## Document

| Key | What it is |
| --- | --- |
| `schema` | `next_charge/v3` |
| `rules` | `v6` |
| `as_of_session`, `as_of_date_pt` | The latest storage night in the data, and the date this file was built (Pacific) |
| `home_channels` | One row per slot (below) |
| `planner_rules` | How to turn the flown series into a run order (below) |
| `start_order` | `rule` and `mapping`, in words |
| `planner_fixtures` | Every flown-series case worked out in full (below) |
| `parallel_boards` | One entry per series: the rest-voltage check, the recorded and next-night outlook figures, and IR match notes |
| `charge_alone` | Packs pulled (safety or sustained failure): off their board and not charged; their slot is skipped. Empty when none |
| `watch` | Notes only. A pack on this list stays on its board |
| `individual` | D pool packs: charged on their own, never on a board |
| `rest_tests_in_place` | The in-place rest test rule and the tests still open |
| `notes` | Plain-language reminders |

## `home_channels`

One row per slot, for every C1 to C4 slot and every D pool pack:

| Field | Type | Meaning |
| --- | --- | --- |
| `label` | string | Slot label, e.g. `C1-P2`, or `D-1` |
| `uid` | string or null | Permanent pack ID; `null` when the slot is empty |
| `series` | `C1`, `C2`, `C3`, `C4` or `D` | |
| `slot` | integer | Pack number in the series (D packs: their number) |
| `charger` | `DX8-1` or `DX8-2` | |
| `channel` | `1` or `2` | Channel number on that charger |
| `state` | `active`, `empty` or `pulled` | Only `active` slots run. Empty and pulled slots are skipped (a pulled pack gets no storage charge), and nothing is reordered |
| `note` | string or null | Plain reason when the state isn't `active`, and the D pool placement |

Current layout:

| Channel | Slots, in run order |
| --- | --- |
| DX8-1 Channel 1 | C1-P1 (empty), C1-P2, C2-P5, C3-P1, C3-P2, C4-P5 |
| DX8-1 Channel 2 | C1-P3, C1-P4, C2-P6, C3-P3, C3-P4, C4-P6 |
| DX8-2 Channel 1 | C1-P5, C2-P1, C2-P2, C3-P5, C4-P1, C4-P2, D-1 |
| DX8-2 Channel 2 | C1-P6, C2-P3, C2-P4, C3-P6, C4-P3, C4-P4 |

D-1 always goes last on DX8-2 Channel 1, and only on nights it flew.

D-1 is charged on its own for one more storage night, then reviewed for a return to C1-P1. The D-1 checkbox and the fixtures stay as they are, and C1-P1 stays empty until then. The D-1 row note says the same.

## `planner_rules`

| Key | Value |
| --- | --- |
| `series_order` | `["C1", "C2", "C3", "C4", "D"]` |
| `channel_start_order` | `[1, 2]`: on each charger, Channel 1 starts first |
| `skip_empty` | `true`: empty slots are skipped |
| `reorder` | `false`: nothing moves up to fill a gap |
| `include_states` | `["active"]` |
| `d_pool` | D packs run last on DX8-2 Channel 1, in number order, only when ticked as flown |
| `steps` | The steps below, in words |

Steps:
1. Select the flown series and include every active pack in them. Empty and pulled slots are skipped: a pulled pack gets no storage charge, and nothing is reordered.
2. Order each channel by series, then by pack number.
3. Append the D pool packs that were ticked as flown to their channel (last on DX8-2 Channel 1).
4. On each charger, run Channel 1 and Channel 2 in rounds: start Channel 1, then Channel 2, and wait for both before the next round. When one channel is empty, the other continues alone.
5. Count the files per charger: one log file per pack.

## `planner_fixtures`

31 worked cases: every non-empty set of flown series (15), each with D-1 off and on (30), plus one fixture-only case with a made-up pulled C2-P3 to test skipping. The pulled C2-P3 is test data only; it isn't a real status.

| Field | Meaning |
| --- | --- |
| `id` | e.g. `C1+C3+D-1` |
| `name` | `set A`, `set B` or `all four series` where it applies, else `null` |
| `flown_series` | The series ticked as flown |
| `d1_flown` | Whether D-1 was ticked |
| `channels` | Run order per channel, keyed `DX8-1 Channel 1`, `DX8-1 Channel 2`, `DX8-2 Channel 1`, `DX8-2 Channel 2` |
| `rounds` | Per charger, each round as `[Channel 1 pack, Channel 2 pack]`; `null` when that channel has run out |
| `files` | Log files expected per charger (one per pack) |
| `fixture_only`, `fixture_states` | Only on the made-up case: what it tests, and the slot states it uses instead of the real ones |

The builder works out every case twice, with two separate methods, and stops if they disagree.

Example, `C1+D-1` (C1 flown, and D-1):

| Channel | Run order |
| --- | --- |
| DX8-1 Channel 1 | C1-P2 |
| DX8-1 Channel 2 | C1-P3, C1-P4 |
| DX8-2 Channel 1 | C1-P5, D-1 |
| DX8-2 Channel 2 | C1-P6 |

Files: DX8-1 3, DX8-2 3.

All four series, with D-1:

| Channel | Run order |
| --- | --- |
| DX8-1 Channel 1 | C1-P2, C2-P5, C3-P1, C3-P2, C4-P5 |
| DX8-1 Channel 2 | C1-P3, C1-P4, C2-P6, C3-P3, C3-P4, C4-P6 |
| DX8-2 Channel 1 | C1-P5, C2-P1, C2-P2, C3-P5, C4-P1, C4-P2, D-1 |
| DX8-2 Channel 2 | C1-P6, C2-P3, C2-P4, C3-P6, C4-P3, C4-P4 |

Files: DX8-1 11, DX8-2 13.

## `parallel_boards`

One entry per series, with the packs on its board (all active packs not pulled). `conditions` gives the rest-voltage check in words: it applies only when packs are actually connected in parallel. All packs within 0.60 V (0.1 V per cell) are connected together; a pack outside that charges alone that time only, and nothing in its record changes.

- `last_rule_b_V`, `last_rule_b_call`, `last_rule_b_session`, `last_rule_b_over`, `last_rule_b_basis`: the recorded figure, from the packs actually charged together on that series' last board night. It never changes afterwards.
- `outlook_rule_b`: the next-night outlook from the latest rest V of the board's packs (`value_v`, `packs`, `limit_v`, `call`, `check_first`, `value_without_check_first_v`, `packs_without_check_first`).
- `outlook_rule_b.ir_match`: each pack's average IR against the board median over its last 3 storage nights (`packs[]` with `pct_off`, `nights_checked`, `nights_over_25_pct`, `nights_over_35_pct`, `flag` = `ok`, `over 25%` or `over 35%`; `notes` lists the flagged labels). This is a note only: the pack stays on its board at normal current.

## `charge_alone`

`{label, uid, reason, until}`. Packs pulled from their board for safety (puffing or damage, heat, a resting cell under 3.0 V, a cell spread over 0.20 V) or sustained failure (an IR Caution or a cell 100 mV or more low, on 3 of the last 4 storage nights). A pulled pack is not charged: its slot is skipped in the run order like an empty slot, and nothing is reordered.

## `watch`

`{label, uid, note}`. Notes only: IR trend, board IR match, a single high-IR cell, low-cell notes, and in-place rest tests still to read.

## `individual`

`{label, uid, pool, status, note}`. D pool packs. A label here is never on a board or in `charge_alone`.

## `rest_tests_in_place`

The rule (`applies_when`, `min_days` 5, `compare`, `scale_to_days` 7, `pass_max_mv` 10, `borderline_max_mv` 30, `grading`, `needs`) and `open[]`: `{test_id, label, uid, suspect_cell, storage_end_date, storage_end_mV, completes_from}`. A fail is a note only, never a reason to retire a pack.

## What the build checks

The site check validates the shape above. It recomputes every fixture from `home_channels` and `planner_rules`, and checks that no log file numbers appear.
