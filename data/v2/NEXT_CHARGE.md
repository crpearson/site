# Next charge

`data/v2/next_charge.json` is the only source for the Next charge page. After each night, replace this file. The page reads it at build time and does not keep its own pack list, charger names, notes, or dates.

The published file uses schema `next_charge/v2`. Any other `schema` value fails the build. One night is one set. The page shows the active set first and keeps the other set one control away.

## Document

| Key | Meaning |
| --- | --- |
| `schema` | Must be the string `next_charge/v2`. |
| `rules` | Must be the string `v4`. |
| `as_of_session` | Session the sheet is based on. A date or a session id. |
| `as_of_date_pt` | Pacific calendar date, `YYYY-MM-DD`. |
| `active_set` | The set for tonight, such as `C1+C2`. |
| `locked` | Optional. `true` or `false`. Absent when the sheet is not locked. |
| `locked_reason` | Optional. Why the set is locked, in the file's own words. Required when `locked` is `true`. |
| `active_set_reason` | Why this set is tonight, in the file's own words. |
| `alternate_set` | The other night's set, such as `C3+C4`. It is not the same as `active_set`. |
| `storage_runs` | Tonight's channel queues. These match the active set. |
| `parallel_boards` | Tonight's series boards. These match the active set. An empty list is valid. |
| `charge_alone` | Tonight's packs that charge on their own. These match the active set. |
| `watch` | Tonight's recheck notes. These match the active set. |
| `sets` | Both plans. The object keys are the set names with `+` written as `_`: `C3+C4` is `C3_C4`. |
| `do_not_connect` | Packs that stay off every lead, on either set. |
| `notes` | Strings printed at the bottom of the page. |

`storage_runs`, `parallel_boards`, `charge_alone`, and `watch` at the top of the file are the same JSON as those arrays on the active set. A difference fails the build.

## A set

| Key | Meaning |
| --- | --- |
| `series` | Series names in this set. Every pack in the set is one of these series. |
| `last_storage_session` | Last storage session for this set. |
| `storage_runs` | One object per charger channel. See below. |
| `parallel_boards` | One object per series board. Empty when the set has no board yet. |
| `charge_alone` | Packs held off the board. Empty under rules v4. |
| `watch` | Recheck notes for this set. |
| `join_status` | Not used. The published sheet has no join list. |

The two sets do not share a pack. A pack may be in `storage_runs`, `charge_alone`, and `watch` on the same set.

## `storage_runs`

Each object is one channel's queue, not one timed run.

| Key | Meaning |
| --- | --- |
| `charger` | Charger alias, such as `DX8-1`. |
| `channel` | Channel name, such as `CH1`. |
| `order` | Pack labels in the order they will be storage-charged on that channel. |
| `mode` | Optional. A recorded mode string, such as one pack per run. |

A DX8 storage-charges one pack on a channel at a time. The page turns `order` into runs:

- `order[0]` is Run 1, `order[1]` is Run 2, and so on.
- Each run shows that one pack.
- Above the chargers, Run *n* lists every channel that still has an *n*th pack, in file order. The charger name is printed when it changes: `DX8-1 CH1 C3-P1 · CH2 C3-P4 · DX8-2 CH1 C4-P1 · CH2 C4-P4`.

A charger and channel may appear again later in the list. The first time a channel repeats, that row starts the next queue. Charge-alone packs are listed first, then the board packs. A pack label cannot appear on two storage channels of the same set. Every label must exist in `data/v2/packs.csv`.

A pack may be in `storage_runs` and also on a parallel board or in `charge_alone`. Storage happens first. The pre-flight step is separate.

## `parallel_boards`

| Key | Meaning |
| --- | --- |
| `series` | Series name. Every pack in `packs` must be that series in `packs.csv`, and that series must be in the set. |
| `packs` | Labels in port order. |
| `current` | `normal` or `reduced`. This is the charge current for the whole board. |
| `conditions` | Strings. Limits and exceptions for this board. |
| `rest_check_limit_V` | Go limit before connecting, in volts. The published sheet uses 0.60. |
| `last_rule_b_V` | Recorded board-night spread, in volts. `null` when this series has no board night yet. |
| `last_rule_b_call` | Call recorded with that board night. `null` when `last_rule_b_V` is `null`. |
| `last_rule_b_session` | Session of that board night. `null` when `last_rule_b_V` is `null`. |
| `last_rule_b_over` | Packs charged together that night. Empty when `last_rule_b_V` is `null`. Each label is one of this board's `packs`. |
| `last_rule_b_basis` | Why that recorded figure is what it is. Printed under the recorded line. |
| `outlook_rule_b` | Next-night outlook from the latest rest of every pack assigned to the board. Not a recorded board result. |

The bench uses 6-port boards. Ports are `L1`, `L2`, `L3`, `R1`, `R2`, `R3`, in that order. `packs[0]` is L1 and `packs[5]` is R3. Empty ports stay blank.

A series with more than 6 packs continues on the next board: pack 7 is L1 on the next letter. Letters are assigned in file order, `Board A` through `Board D`. A series with no packs still takes one board so its current and Rule B line have a drawing. More than 4 boards fails the build. A set with `parallel_boards: []` draws no board.

`current` and `conditions` are printed once for the series, above its board drawing or drawings. Recorded Rule B prints the voltage, the call, and `last_rule_b_over`, with the V unit, or the words "No board night yet" when `last_rule_b_V` is null. The outlook is a separate block, "Next-night outlook (not a board result)", with its value in volts, call, limit, packs, and basis. The home chart draws only recorded board nights and store-based parallel nights. It does not draw outlook values.

## `outlook_rule_b`

| Key | Meaning |
| --- | --- |
| `value_v` | Outlook spread, in volts. A number from 0 through 2. |
| `packs` | Labels this outlook covers. Each one is on this board. |
| `basis` | Printed under the outlook. |
| `session` | Night the rests came from. |
| `limit_v` | Go limit for this outlook, in volts. |
| `call` | `GO` or `CHECK FIRST`. |
| `check_first` | Packs outside the limit. Empty when the call is `GO`. |
| `value_without_check_first_v` | Spread without those packs, in volts. `null` when `check_first` is empty. |
| `packs_without_check_first` | Labels in that smaller spread. `null` when `check_first` is empty. |

## `charge_alone`

| Key | Meaning |
| --- | --- |
| `label` | Pack label in `packs.csv`. |
| `uid` | That label's `pack_uid`. A mismatch fails the build. |
| `reason` | Why it charges alone. Printed as written. |
| `until` | When it can join a board again. Free text, not necessarily a date. |
| `last_offset_max_V` | Optional. Largest rest offset from that pack's board, in volts. Present only with `last_offset_side`. |
| `last_offset_side` | Optional. `below` or `above`. |

## `watch`

| Key | Meaning |
| --- | --- |
| `label` | Pack label in `packs.csv`. |
| `uid` | That label's `pack_uid`. |
| `note` | The recheck note, printed as written. |

## `check_first`

Inside `outlook_rule_b`, not on the board itself.

| Key | Meaning |
| --- | --- |
| `label` | Pack label on this board. |
| `uid` | That label's `pack_uid`. |
| `last_rest_V` | That pack's rest voltage on the latest night. |
| `last_offset_max_V` | How far it sat from the board, in volts. |
| `last_offset_side` | `below` or `above`. |
| `note` | Printed as written, under Check first. |

## `join_status`

| Key | Meaning |
| --- | --- |
| `label` | Pack label in `packs.csv`. |
| `uid` | That label's `pack_uid`. |
| `storage_nights` | Storage nights so far. A number. Charge runs do not count. |
| `clean_nights_in_a_row` | Clean storage nights in a row. A number. |
| `joins_board` | Not in the published sheet. |
| `status` | Recorded status, such as `Go (new)` or `Go (watch)`. |
| `rule` | The recorded join rule, in the file's own words. |

## `do_not_connect`

| Key | Meaning |
| --- | --- |
| `label` | Pack label in `packs.csv`. |
| `uid` | That label's `pack_uid`. A mismatch fails the build. |
| `pool` | Pool name, such as `Rest`. |
| `reason` | Why it stays disconnected. |
| `return_date` | Pacific date it can return, `YYYY-MM-DD`. |

A pack in `do_not_connect` cannot also appear in `storage_runs`, `parallel_boards`, or `charge_alone` on the top-level plan or on either set.

## What the build checks

`npm run build` runs `scripts/validate-v4.mjs`, which checks this file.

- `schema` is exactly `next_charge/v2`.
- The file bytes stay the published sheet. A different hash fails the build.
- The keys are the ones in this note. `mode`, `last_offset_max_V`, `last_offset_side`, and `join_status` are optional. Any other extra key fails the build. An outlook voltage that is not a number of volts, or that sits outside 0–2 V (15–26.5 V for a pack rest), fails the build.
- The top-level plan matches the active set.
- Every pack label exists in `packs.csv`, and each `uid` matches that label.
- A pack's series is one of its set's series. A parallel pack's series matches the board `series`.
- Storage puts one pack on each run, taken from `order`.
- Parallel packs land on L1 through R3, then the next board letter, and stop at 4 boards.
- A disconnected pack is not also given a lead.

Status chips on the charger and board drawings come from the latest status call for that pack. The watch notes, charge-alone reasons, board conditions, and join rules are the file's own words.
