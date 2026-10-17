# Methodology — LostPennyFPV LiPo Fleet Health

*How this fleet is charged, logged, and judged. These are one hobbyist's working rules for one fleet, not manufacturer guidance. Version: 2026-10-17 (rules v5; pack registry v2).*

## Why track packs at all

5" FPV packs usually fail one cell at a time. When packs are parallel-charged, one bad cell can put the whole board at risk. The goal here is to catch a weak pack early, take it off the parallel board when it is a real risk, and follow every pack's health over months and years.

## Hardware

| Item | What's used |
| --- | --- |
| Packs | CNHL V2 6S ~1300 mAh (Black). Four series of six in rotation (**C1**, **C2**, **C3** and **C4**), plus a **D** pool for packs that are only charged individually. C3 and C4 were added 2026-10-14 (purchased 2026-10-13) |
| Chargers | Two Junsi iCharger DX8s, **DX8-1** and **DX8-2**. For storage logs each charger channel handles three packs (see *Mapping logs to packs*) |
| Power supply | Chargery S1500, usually set to 28 V |
| Parallel boards | HGLRC Thor 6-port, fused |
| Extra charger | HOTA D6 Pro on the same PSU. It handles extra parallel work only and **isn't used for tracking logs**. Packs stored on the HOTA (e.g. while travelling) sit slightly below the DX8's 3.85 V/cell storage target, so the next DX8 storage run is a short top-up |

A pack is only ever parallel-charged with its own series. Series are never mixed on a board, and brands are never mixed in a series.

## Pack identity

- Every physical pack has a **permanent ID** in the form `{brand}-{year}-{number}`, e.g. `CNHL-2026-001`. The year is the year the ID was assigned. IDs are never reused and don't include the slot.
- The **label** (e.g. `C1-P4`) is the pack's current slot in a series. Series slots are `C1-P1…P6`, `C2-P1…P6`, `C3-P1…P6` and `C4-P1…P6`. Packs in the D pool are labeled `D-1`, `D-2`, and so on.
- When a pack moves (for example from a series to the D pool), its ID and full history go with it. When a new pack takes over a slot, it gets a new ID, and the old pack's history stays under its own ID.
- Every move, replacement, and retirement is logged as a dated event, and every status call is kept as a dated history.

## The routine

1. **Before a flying session, parallel-charge by series** at about 1.5C per pack (the board current is that times the number of packs on the board). Every pack charges on its own parallel board, one six-pack parallel board per series. The only check before connecting is rest voltage (see *Rule B*). Packs in the D pool or the rest pool, and any pack taken off its board, are never parallel-charged.
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
- If only some series ran that night, only those packs get rows. A pack that didn't run gets no value for that night, and nothing is ever filled in. On its graph, a faint dotted line joins the real readings on either side of the skipped night. A skipped night before a pack's first reading or after its last gets a small hollow marker on the bottom edge of the graph instead, with no value. Series, fleet, Rule B and bake-off charts are different: they draw a solid line straight through any night a series skipped, with no dotted joins and no markers.

## Mapping logs to packs

1. **Each night has a manifest.** For every charger and channel it lists which labels ran, in slot order (e.g. `C1-P2 | C1-P3`). Packs charged individually get their own manifest line.
2. **Default storage split:**

| Charger | Channel | Packs |
| --- | --- | --- |
| DX8-1 | 1 | C1-P1, C1-P2, C1-P3 |
| DX8-1 | 2 | C1-P4, C1-P5, C1-P6 |
| DX8-2 | 1 | C2-P1, C2-P2, C2-P3 |
| DX8-2 | 2 | C2-P4, C2-P5, C2-P6 |

   On a C3+C4 night the same split applies, with C3 on DX8-1 and C4 on DX8-2. One night is one set of 12 packs (C1+C2 or C3+C4), and sets don't mix on a night. Where the D pool runs is declared in that night's manifest.
3. Split files by charger, then by channel. Within each, sort by NNN ascending and match them in order to the labels listed in the manifest. **If the number of files doesn't equal the number of listed packs, nothing is mapped until the mapping is confirmed.** Nothing is ever guessed.
4. **The manifest decides the mapping**: charger, channel, file number order, and the listed slots. As a soft cross-check, each pack tends to have the same lowest cell on arrival night after night. A mismatch gets a note but never causes a remap on its own. Packs are **never quietly relabeled**.

## Metrics and thresholds

### 1. Per-cell IR (DX8)
Healthy cells in this fleet read about **2–3.5 mΩ** per cell on the DX8, and the whole pack about 11–21 mΩ. The DX8's own manual says its IR accuracy is limited, so this fleet doesn't use absolute "retire above X mΩ" cutoffs from other meters. IR is used for **relative and trend checks**: within a pack, against the pack's own history, and against its siblings.

### 2. In-pack IR checks (Rule A: one pack)
- **Spread** = highest-cell IR minus lowest-cell IR in one pack that night.
- **Ratio** = a cell's IR divided by the pack's median cell IR.
- IR readings are noisy, so these are **watch notes**, not reasons to take a pack off its board. A spread of **2.0 mΩ or more** gets a watch note so it is looked at again next night. A single high-IR cell is covered by the IR checks in *section 8*.

### 3. Rest-voltage check before connecting (Rule B: the board)
This is the only check before packs are connected. For the packs on one parallel board, take the gap between the highest and lowest resting voltage. It's worked out separately for each series.

| Delta | Call |
| --- | --- |
| **0.60 V or less** (0.1 V per cell on 6S) | Go: connect them all |
| **Over 0.60 V** | The pack outside the range charges alone **that night only**. Its status doesn't change, and it's back on the board next time its rest voltage is in range |

The site shows two figures per board. The **recorded** delta is history: the packs actually charged together on that series' last board night, judged by the rule in force that night, and it never changes afterwards. The **next-night outlook** uses the latest rest voltage of every pack assigned to the board and names any pack that was outside 0.60 V, so it can be checked first next time. A series that hasn't had a board night yet has no recorded delta. Rule B shows **N/A** for packs charged alone (the D pool and any pulled pack) and for any series with fewer than two packs on the board.

Rule A looks at one pack, and Rule B looks at which packs can share a board. The two are tracked separately and never lumped together as "spread."

### 4. Lowest-cell starting voltage
The lowest cell on the first log line, as the pack arrives.
- **Under 3600 mV** gets a watch note for that night. The pack stays on its board.
- **Any cell under 3.0 V at rest**, even once, takes the pack off its board (a safety pull).

### 5. Self-discharge: the low-cell gap
- **Low-cell gap** = how far the lowest cell starts below the median of the other five cells.
- **60 mV or more** gets a watch note. The pack stays on its board.
- **100 mV or more** counts as a trouble night. **3 trouble nights out of the last 4** take the pack off its board.
- **More than 200 mV (0.20 V)** off the other cells, even once, takes the pack off its board (a safety pull).
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
- Each pack's average IR is compared with its own first 3 storage nights (see *section 8*). **+30%** on 2 of the last 3 nights is a watch note, **+50% or more** counts as a trouble night (3 out of the last 4 take it off its board), and **2×** on 2 nights means retire. None of these has happened yet.
- When the whole fleet's IR moves the same direction on the same night, it's usually **temperature**, not wear.

### 8. IR on a parallel board (rules v5)
On a parallel board every pack sits at the same voltage, so the charge current splits between the packs by their internal resistance. A pack with higher IR takes less current and falls behind; a pack with lower IR takes more. A worn pack shows up as rising IR before it shows up anywhere else. So IR is checked three ways, always from each pack's **own storage run** (one pack per run, true cell IR in mΩ), never from a board.

- **Trend against its own start.** The pack's starting level is the middle value of its average IR over its first 3 storage nights. Night-to-night noise on the DX8 is about ±20%, so small moves are ignored. **+30% or more on 2 of its last 3 nights** is a watch note. **+50% or more** on a night is a trouble night. A pack with fewer than 3 storage nights has no starting level yet, so this check doesn't apply to it.
- **Match across the board.** Each pack's average IR is compared with the middle value of the other packs on its board that ran the same night. **More than 25% off on 2 of its last 3 nights** means check it first, and the board charges at reduced current. **More than 35% off on 2 of 3 nights** means it charges alone until it's back in range.
- **One high cell.** A cell at **1.5× its pack's middle cell IR or more, and at least 1.2 mΩ above it**, is a watch note for one night. The 1.2 mΩ floor keeps low-IR packs from tripping on normal noise (for example 3.0 against 2.0 mΩ doesn't count). **The same cell on 2 nights running** is a trouble night.

New packs stay on their board. No IR check takes a pack off its board before its 3rd storage night. The voltage checks before connecting stay exactly as they are; the IR checks add to them and don't replace them.

## How calls are made

Every pack gets two calls: one for the **parallel board**, and one for its **service status**. The default is simple: **every pack charges on its own parallel board.**

| Parallel call | Meaning |
| --- | --- |
| **Go** | On its parallel board at normal current. This is every pack unless one of the rows below applies |
| **Go, check first** | On its board, but its IR has been more than 25% off the board on 2 of its last 3 nights. Checked before connecting, and the board charges at reduced current |
| **Charges alone tonight** | Its rest voltage is more than 0.60 V from the rest of the board. That night only, with no status change |
| **Charges alone (IR)** | Its IR has been more than 35% off the board on 2 of its last 3 nights. Charged alone until it is back in range |
| **Pulled** | Off the board and charged alone, for one of the reasons below |

A pack is pulled only for:
- **Safety, any single time:** puffing or damage, hot on charge, a resting cell under 3.0 V, or a cell more than 0.20 V off its siblings.
- **Repeated trouble:** 3 of its last 4 storage nights with a cell 100 mV or more low, average IR up 50% or more from its own first 3 nights, or the same high-IR cell on 2 nights running.

| Service status | Typical triggers |
| --- | --- |
| **In service** | Normal |
| **Watch** | A note only. The pack **stays on its board**; the note says what to look at next night (for example a low cell or one higher-IR cell), or a borderline rest test |
| **D pool** | Pulled for repeated trouble, or a failed rest test. Charged individually, never in parallel |
| **Retire** | Puffing or damage (immediately), IR 2× its own baseline, a cell 2× its pack-mates on 3 nights, a failed rest test on 2 of 3 cycles, a cell under 2.0 V for over a week, or a pack that can't hold storage |

A pack leaves the D pool only after passing 3 rest tests in a row, then 3 Go nights on the board while on Watch.

- Safety calls come from **measured data** and never wait on research.
- A pack charging alone for one night because of its rest voltage isn't the same as a pack pulled for safety or repeated trouble, in the D pool, or retired.
- Leaving a pack out of the averages doesn't delete its data.

## The D pool

- Packs that shouldn't be parallel-charged any more, but are still worth tracking, move to the **D pool** with labels `D-1`, `D-2`, and so on.
- They're **charged individually, never in parallel**. The IR, floor and low-cell-gap checks and rest tests still apply. Rule B is N/A.
- A moved pack keeps its permanent ID, so its page shows its full history, e.g. "was C1-P1 until 2026-10-08."
- A pack that's finally disposed of is marked retired, with the date. Its history stays.
- *First entry:* the pack that was C1-P1 became **D-1** on 2026-10-08 for self-discharge on Cell 6 (a chronic low floor).

## Rest pool

Rest pool: packs under a 7-day rest test sit here at storage voltage, off every board and not charged, until their 7-day reading. Each then returns to its series, the D pool, or retirement based on the result.

## What isn't measured yet

- **Capacity in/out (mAh) over time:** not tracked. Storage runs are top-ups, not capacity tests.
- **Charge count:** each pack's number of logged storage sessions is tracked. Older flights and charges before logging began aren't counted.
- **Purchase date:** unknown for the current packs; recorded for new packs.
- **Cost per cycle:** not tracked.
- **Ambient temperature at measurement:** not logged.
- **Heat, sag, or puff checks:** not tracked as data. A pack reported as puffed, damaged, or hot on charge comes off its board at once, and puffing or damage means retirement.

## Safety notes

- **Where charging happens:** parallel charges are done on a concrete floor, away from anything flammable, and are never left unattended. Storage charges are done in a fireproof BatBox.
- Parallel-charge only within one series, on fused boards, and only packs within 0.60 V rest voltage of each other that night.
- A pack with a resting cell under 3.0 V, or a cell more than 0.20 V off the others, stays off the parallel board.
- Storage-charge individually after flying so one bad cell can't hide in a group.
- A pack whose cell collapses or can't hold storage voltage comes out of service. *(Example: an original C2-P5 had a cell drop from about 3.78 V to 1.8 V. The pack was retired and a qualified replacement took the C2-P5 slot.)*
- Watch is a note, not a reason to panic. A pull is a signal to act.
- These are one hobbyist's rules for one fleet. Follow your manufacturer's guidance and your own judgment.

## New packs

- A new pack gets the next permanent ID and a commission entry. Its first full charge is recorded as a baseline (the arrival cell voltages are that charge's start cells).
- From then on it charges on its own parallel board like every other pack, with the same rest-voltage check and the same watch notes and pull rules. Series never mix on a board. The IR trend check starts once it has 3 storage nights, and no IR check takes it off its board before its 3rd storage night.
- Pulled packs may move to the D pool or retire. A new pack can take a freed slot under a new permanent ID.

---
*Fleet: LostPennyFPV. Data and status calls are updated after each Storage night.*
