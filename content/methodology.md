# Methodology — LostPennyFPV LiPo Fleet Health

*How this fleet is charged, logged, and judged. These are one hobbyist's working rules for one fleet, not manufacturer guidance. Version: 2026-10-08 (pack registry v2).*

## Why track packs at all

5" FPV packs usually fail one cell at a time. When packs are parallel-charged, one bad cell can put the whole board at risk. The goal here is to catch a weak pack early, keep it off the parallel board, and follow every pack's health over months and years.

## Hardware

| Item | What's used |
| --- | --- |
| Packs | CNHL V2 6S ~1300 mAh (Black). 12 packs in two series of six (**C1** and **C2**), plus a **D** pool for packs that are only charged individually. Two more CNHL V2 6S ~1300 series, **C3** and **C4**, are planned |
| Chargers | Two Junsi iCharger DX8s, **DX8-1** and **DX8-2**. For storage logs each charger channel handles three packs (see *Mapping logs to packs*) |
| Power supply | Chargery S1500, usually set to 28 V |
| Parallel boards | HGLRC Thor 6-port, fused |
| Extra charger | HOTA D6 Pro on the same PSU. It handles extra parallel work only and **isn't used for tracking logs** |

A pack is only ever parallel-charged with its own series. Series are never mixed on a board, and brands are never mixed in a series.

*Status note: DX8-2 is a replacement unit. Every night logged so far ran on DX8-1 (C1 on channel 1, C2 on channel 2). The split described below applies from DX8-2's first logged night.*

## Pack identity

- Every physical pack has a **permanent ID** in the form `{brand}-{year}-{number}`, e.g. `CNHL-2026-001`. The year is the year the ID was assigned. IDs are never reused and don't include the slot.
- The **label** (e.g. `C1-P4`) is the pack's current slot in a series. Series slots are `C1-P1…P6`, `C2-P1…P6`, and later `C3-P1…`, `C4-P1…`. Packs in the D pool are labeled `D-1`, `D-2`, and so on.
- When a pack moves (for example from a series to the D pool), its ID and full history go with it. When a new pack takes over a slot, it gets a new ID, and the old pack's history stays under its own ID.
- Every move, replacement, and retirement is logged as a dated event, and every status call is kept as a dated history.

## The routine

1. **Before a flying session, parallel-charge by series** at about 1.5C. A series with a Caution pack on its board charges at reduced current. Packs in the D pool, and any pack marked *individual*, are never parallel-charged.
2. **Fly.**
3. **After flying, storage-charge each pack individually** on its assigned DX8 channel, in label order, in **Storage mode, 3.85 V/cell**. Charging one pack at a time is what exposes a weak cell that a parallel board would hide.
4. **Upload the DX8 Storage logs** with their original file names, plus a short note of which packs ran on which charger and channel that night. Every raw log is kept permanently. Nothing is ever deleted, and new data is only ever added.

### What gets logged
From each DX8 Storage log:
- **Header:** model, firmware, and the charger's serial number. The header is what identifies the charger, and it's authoritative. Public data shows the charger names DX8-1 and DX8-2 only.
- **First data line:** six cell voltages when the pack arrives, before charging. These give the lowest-cell starting voltage, how far apart the cells are on arrival, and the pack's resting voltage (the sum of the cells).
- **Final IR line:** the charger's per-cell internal resistance (IR) reading for cells 1–6.
- **End voltages:** these should settle near storage voltage. Logs that are seconds long, empty, or errored stay in the archive but are left out of the numbers.

### Session and file numbering
- The DX8 auto-names files `LiPo[Storage_NNN_CHx].txt` and counts NNN upward.
- **NNN is per charger.** DX8-1's file 100 has nothing to do with DX8-2's file 100, so number streams are never merged across chargers.
- A **session** is one Storage night, named by calendar date (Pacific), e.g. `2026-09-27`. Older nights used `S` + their lowest file number (e.g. `S413`) and keep those names.
- If only some series ran that night, only those packs get rows. Anything that didn't run is left as a gap and never filled in.

## Mapping logs to packs

1. **Each night has a manifest.** For every charger and channel it lists which labels ran, in slot order (e.g. `C1-P2 | C1-P3`). Packs charged individually get their own manifest line.
2. **Default storage split:**

| Charger | Channel | Packs |
| --- | --- | --- |
| DX8-1 | 1 | C1-P1, C1-P2, C1-P3 |
| DX8-1 | 2 | C1-P4, C1-P5, C1-P6 |
| DX8-2 | 1 | C2-P1, C2-P2, C2-P3 |
| DX8-2 | 2 | C2-P4, C2-P5, C2-P6 |

   Where C3, C4, and the D pool run is declared in that night's manifest.
3. Split files by charger, then by channel. Within each, sort by NNN ascending and match them in order to the labels listed in the manifest. **If the number of files doesn't equal the number of listed packs, nothing is mapped until the owner confirms.** Nothing is ever guessed.
4. **Check fingerprints before trusting the map.** Some packs have stable quirks that show up night after night:
   - **Hard fingerprints** (must pass or the night stops): C1-P4 Cell 1 is that pack's highest-IR cell, and C2-P2 Cell 3 is that pack's lowest-IR cell.
   - **Soft fingerprints** (advisory): the pack now labeled D-1 has a chronic low floor on Cell 6; C2-P6 is the lowest-IR pack in C2; C2-P4 has the tightest spread.
5. If a hard fingerprint fails, nothing is added for that night until the right order is confirmed. Packs are **never quietly relabeled**. A soft miss gets noted but doesn't trigger a remap.

## Metrics and thresholds

### 1. Per-cell IR (DX8)
The DX8 reports roughly **400–600 mΩ per cell** on these packs. That scale **doesn't match** the absolute IR numbers from other meters or manufacturers, so this fleet never uses absolute "retire above X mΩ" cutoffs. It uses **relative** rules only: within a pack, against the pack's own history, and against its siblings.

### 2. In-pack IR spread (Rule A: one pack)
Spread = highest-cell IR minus lowest-cell IR within one pack that night. Applies to every pack, including individually charged ones.

| Spread | Call |
| --- | --- |
| **Under 40 mΩ** | Go |
| **40–49 mΩ** | Caution. An early warning, **not a scrap order** |
| **50 mΩ or more** | Pull from the parallel board |

### 3. Pack-to-pack rest-voltage delta (Rule B: the board)
For the packs sharing one series board that night, take the gap between the highest and lowest resting voltage. It's worked out separately for each series on each night, using only the packs that are parallel-charged.

| Delta | Call |
| --- | --- |
| **0.30 V or less** | Go |
| **0.30–0.60 V** | Caution. Soft stop, so consider leaving the outlier pack off |
| **Over 0.60 V** | Hard stop. Don't parallel that mix |

Rule B shows **N/A** for packs charged individually (the D pool and any pack marked *individual*) and for any series with fewer than two packs on the board that night.

Rule A judges a pack, and Rule B judges which packs can share a board. The two are tracked separately and never lumped together as "spread."

### 4. Lowest-cell starting voltage
The lowest cell on the first log line, as the pack arrives.
- **Under 3600 mV is a watch line.** It's flagged and followed, but it's not a pull on its own.

### 5. Self-discharge
- A cell that sits about **150 mV or more below its sibling cells** at storage, or a chronic low floor on the same cell night after night, means the pack is **self-discharging** and **doesn't get parallel-charged**.

### 6. Trends over time
- A cell that is the pack's highest-IR cell night after night is a chronic high-IR cell.
- When the whole fleet's IR moves the same direction on the same night, it's usually **temperature**, not wear.

## How calls are made

| Call | Meaning | Typical triggers |
| --- | --- | --- |
| **OK / Go** | Joins its series board at normal current | Spread under 40, no self-discharge, floor fine, board delta GO |
| **Caution** | Can stay on the board and be watched. **Not scrap** | Spread 40–49; floor under 3600 mV without self-discharge; chronic high-IR cell with spread under 50 (that series charges at **reduced current**) |
| **Watch (individual)** | Stays in its series and keeps its label, but is charged on its own, not on the board | Owner's call, e.g. a floor watch plus low resting voltage that would push the board delta out of Go |
| **OFF** | Stays off the parallel board | Spread 50 or more; self-discharge; or sitting out one night to keep the board's delta at Go |
| **D pool** | Moved out of parallel duty for good but still tracked; charged individually only | Owner's call, e.g. chronic self-discharge |

- Safety calls come from **measured data** and never wait on research.
- A pack that's OFF for one night (to keep the board delta Go) isn't the same as a pack that's OFF for self-discharge, in the D pool, or retired.
- Leaving a pack out of the averages doesn't delete its data.

## The D pool

- Packs that shouldn't be parallel-charged any more, but are still worth tracking, move to the **D pool** with labels `D-1`, `D-2`, and so on.
- They're **charged individually, never in parallel**. Rule A, the floor watch, and the self-discharge check still apply. Rule B is N/A.
- A moved pack keeps its permanent ID, so its page shows its full history, e.g. "was C1-P1 until 2026-10-08."
- A pack that's finally disposed of is marked retired, with the date. Its history stays.
- *First entry:* the pack that was C1-P1 became **D-1** on 2026-10-08 for self-discharge on Cell 6 (a chronic low floor).

## What isn't measured yet

- **Capacity in/out (mAh) over time:** not tracked. Storage logs give voltage and IR, not usable capacity.
- **Cost per cycle:** not tracked.
- **Cycle count per pack:** TBD.
- **Ambient temperature at measurement:** not logged yet. Standard advice is to measure at about 20–25 °C after 30–60 minutes of cooling (TBD whether this gets adopted).
- **Heat, sag, or puff checks:** not part of the logged data (TBD).

## Safety notes

- **Where charging happens:** parallel charges are done on a concrete floor, away from anything flammable, and are never left unattended. Storage charges are done in a fireproof BatBox.
- Parallel-charge only within one series, on fused boards, and only packs that pass Rules A and B that night.
- Any self-discharging pack stays off the parallel board.
- Storage-charge individually after flying so one bad cell can't hide in a group.
- A pack whose cell collapses or can't hold storage voltage comes out of service. *(Example: an original C2-P5 had a cell drop from about 3.78 V to 1.8 V. The pack was retired and a qualified replacement took the C2-P5 slot.)*
- Caution is a signal to watch, not a reason to panic, and OFF is a signal to act.
- These are one hobbyist's rules for one fleet. Follow your manufacturer's guidance and your own judgment.

## Planned changes

- **DX8-2 back online:** the four-way storage split above starts with DX8-2's first logged night. File numbers stay separate per charger.
- **Two new series, C3 and C4:** six packs each, **CNHL V2 6S ~1300 (Black)**, the same as C1 and C2. Each gets its own series board and is never mixed with another series. They'll get the next permanent IDs when they arrive, and where they charge is declared in each night's manifest.
- **Replacing questionable packs:** packs that are OFF or have repeat Cautions may be moved to the D pool or retired, and a new pack can take the freed slot under a new permanent ID.

---
*Fleet owner: LostPennyFPV. Data and status calls are updated after each Storage night.*
