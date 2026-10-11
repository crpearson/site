# Next charge

`data/v2/next_charge.json` is the only source for the Next charge page. After each night, replace this file. The page reads it at build time and does not keep its own pack list, charger names, notes, or dates.

Pack labels are the current `label` values in `data/v2/packs.csv`. Each chip links to `/pack/<pack_uid>/`. The word on the chip (GO, CAUTION, ALONE, REST, WATCH) is the same chip as the Packs grid, from that pack's latest status call, when the call maps to one.

`as_of` is a Pacific Time calendar date (`YYYY-MM-DD`). `based_on_session` is the night this layout is based on (a PT date or a session id such as `S413`). `status_calls_link` is a path on this site, usually `/#calls-heading`.

## Shape

```json
{
  "as_of": "2026-10-10",
  "based_on_session": "2026-10-10",
  "status_calls_link": "/#calls-heading",
  "storage": {
    "chargers": [
      {
        "name": "DX8-1",
        "channels": [
          {
            "name": "CH1",
            "runs": [{ "run": 1, "packs": ["C1-P2", "C1-P3"], "note": "optional" }]
          }
        ]
      }
    ]
  },
  "parallel": {
    "boards": [
      {
        "name": "Board A",
        "series": "C1",
        "ports": [{ "pack": "C1-P2", "port": "L1", "note": "optional" }],
        "notes": ["optional board note"]
      }
    ],
    "charge_alone": [{ "pack": "C1-P5", "reason": "Charged alone" }]
  },
  "dont_connect": [
    { "pack": "D-1", "reason": "Rest pool 7-day rest test", "returns": "2026-10-16" }
  ]
}
```

| Field | Required | Meaning |
| --- | --- | --- |
| `as_of` | yes | PT date the sheet was written |
| `based_on_session` | yes | Night the sheet is based on |
| `status_calls_link` | yes | Site path for the status-call link in the header |
| `storage.chargers[].name` | yes | Charger label drawn on that charger |
| `storage.chargers[].channels[].name` | yes | Port label, such as `CH1` |
| `storage.chargers[].channels[].runs[].run` | yes | `1`, then `2`, then `3`, with no gaps |
| `storage.chargers[].channels[].runs[].packs` | yes | Pack labels in connect order for that run |
| `storage.chargers[].channels[].runs[].note` | no | Short note under that run |
| `parallel.boards[].name` | no | Physical board: `Board A`, `Board B`, `Board C`, or `Board D`. At most four boards |
| `parallel.boards[].series` | yes | Series id. Every pack on the board must be that series |
| `parallel.boards[].ports[].pack` | yes | Pack plugged into a port |
| `parallel.boards[].ports[].port` | no | `L1`, `L2`, `L3`, `R1`, `R2`, or `R3`. If omitted, packs fill that order |
| `parallel.boards[].ports[].note` | no | Note on that pack |
| `parallel.boards[].notes` | yes | Board notes. Use `[]` when there are none |
| `parallel.charge_alone[].pack` | yes | Pack charged on its own, not on a board |
| `parallel.charge_alone[].reason` | yes | Why it stays off the board |
| `dont_connect[].pack` | yes | Pack that must not be connected |
| `dont_connect[].reason` | yes | Why it stays off |
| `dont_connect[].returns` | yes | PT date it can come back, `YYYY-MM-DD` |

Unknown fields are rejected. The same pack may appear in storage and again on a pre-flight board or in `charge_alone`. Those are two steps. It may not appear twice inside storage, twice inside the parallel section, or twice in `dont_connect`.

## Runs

A DX8 channel's default assignment is three packs. That list is `DEFAULT_SLOTS` in `scripts/ingest.py` (the methodology says each channel handles three packs). The build reads those lists and uses their length as **run-at-once**. Today that number is 3.

Write packs in connect order.

- When the channel has run-at-once packs or fewer, use one run. The page does not print "Run 1".
- When the channel has more, split them into runs of at most run-at-once, numbered 1, 2, 3 in that order. The page prints Run 1, Run 2, Run 3.

A channel that fits in one run and is split anyway fails the build. A run with more than run-at-once packs fails the build.

## What the build rejects

`npm run build` runs `lib/next-charge.mjs` before the site is exported. The build fails when:

- a pack label is not a current label in `data/v2/packs.csv`
- a pack is listed twice in storage, twice in the parallel section (board ports and charge-alone), or twice in don't connect
- a pack is in a connect slot (a storage run, a board port, or charge-alone) and also in don't connect
- a run is larger than run-at-once, or a channel that fits in one run is split
- run numbers are not 1, 2, 3 in order
- a board port's series does not match `packs.csv`
- a board name is not Board A–D, a name is repeated, or there are more than four boards
- a port is not L1–L3 or R1–R3, a port is used twice, or a board lists more than six packs
- a date is not `YYYY-MM-DD`, or a required field is missing or unknown

## Parallel boards

There are four identical 6-port boards. A file may name up to four of them `Board A` through `Board D`. Each drawn board has six ports:

| Left | Right |
| --- | --- |
| L1 | R1 |
| L2 | R2 |
| L3 | R3 |

Give `port` when a pack does not sit in that default sequence. When `port` is omitted, the pack takes the next free id in the order L1, L2, L3, R1, R2, R3. A port id used twice, a port outside that list, or a seventh pack fails the build.

## How it is drawn

The page draws one charger for each `storage.chargers` entry, with one port for each channel, and the packs of each run in order.

Each parallel entry is a stylized 6-port board: three ports down the left, three down the right, a fuse for each port in the center, a balance header on each outer edge, an input pair with a 3-digit meter and a discharge block along the top, and the main lead and balance lead along the bottom. Pack chips sit on the ports that have a pack. Empty ports stay numbered and blank. The drawing is not a picture of a product and has no brand name. Charge-alone packs are drawn off the board. Don't-connect rows show the reason and the return date.
