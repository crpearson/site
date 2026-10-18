# Next charge

`next_charge.json` says how the next storage night runs under rules v7: each pack's permanent home channel, the run order for whichever series were flown, which packs are pulled, and the checks before packs go on a parallel board. It carries run order and file counts only. It holds no log file numbers.

Rules v7 keeps the v6 layout and run order. What changed is when a pack is pulled and when it charges alone, and C1-P1 is back.

## Document

| Key | What it is |
| --- | --- |
| `schema` | `next_charge/v4` |
| `rules` | `v7` |
| `as_of_session`, `as_of_date_pt` | The latest storage night in the data, and the date this file was built (Pacific) |
| `measurement` | How readings are taken, and what the logs can and can't show (below) |
| `home_channels` | One row per slot (below) |
| `planner_rules` | How to turn the flown series into a run order (below) |
| `start_order` | `rule` and `mapping`, in words |
| `planner_fixtures` | Every flown-series case worked out in full (below) |
| `parallel_boards` | One entry per series: the board checks, the recorded and next-night figures, the per-cell check, and IR match notes |
| `pulled` | Packs pulled for fire risk: out of rotation and not charged; their slot is skipped. Empty when none |
| `charge_alone` | Packs that charge alone on the next board night because of a measured single-cell IR step. They stay in rotation. Empty when none |
| `check_before_connecting` | Advisories from the logs: check this pack's resting voltage before connecting it |
| `watch` | Notes only. A pack on this list stays on its board |
| `performance_notes` | IR and low-cell notes. Never a reason to pull a pack or charge it alone |
| `self_discharge_checks` | The self-discharge pull rule, how we check it from logs, and the checks still open |
| `notes` | Plain-language reminders |

## The rules

**Pull** (fire risk only). A pulled pack is out of rotation and is not charged; its slot is skipped like an empty slot and nothing is reordered:
- swelling or pouch damage;
- heat while charging of 45 °C or more, or clearly hotter than the other packs;
- a cell under 1.5 V, or under 2.0 V for about a week;
- self-discharge: after a balanced storage charge, one cell drops 0.05 V or more more than the others within 48 to 72 hours, or any cell loses about 0.10 V within 24 hours;
- abnormal behaviour when charged on its own.

**Charge alone that night**. The pack stays in rotation and nothing in its record changes:
- the board's packs are more than 0.60 V apart;
- any cell is more than 0.10 V from the same-position cell of another pack on the board;
- the pack's own cells are more than 0.10 V apart at rest;
- a cell rests between 2.0 and 3.0 V (below 2.5 V the DX8 uses its restore function);
- a damaged connector (fix it first);
- a port fuse blows or a balance-pin light comes on (the outlier pack charges alone; a pack that keeps causing it gets a 0.30 V gap of its own);
- one cell's IR is at least 2 times its own starting level and at least 2 times the pack median, measured with the pack on its own.

**Performance notes only**: IR trend, board IR match, a single high-IR cell (1.5 times the median and 1.2 mΩ above it), low cells and low-cell gaps.

Storage nights apply only the pull list.

## `measurement`

`rest_rule` (resting voltage at least 90 minutes after a charge or flight), `ir_rule` (IR measured solo only), `from_logs[]` and `not_from_logs[]`.

The logs can show: solo cell IR on every storage run, the first-line cell voltages, and the storage-end voltages.

The logs can't show: pack temperature (the charger reports only its own temperature), swelling, damage or abnormal charging, or flight times. The first log line may be less than 90 minutes after a flight, so voltage signs from the logs are advisories ("check resting voltage before connecting"), never a status change. The board checks themselves happen at the board, before connecting.

## `home_channels`

One row per slot, for every C1 to C4 slot:

| Field | Type | Meaning |
| --- | --- | --- |
| `label` | string | Slot label, e.g. `C1-P2` |
| `uid` | string or null | Permanent pack ID; `null` when the slot is empty |
| `series` | `C1`, `C2`, `C3` or `C4` | |
| `slot` | integer | Pack number in the series |
| `charger` | `DX8-1` or `DX8-2` | |
| `channel` | `1` or `2` | Channel number on that charger |
| `state` | `active`, `empty` or `pulled` | Only `active` slots run. Empty and pulled slots are skipped (a pulled pack is not charged), and nothing is reordered |
| `note` | string or null | Plain reason when the state isn't `active`, or a short note |

Current layout:

| Channel | Slots, in run order |
| --- | --- |
| DX8-1 Channel 1 | C1-P1, C1-P2, C2-P5, C3-P1, C3-P2, C4-P5 |
| DX8-1 Channel 2 | C1-P3, C1-P4, C2-P6, C3-P3, C3-P4, C4-P6 |
| DX8-2 Channel 1 | C1-P5, C2-P1, C2-P2, C3-P5, C4-P1, C4-P2 |
| DX8-2 Channel 2 | C1-P6, C2-P3, C2-P4, C3-P6, C4-P3, C4-P4 |

C1-P1 is back. The pack that left C1-P1 on 2026-10-08 for a weak Cell 6 (D-1) passed its rest test on 2026-10-17 and returns to C1-P1 from the next storage night: same pack, same ID, same history. It charges on DX8-1 Channel 1 and joins the C1 parallel board. Cell 6 is a watch note. There is no D pool now, so there is no D-1 checkbox and no D series in this file.

## `planner_rules`

| Key | Value |
| --- | --- |
| `series_order` | `["C1", "C2", "C3", "C4"]` |
| `channel_start_order` | `[1, 2]`: on each charger, Channel 1 starts first |
| `skip_empty` | `true`: empty slots are skipped |
| `reorder` | `false`: nothing moves up to fill a gap |
| `include_states` | `["active"]` |
| `steps` | The steps below, in words |

Steps:
1. Select the flown series and include every active pack in them. Empty and pulled slots are skipped: a pulled pack gets no storage charge, and nothing is reordered.
2. Order each channel by series, then by pack number.
3. On each charger, run Channel 1 and Channel 2 in rounds: start Channel 1, then Channel 2, and wait for both before the next round. When one channel is empty, the other continues alone.
4. Count the files per charger: one log file per pack.

## `planner_fixtures`

16 worked cases: every non-empty set of flown series (15), plus one fixture-only case with a made-up pulled C2-P3 to test skipping. The pulled C2-P3 is test data only; it isn't a real status.

| Field | Meaning |
| --- | --- |
| `id` | e.g. `C1+C3` |
| `name` | `set A`, `set B` or `all four series` where it applies, else `null` |
| `flown_series` | The series ticked as flown |
| `channels` | Run order per channel, keyed `DX8-1 Channel 1`, `DX8-1 Channel 2`, `DX8-2 Channel 1`, `DX8-2 Channel 2` |
| `rounds` | Per charger, each round as `[Channel 1 pack, Channel 2 pack]`; `null` when that channel has run out |
| `files` | Log files expected per charger (one per pack) |
| `fixture_only`, `fixture_states` | Only on the made-up case: what it tests, and the slot states it uses instead of the real ones |

The builder works out every case twice, with two separate methods, and stops if they disagree. The site check works them out a third time.

Example, `C1` (C1 flown):

| Channel | Run order |
| --- | --- |
| DX8-1 Channel 1 | C1-P1, C1-P2 |
| DX8-1 Channel 2 | C1-P3, C1-P4 |
| DX8-2 Channel 1 | C1-P5 |
| DX8-2 Channel 2 | C1-P6 |

Files: DX8-1 4, DX8-2 2.

All four series:

| Channel | Run order |
| --- | --- |
| DX8-1 Channel 1 | C1-P1, C1-P2, C2-P5, C3-P1, C3-P2, C4-P5 |
| DX8-1 Channel 2 | C1-P3, C1-P4, C2-P6, C3-P3, C3-P4, C4-P6 |
| DX8-2 Channel 1 | C1-P5, C2-P1, C2-P2, C3-P5, C4-P1, C4-P2 |
| DX8-2 Channel 2 | C1-P6, C2-P3, C2-P4, C3-P6, C4-P3, C4-P4 |

Files: DX8-1 12, DX8-2 12.

## `parallel_boards`

One entry per series, with the packs on its board (all active packs). `conditions` gives the board checks in words. They apply only when packs are actually connected in parallel, and they are read at the board before connecting.

- `rest_check_limit_V` (0.60) and `cell_check_limit_V` (0.10).
- `last_rule_b_V`, `last_rule_b_call`, `last_rule_b_session`, `last_rule_b_over`, `last_rule_b_basis`: the recorded figure, from the packs actually charged together on that series' last board night. It never changes afterwards.
- `outlook_rule_b`: the next-night outlook from the latest rest V of the board's packs (`value_v`, `packs`, `limit_v`, `call`, `check_first`, `value_without_check_first_v`, `packs_without_check_first`).
- `outlook_rule_b.cell_check`: same-position cells more than 0.10 V apart in the first log line of the latest storage night (`pairs[]` of `{labels, cell, diff_mv}`, and `labels`). An advisory only.
- `outlook_rule_b.ir_match`: each pack's average IR against the board median over its last 3 storage nights. A performance note only.

## `pulled`, `charge_alone`, `check_before_connecting`

- `pulled`: `{label, uid, reason}`. From the logs the build can see only a cell under 1.5 V or 2.0 V; the other pull signs are reported by hand.
- `charge_alone`: `{label, uid, reason, until}`. Only the measured single-cell IR step (2 times its own level and 2 times the pack median). That board night only.
- `check_before_connecting`: `{label, uid, note}`. Signs in the logs that a board check may fail: cells more than 0.10 V apart, a cell 0.10 V from the same-position cell of another pack, a cell between 2.0 and 3.0 V, or a recent full charge.

## `watch` and `performance_notes`

`{label, uid, note}`. Notes only. Neither list takes a pack off its board.

## `self_discharge_checks`

The pull rule in words and figures (`pull_relative_mv` 50, `pull_window_h` [48, 72], `pull_any_cell_mv` 100, `pull_any_cell_h` 24), `how_we_check`, `longer_gaps`, `performance_grade` (the 7-day grade, a note only) and `open[]`: `{test_id, label, uid, suspect_cell, storage_end_date, storage_end_mV, completes_from}`.

## What the build checks

The site check validates the shape above. It recomputes every fixture from `home_channels` and `planner_rules`, checks that pulled packs are not on a board or in any fixture, and checks that no log file numbers appear.
