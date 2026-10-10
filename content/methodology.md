# Methodology — LostPennyFPV LiPo Fleet Health

*How this fleet is charged, logged, and judged. These are one hobbyist's working rules for one fleet, not manufacturer guidance. Version: 2026-10-09 (rules v3; pack registry v2).*

## Why track packs at all

5" FPV packs usually fail one cell at a time. When packs are parallel-charged, one bad cell can put the whole board at risk. The goal here is to catch a weak pack early, keep it off the parallel board, and follow every pack's health over months and years.

## Hardware

| Item | What's used |
| --- | --- |
| Packs | CNHL V2 6S ~1300 mAh (Black). 12 packs in two series of six (**C1** and **C2**), plus a **D** pool for packs that are only charged individually. Two more CNHL V2 6S ~1300 series, **C3** and **C4**, are planned |
| Chargers | Two Junsi iCharger DX8s, **DX8-1** and **DX8-2**. For storage logs each charger channel handles three packs (see *Mapping logs to packs*) |
| Power supply | Chargery S1500, usually set to 28 V |
| Parallel boards | HGLRC Thor 6-port, fused |
| Extra charger | HOTA D6 Pro on the same PSU. It handles extra parallel work only and **isn't used for tracking logs**. Packs stored on the HOTA (e.g. while travelling) sit slightly below the DX8's 3.85 V/cell storage target, so the next DX8 storage run is a short top-up |

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
4. **Upload the DX8 Storage logs** with their original file names, plus a short note of which packs ran on which charger and channel that night, and **how many days since each pack was last flown or charged** ("unknown" is allowed). Resting voltage depends on that, so it's recorded with the night. Every raw log is kept permanently. Nothing is ever deleted, and new data is only ever added.

### What gets logged
From each DX8 Storage log:
- **Header:** model, firmware, and the charger's serial number. The header is what identifies the charger, and it's authoritative. Public data shows the charger names DX8-1 and DX8-2 only.
- **First data line:** six cell voltages when the pack arrives, before charging. These give the lowest-cell starting voltage, how far apart the cells are on arrival, and the pack's resting voltage (the sum of the cells).
- **IR lines:** while charging, the DX8 measures internal resistance (IR) about once a minute and logs each cell's IR in 0.1 mΩ steps, plus the whole-pack IR and the lead (line) resistance. Each night uses the **median over the run** for each cell, in mΩ.
- **End voltages:** these should settle near storage voltage. Logs that are seconds long, empty, or errored stay in the archive but are left out of the numbers.

### Session and file numbering
- The DX8 auto-names files `LiPo[Storage_NNN_CHx].txt` and counts NNN upward.
- **NNN is per charger.** DX8-1's file 100 has nothing to do with DX8-2's file 100, so number streams are never merged across chargers.
- A **session** is one Storage night, named by calendar date (Pacific), e.g. `2026-09-27`. Older nights used `S` + their lowest file number (e.g. `S413`) and keep those names.
- If only some series ran that night, only those packs get rows. A pack that didn't run gets no value for that night, and nothing is ever filled in. On its graph, a faint dotted line joins the real readings on either side of the skipped night. A skipped night before a pack's first reading or after its last gets a small hollow marker on the bottom edge of the graph instead, with no value.

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
4. **The manifest decides the mapping**: charger, channel, file number order, and the listed slots. As a soft cross-check, each pack tends to have the same lowest cell on arrival night after night. A mismatch gets a note but never causes a remap on its own. Packs are **never quietly relabeled**.

## Metrics and thresholds

### 1. Per-cell IR (DX8)
Healthy cells in this fleet read about **2–3.5 mΩ** per cell on the DX8, and the whole pack about 11–21 mΩ. The DX8's own manual says its IR accuracy is limited, so this fleet doesn't use absolute "retire above X mΩ" cutoffs from other meters. IR is used for **relative and trend checks**: within a pack, against the pack's own history, and against its siblings.

### 2. In-pack IR checks (Rule A: one pack)
- **Spread** = highest-cell IR minus lowest-cell IR in one pack that night.
- **Ratio** = a cell's IR divided by the pack's median cell IR.
- IR readings are noisy, so a check only counts when it repeats on **2 nights in a row**.

| Check (2 nights in a row) | Call |
| --- | --- |
| Spread under 2.0 mΩ and no cell 1.5× the median | Go |
| Spread **2.0 mΩ or more**, or a cell **1.5× the median** or more | Caution (reduced current) |
| Spread **3.0 mΩ or more**, or a cell **2× the median** or more | Individual only (off the board) |

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
- **Under 3600 mV on the pack's usual low cell** is a Caution for that night. A clean next night returns it to Go.
- **Any cell under 3.30 V at rest** means individual charging only.

### 5. Self-discharge: the low-cell gap
- **Low-cell gap** = how far the lowest cell starts below the median of the other five cells.
- **60 mV or more on 2 of the last 3 nights** is a Caution.
- **100 mV or more on 2 of the last 3 nights** means individual charging only.
- A short top-up night (for example after the packs were stored on the HOTA) says little either way.

### 6. Rest test (confirms self-discharge)
For a suspect cell:
1. Storage-charge the pack, leave it untouched, and read the cells at 90 minutes and at 7 days.
2. Compare the suspect cell's drop with the median drop of the other five cells.

| Extra drop over 7 days | Result |
| --- | --- |
| 10 mV or less | Pass |
| 10–30 mV | Borderline |
| Over 30 mV | Fail |

Each test runs for 3 cycles.

### 7. Trends over time
- Each pack's IR is compared with its own first nights. **+50%** puts it on Watch, and **2×** means retire. Neither has happened yet.
- When the whole fleet's IR moves the same direction on the same night, it's usually **temperature**, not wear.

## How calls are made

Every pack gets two calls: one for the **parallel board** tonight, and one for its **service status**.

| Parallel call | Meaning |
| --- | --- |
| **Go** | Joins its series board at normal current |
| **Caution** | Stays on the board at **reduced current**, first to remove. **Not scrap** |
| **Individual only** | Charged on its own, not on the board |

| Service status | Typical triggers |
| --- | --- |
| **In service** | Normal |
| **Watch** | Caution on 3 of the last 5 nights, IR +50% vs its own baseline, or a borderline rest test |
| **D pool** | Individual only on 3 of the last 5 nights, or a failed rest test. Charged individually, never in parallel |
| **Retire** | Puffing or damage (immediately), IR 2× its own baseline, a cell 2× its pack-mates on 3 nights, a failed rest test on 2 of 3 cycles, a cell under 2.0 V for over a week, or a pack that can't hold storage |

A pack leaves the D pool only after passing 3 rest tests in a row, then 3 Go nights on the board while on Watch.

- Safety calls come from **measured data** and never wait on research.
- A pack that's OFF for one night (to keep the board delta Go) isn't the same as a pack that's OFF for self-discharge, in the D pool, or retired.
- Leaving a pack out of the averages doesn't delete its data.

## The D pool

- Packs that shouldn't be parallel-charged any more, but are still worth tracking, move to the **D pool** with labels `D-1`, `D-2`, and so on.
- They're **charged individually, never in parallel**. Rule A, the floor and low-cell-gap checks, and rest tests still apply. Rule B is N/A.
- A moved pack keeps its permanent ID, so its page shows its full history, e.g. "was C1-P1 until 2026-10-08."
- A pack that's finally disposed of is marked retired, with the date. Its history stays.
- *First entry:* the pack that was C1-P1 became **D-1** on 2026-10-08 for self-discharge on Cell 6 (a chronic low floor).

## What isn't measured yet

- **Capacity in/out (mAh) over time:** not tracked. Storage runs are top-ups, not capacity tests.
- **Charge count:** each pack's number of logged storage sessions is tracked. Older flights and charges before logging began aren't counted.
- **Purchase date:** unknown for the current packs; recorded for new packs.
- **Cost per cycle:** not tracked.
- **Ambient temperature at measurement:** not logged.
- **Heat, sag, or puff checks:** not tracked as data. A pack the owner reports as puffed or damaged is retired immediately.

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
