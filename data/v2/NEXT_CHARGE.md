# Next charge

`data/v2/next_charge.json` is the only source for the Next charge page. After each night, replace this file. The page reads it at build time and does not keep its own pack list, charger names, notes, or dates.

The published file uses schema `next_charge/v1`. Any other `schema` value fails the build. Keys below are the v1 names. Do not rename them in the file.

## Document

| Key | Meaning |
| --- | --- |
| `schema` | Must be the string `next_charge/v1`. |
| `as_of_session` | Session the sheet is based on. A date or a session id. |
| `as_of_date_pt` | Pacific calendar date, `YYYY-MM-DD`. |
| `storage_runs` | One object per charger channel. See below. |
| `parallel_boards` | One object per series board. See below. |
| `charge_alone` | Packs that charge on their own before flight. |
| `do_not_connect` | Packs that stay off every lead. |
| `notes` | Strings printed at the bottom of the page. |

## `storage_runs`

Each object is one channel's queue, not one timed run.

| Key | Meaning |
| --- | --- |
| `charger` | Charger alias, such as `DX8-1`. |
| `channel` | Channel name, such as `CH1`. |
| `order` | Pack labels in the order they will be storage-charged on that channel. |

A DX8 storage-charges one pack on a channel at a time. The page turns `order` into runs:

- `order[0]` is Run 1, `order[1]` is Run 2, and so on.
- Each run shows that one pack.
- Above the chargers, Run *n* lists every channel that still has an *n*th pack, in file order. The charger name is printed when it changes: `DX8-1 CH1 C1-P2 · CH2 C1-P5 · DX8-2 CH1 C2-P1 · CH2 C2-P4`.

The same charger and channel cannot appear twice. A pack label cannot appear on two storage channels. Every label must exist in `data/v2/packs.csv`.

A pack may be in `storage_runs` and also on a parallel board or in `charge_alone`. Storage happens first. The pre-flight step is separate.

## `parallel_boards`

| Key | Meaning |
| --- | --- |
| `series` | Series name. Every pack in `packs` must be that series in `packs.csv`. |
| `packs` | Labels in port order. |
| `current` | `normal` or `reduced`. This is the charge current for the whole board. |
| `conditions` | Strings. Limits and exceptions for this board. |
| `last_rule_b_V` | Last Rule B board spread, in volts. A number. |
| `last_rule_b_call` | Call recorded with that Rule B check. |
| `last_rule_b_session` | Session of that Rule B check. |
| `last_rule_b_over` | Optional on v1. Pack labels this Rule B figure covers. Each label is one of this board's `packs`. |

The bench uses 6-port boards. Ports are `L1`, `L2`, `L3`, `R1`, `R2`, `R3`, in that order. `packs[0]` is L1 and `packs[5]` is R3. Empty ports stay blank.

A series with more than 6 packs continues on the next board: pack 7 is L1 on the next letter. Letters are assigned in file order, `Board A` through `Board D`. A series with no packs still takes one board so its current and Rule B line have a drawing. More than 4 boards fails the build.

`current` and `conditions` are printed once for the series, above its board drawing or drawings. When `last_rule_b_over` is present, the page prints Last Rule B as the voltage, the call, and those pack labels, with the V unit. The home chart still draws Rule B from the storage-night rests.

## `charge_alone`

| Key | Meaning |
| --- | --- |
| `label` | Pack label in `packs.csv`. |
| `uid` | That label's `pack_uid`. A mismatch fails the build. |
| `reason` | Why it charges alone. |
| `until` | When it can join a board again. Free text, not necessarily a date. |
| `last_offset_max_V` | Optional on v1. Largest rest offset from that pack's board, in volts. Present only with `last_offset_side`. |
| `last_offset_side` | Optional on v1. `below` or `above`. |

## `do_not_connect`

| Key | Meaning |
| --- | --- |
| `label` | Pack label in `packs.csv`. |
| `uid` | That label's `pack_uid`. A mismatch fails the build. |
| `pool` | Pool name, such as `Rest`. |
| `reason` | Why it stays disconnected. |
| `return_date` | Pacific date it can return, `YYYY-MM-DD`. |

A pack in `do_not_connect` cannot also appear in `storage_runs`, `parallel_boards`, or `charge_alone`.

## What the build checks

`npm run build` runs `scripts/validate-v4.mjs`, which checks this file.

- `schema` is exactly `next_charge/v1`.
- The keys are the ones in this note. `last_rule_b_over`, `last_offset_max_V`, and `last_offset_side` are optional. Any other extra key fails the build.
- Every pack label exists in `packs.csv`.
- Each `uid` matches that label.
- A parallel pack's series matches the board `series`.
- Storage puts one pack on each run, taken from `order`.
- Parallel packs land on L1 through R3, then the next board letter, and stop at 4 boards.
- A disconnected pack is not also given a lead.

Status chips on the page are not stored in this file. They come from the latest status call for that pack, the same way the home page does.
