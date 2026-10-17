# Next charge

`data/v2/next_charge.json` is the only source for the Next charge page. After each night, replace this file. The page reads it at build time and does not keep its own pack list, charger names, notes, or dates.

The published file uses schema `next_charge/v2` under charge rules `v5`. Any other `schema` value, or a `rules` value other than `v5`, fails the build. One night is one set. The page shows the active set first and keeps the other set one control away.

## Document

| Key | Meaning |
| --- | --- |
| `schema` | Must be the string `next_charge/v2`. |
| `rules` | Must be the string `v5`. The charge rules this sheet follows: the v4 voltage checks plus three IR checks. |
| `as_of_session` | Session the sheet is based on. A date or a session id. |
| `as_of_date_pt` | Pacific calendar date, `YYYY-MM-DD`. |
| `active_set` | The set for tonight, such as `C1+C2`. |
| `locked` | Optional. `true` or `false`. Absent when the sheet is not locked. |
| `locked_reason` | Optional. Why the set is locked, in the file's own words. Required when `locked` is `true`. |
| `active_set_reason` | Why this set is tonight, in the file's own words. |
| `alternate_set` | The other night's set, such as `C3+C4`. It is not the same as `active_set`. |
| `storage_runs` | Tonight's channel queues. These match the active set. |
| `parallel_boards` | Tonight's parallel boards (one per series). These match the active set. An empty list is valid. |
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
| `parallel_boards` | One object per parallel board (one per series). Empty when the set has no board yet. |
| `charge_alone` | Packs that charge on their own. That is a pack pulled for safety or repeated trouble, or a pack whose IR is more than 35% off its board on 2 of its last 3 nights (also listed in `outlook_rule_b.ir_match.charge_alone`). A pack outside the rest check on one night is listed in its board's `outlook_rule_b.check_first`, not here. |
| `watch` | Recheck notes for this set. |
| `join_status` | Optional, legacy. Rules v4 retired the new-pack join rule, so current sheets leave it out. Still accepted if present. |

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
| `current` | `normal` or `reduced`. This is the charge current for the whole board. `reduced` when `outlook_rule_b.ir_match.check_first` is not empty. |
| `conditions` | Strings. Limits and notes for this board. |
| `rest_check_limit_V` | Rest check limit before connecting, in volts. `0.6` (0.1 V per cell on 6S). |
| `last_rule_b_V` | Recorded Rule B: the rest-voltage spread (highest minus lowest pack rest V) over the packs actually charged together on this series' last board night, in volts. A number, or `null` when the series has no recorded board night yet. History: it never changes after that night. |
| `last_rule_b_call` | Call recorded with that check, under the rule in force that night. `null` when `last_rule_b_V` is `null`. |
| `last_rule_b_session` | Session of that board night. `null` when `last_rule_b_V` is `null`. |
| `last_rule_b_over` | Required. Pack labels the recorded figure covers, each one of this board's `packs`. Not empty when `last_rule_b_V` is a number; `[]` when it is `null`. |
| `last_rule_b_basis` | Text. What the recorded figure is based on, printed under it. |
| `outlook_rule_b` | Required object. The next-night outlook, not a board result. See below. |

The bench uses 6-port boards. Ports are `L1`, `L2`, `L3`, `R1`, `R2`, `R3`, in that order. `packs[0]` is L1 and `packs[5]` is R3. Empty ports stay blank.

A series with more than 6 packs continues on the next board: pack 7 is L1 on the next letter. Letters are assigned in file order, `Board A` through `Board D`. A series with no packs still takes one board so its current and Rule B line have a drawing. More than 4 boards fails the build. A set with `parallel_boards: []` draws no board.

`current` and `conditions` are printed once for the series, above its board drawing or drawings. The page prints Last Rule B as the recorded voltage, the call, those pack labels and the session, with the V unit, or "No board night yet" when `last_rule_b_V` is `null`. The home chart plots only recorded `last_rule_b_V` (and storage-night rests of board packs). It never plots `outlook_rule_b`.

### `outlook_rule_b`

The forward-looking rest check for the next night on this board: the latest rest V of every pack assigned to the board. Shown only as the next-night outlook.

| Key | Meaning |
| --- | --- |
| `value_v` | Spread (highest minus lowest latest rest V) over `packs`, in volts. |
| `packs` | Labels it covers. Each one is on this board, no repeats, not empty. |
| `basis` | Text. What the figure is based on. |
| `session` | Session of the latest rest values used. |
| `limit_v` | The rest check limit, in volts (`0.6`). |
| `call` | `GO` when `check_first` is empty. `CHECK FIRST` when it is not. |
| `check_first` | Array, may be empty. Packs whose latest rest V was outside the limit. See below. |
| `value_without_check_first_v` | Spread over the board without the `check_first` packs, in volts. `null` when `check_first` is empty. |
| `packs_without_check_first` | Labels that spread covers: outlook `packs` minus the `check_first` packs. `null` when `check_first` is empty, otherwise not empty. |
| `ir_match` | Required object. The IR board-match check for the next night. See below. `call` above is the rest-voltage call only. |

### `ir_match`

Lives inside `outlook_rule_b`. Each pack's average cell IR (mΩ, from its own single-pack storage run) against the middle value of this board's packs that ran the same night, over the pack's last 3 storage nights. Shown only as the next-night outlook, never plotted as a board result.

| Key | Meaning |
| --- | --- |
| `basis` | Text. What the check is based on. |
| `session` | The board's latest storage session. |
| `board_median_mohm` | Middle value of the board packs' average IR on `session`, in mΩ. `null` if no pack ran that night. |
| `check_first_pct` | `25`. More than this many percent off on `nights_needed` of `of_last_nights` nights means check first. |
| `charge_alone_pct` | `35`. More than this many percent off on `nights_needed` of `of_last_nights` nights means charge alone. Above `check_first_pct`. |
| `nights_needed` | `2`. |
| `of_last_nights` | `3`. |
| `packs` | One object per pack, below. Covers every pack in the board's `packs`, plus any pack it sent to charge alone. |
| `check_first` | Labels whose `flag` is `check first`, in `packs` order. When not empty, the board `current` must be `reduced`. |
| `charge_alone` | Labels whose `flag` is `charge alone`, in `packs` order. |
| `call` | `CHARGE ALONE` if `charge_alone` is not empty, else `CHECK FIRST` if `check_first` is not empty, else `GO`. |

Each object in `ir_match.packs`:

| Key | Meaning |
| --- | --- |
| `label` | Pack label. On this board, unless `flag` is `charge alone`. |
| `avg_mohm` | That pack's latest average cell IR, in mΩ (0.5–15), or `null`. |
| `session` | Session of that reading, or `null`. |
| `pct_off` | Percent off the board median on that night, one decimal, signed (negative is lower IR). `null` if not enough packs ran. |
| `nights_checked` | Nights with at least 3 board packs, out of its last 3 (0–3). |
| `nights_over_check_pct` | Of those, nights more than `check_first_pct` off (0–3). |
| `nights_over_alone_pct` | Of those, nights more than `charge_alone_pct` off (0–3). |
| `flag` | `ok`, `check first` or `charge alone`. A pack with fewer than 3 storage nights is never `charge alone`. |

### `check_first`

Lives inside `outlook_rule_b`. A listed pack has its rest V checked before connecting. If it is still outside the limit, it charges alone that night only, with no status change, and it is back on the board next time.

| Key | Meaning |
| --- | --- |
| `label` | Pack label on this board. |
| `uid` | That label's `pack_uid`. A mismatch fails the build. |
| `last_rest_V` | That pack's latest rest V, in volts (15–26.5 V, one 6S pack). |
| `last_offset_max_V` | Largest rest offset from the other packs on the board, in volts. |
| `last_offset_side` | `below` or `above`. |
| `note` | Printed as written. |

## `charge_alone`

| Key | Meaning |
| --- | --- |
| `label` | Pack label in `packs.csv`. |
| `uid` | That label's `pack_uid`. A mismatch fails the build. |
| `reason` | Why it charges alone. Printed as written. |
| `until` | When it can go back on its board. Free text, not necessarily a date. |
| `last_offset_max_V` | Optional. Largest rest offset from that pack's board, in volts. Present only with `last_offset_side`. |
| `last_offset_side` | Optional. `below` or `above`. |

## `watch`

| Key | Meaning |
| --- | --- |
| `label` | Pack label in `packs.csv`. |
| `uid` | That label's `pack_uid`. |
| `note` | The recheck note, printed as written. |

## `join_status` (optional, legacy)

Rules v4 sheets leave this out. If present it is still checked as below.

| Key | Meaning |
| --- | --- |
| `label` | Pack label in `packs.csv`. |
| `uid` | That label's `pack_uid`. |
| `storage_nights` | Storage nights so far. A number. Charge runs do not count. |
| `clean_nights_in_a_row` | Clean storage nights in a row. A number. |
| `joins_board` | `true` or `false`. `true` means the pack qualifies for its board. It can still charge alone tonight. `false` while that pack is on a parallel board fails the build. |
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

- `schema` is exactly `next_charge/v2`, and `rules` is exactly `v5`.
- The file bytes stay the published sheet. A different hash fails the build.
- The keys are the ones in this note. `locked`, `locked_reason`, `mode`, `join_status`, and `last_offset_max_V` / `last_offset_side` on `charge_alone` are optional. Every parallel board key, including `last_rule_b_over`, `last_rule_b_basis` and `outlook_rule_b` (with `ir_match`), is required. Any other extra key fails the build.
- A recorded `last_rule_b_V` of `null` needs `null` call and session and an empty `last_rule_b_over`.
- `outlook_rule_b.call` is `GO` with an empty `check_first`, or `CHECK FIRST` with a non-empty one, and the `_without_check_first` fields follow it.
- `ir_match` lists every board pack once, its `check_first` / `charge_alone` lists and `call` follow the pack flags, and IR check-first packs need `current: reduced`.
- The top-level plan matches the active set.
- Every pack label exists in `packs.csv`, and each `uid` matches that label.
- A pack's series is one of its set's series. A parallel pack's series matches the board `series`.
- Storage puts one pack on each run, taken from `order`.
- Parallel packs land on L1 through R3, then the next board letter, and stop at 4 boards.
- Rest spreads are 0–2 V, limits are over 0 and at most 2 V, and a `check_first` rest V is 15–26.5 V (one 6S pack).
- A disconnected pack is not also given a lead.

Status chips on the charger and board drawings come from the latest status call for that pack. The watch notes, charge-alone reasons, board conditions, check-first notes, and outlook basis are the file's own words.
