# Methodology — LostPennyFPV LiPo Fleet Health

*How this fleet is charged, logged, and judged. These are one hobbyist's working rules for one fleet, not manufacturer guidance. Version: 2026-10-17 (rules v6; pack registry v2).*

## Why track packs at all

5" FPV packs usually fail one cell at a time. When packs are parallel-charged, one bad cell can put the whole board at risk. The goal here is to catch a weak pack early, take it off the parallel board when it is a real risk, and follow every pack's health over months and years.

## Hardware

| Item | What's used |
| --- | --- |
| Packs | CNHL V2 6S ~1300 mAh (Black). Four series of six in rotation (**C1**, **C2**, **C3** and **C4**), plus a **D** pool for packs that are only charged on their own. C3 and C4 were added 2026-10-14 (purchased 2026-10-13) |
| Chargers | Two Junsi iCharger DX8s, **DX8-1** and **DX8-2**. Every pack has a permanent home channel for its storage log (see *Home channels*) |
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

1. **Before a flying session, parallel-charge by series** at about 1.5C per pack (the board current is that times the number of packs on the board). Every pack charges on its own parallel board, one six-pack parallel board per series. The only check before connecting is rest voltage (see *Rule B*). Packs in the D pool, and any pack taken off its board, are never parallel-charged.
2. **Fly.**
3. **After flying, storage-charge each pack on its own** on its home DX8 channel, in **Storage mode, 3.85 V/cell**. Every series that was flown is charged, all of it, including any packs in it that didn't fly. Series that weren't flown stay off. Charging one pack at a time is what exposes a weak cell that a parallel board would hide.
4. **Upload the DX8 Storage logs** with their original file names, plus a short note of **which series or packs were flown**, and **how many days since each pack was last flown or charged** ("unknown" is allowed). Resting voltage depends on that, so it's recorded with the night. Every raw log is kept permanently. Nothing is ever deleted, and new data is only ever added.

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
- If only some series ran that night, only those packs get rows. A pack that didn't run gets no value for that night, and nothing is ever filled in. Charts never show a reading as a lone dot. Each pack's readings are joined by one line across every night it has a reading, including D pool, charge-alone and rest-test nights. A pack that moves keeps one line through its whole history: D-1's line continues through its nights as C1-P1. On a pack's own chart, a night the pack wasn't charged is a faint dotted line between the real readings on either side. Series, fleet, Rule B and bake-off charts draw a solid line straight through any night a series skipped. Nothing is drawn before a pack's first reading or after its last. The only reading shown on its own is a brand-new pack's very first reading.

## Home channels

Every slot has a permanent home channel. It doesn't change from night to night.

| Series | P1 and P2 | P3 and P4 | P5 | P6 |
| --- | --- | --- | --- | --- |
| C1 and C3 | DX8-1 Channel 1 | DX8-1 Channel 2 | DX8-2 Channel 1 | DX8-2 Channel 2 |
| C2 and C4 | DX8-2 Channel 1 | DX8-2 Channel 2 | DX8-1 Channel 1 | DX8-1 Channel 2 |

- **D-1** always goes last on DX8-2 Channel 1, on nights it flew. A later D pack goes after D-1, in number order.
- An **empty slot** or a **pulled pack** is skipped, and nothing is reordered. A pulled pack gets no storage charge. C1-P1 is empty until the spare pack arrives.

### Each night
1. Take every series that was flown, and every pack in it.
2. Each channel runs its packs in series order (C1, C2, C3, C4), then pack number order, with D-1 last on DX8-2 Channel 1 if it flew.
3. On each charger, start Channel 1, then Channel 2, then wait for both to finish before the next pair. When one channel runs out, the other carries on alone.

## Mapping logs to packs

1. Split the files by charger (from the header), then by channel. Each charger's files follow that night's run order, round by round, Channel 1 then Channel 2. Each charger has one file counter, shared by Charge and Storage runs, so gaps in the numbering are normal.
2. Every file is checked against the run order: its channel must match, its first reading must make sense for that pack (for example, a pack charged earlier the same day starts near full), and the number of files must match the number of packs that ran on that charger. **A wrong channel, a wrong count, or first readings that don't fit the pack hold that charger's mapping until it is confirmed.** Nothing is ever guessed.
3. As a soft cross-check, each pack tends to have the same lowest cell on arrival night after night. A mismatch gets a note but never causes a remap on its own. Packs are **never quietly relabeled**.

## Metrics and thresholds

### 1. Per-cell IR (DX8)
Healthy cells in this fleet read about **2–3.5 mΩ** per cell on the DX8, and the whole pack about 11–21 mΩ. The DX8's own manual says its IR accuracy is limited, so this fleet doesn't use absolute "retire above X mΩ" cutoffs from other meters. IR is used for **relative and trend checks**: within a pack, against the pack's own history, and against its siblings.

### 2. In-pack IR checks (Rule A: one pack)
- **Spread** = highest-cell IR minus lowest-cell IR in one pack that night.
- **Ratio** = a cell's IR divided by the pack's median cell IR.
- IR readings are noisy, so these are **watch notes**, not reasons to take a pack off its board. A spread of **2.0 mΩ or more** gets a watch note so it is looked at again next night. A single high-IR cell is covered by the IR checks in *section 8*.

### 3. Rest-voltage check before connecting (Rule B: the board)
This is the only check before packs are connected, and it applies only when packs are actually connected in parallel. For the packs on one parallel board, take the gap between the highest and lowest resting voltage. It's worked out separately for each series.

| Delta | Call |
| --- | --- |
| **0.60 V or less** (0.1 V per cell on 6S) | Go: connect them all |
| **Over 0.60 V** | The pack outside the range charges alone **that time only**. Nothing in its record changes, and it's back on the board next time its rest voltage is in range |

The site shows two figures per board. The **recorded** delta is history: the packs actually charged together on that series' last board night, judged by the rule in force that night, and it never changes afterwards. The **next-night outlook** uses the latest rest voltage of every pack assigned to the board and names any pack that was outside 0.60 V, so it can be checked first next time. A series that hasn't had a board night yet has no recorded delta. Rule B shows **N/A** for the D pool (charged on its own), for any pulled pack (not charged; its slot is skipped) and for any series with fewer than two packs on the board.

Rule A looks at one pack, and Rule B looks at which packs can share a board. The two are tracked separately and never lumped together as "spread."

### 4. Lowest-cell starting voltage
The lowest cell on the first log line, as the pack arrives.
- **Under 3600 mV** gets a watch note for that night. The pack stays on its board.
- **Any cell under 3.0 V at rest**, even once, takes the pack off its board (a safety pull).
- **Cell spread over 0.20 V** (highest minus lowest cell on arrival), even once, takes the pack off its board (a safety pull).

### 5. Self-discharge: the low-cell gap
- **Low-cell gap** = how far the lowest cell starts below the median of the other five cells.
- **60 mV or more** gets a watch note. The pack stays on its board.
- **100 mV or more** counts as a trouble night. **3 trouble nights out of the last 4** take the pack off its board.
- A short top-up night (for example after the packs were stored on the HOTA) says little either way.

### 6. Rest test, in place (confirms self-discharge)
There is no separate rest pool. A pack that sits unflown for **5 days or more** between storage nights gets a rest test in place:
1. Compare the first reading of its next storage log with the end of its last storage run.
2. Work out the suspect cell's drop minus the middle drop of the other cells, and scale it to 7 days.

| Extra drop, scaled to 7 days | Result |
| --- | --- |
| 10 mV or less | Pass |
| 10–30 mV | Borderline |
| Over 30 mV | Fail |

A fail is a note only; it is never a reason to retire a pack. It only takes a pack off its board through the pull rules (see *How calls are made*) or a cell under 3.0 V. The test needs the upload note to list the series or packs that were flown. D-1's RT-001-1 was read from a screen photo on day 8 (due 2026-10-16), before charging. C1-P4's RT-004-1 and C2-P2's RT-008-1 complete in place from the first reading of their next storage log, if they haven't flown since 2026-10-09.

### 7. Trends over time
- Each pack's average IR is compared with its own first 3 storage nights (see *section 8*). **+30%** on 2 of the last 3 nights is a watch note, **+50% or more** counts as a trouble night (3 out of the last 4 take it off its board), and **2×** on 2 nights means retire. None of these has happened yet.
- When the whole fleet's IR moves the same direction on the same night, it's usually **temperature**, not wear.

### 8. IR on a parallel board
On a parallel board every pack sits at the same voltage, so the charge current splits between the packs by their internal resistance. A pack with higher IR takes less current and falls behind; a pack with lower IR takes more. A worn pack shows up as rising IR before it shows up anywhere else. So IR is checked three ways, always from each pack's **own storage run** (one pack per run, true cell IR in mΩ), never from a board.

- **Trend against its own start.** The pack's starting level is the middle value of its average IR over its first 3 storage nights. Night-to-night noise on the DX8 is about ±20%, so small moves are ignored. **+30% or more on 2 of its last 3 nights** is a watch note. **+50% or more** on a night is a trouble night (an IR Caution). A pack with fewer than 3 storage nights has no starting level yet, so this check doesn't apply to it.
- **Match across the board.** Each pack's average IR is compared with the middle value of the other packs on its board that ran the same night. **More than 25% off on 2 of its last 3 nights**, or more than 35%, is a note so it is looked at first. It stays on its board at normal current.
- **One high cell.** A cell at **1.5× its pack's middle cell IR or more, and at least 1.2 mΩ above it**, is a note. The 1.2 mΩ floor keeps low-IR packs from tripping on normal noise (for example 3.0 against 2.0 mΩ doesn't count).

New packs stay on their board. No IR check takes a pack off its board before its 3rd storage night. The voltage checks before connecting stay exactly as they are; the IR checks add to them and don't replace them.

## How calls are made

Every pack gets two calls: one for the **parallel board**, and one for its **service status**. The default is simple: **every pack charges on its own parallel board.**

| Parallel call | Meaning |
| --- | --- |
| **Go** | On its parallel board at normal current. This is every pack unless one of the rows below applies |
| **Go, check first** | On its board, but its rest voltage was outside 0.60 V last time, or its IR has been off the board. Checked before connecting; normal current |
| **Charges alone this time** | Its rest voltage is more than 0.60 V from the rest of the board. That time only, with no change to its record |
| **Pulled** | Off the board and not charged: its slot is skipped like an empty slot, with no reordering, for one of the reasons below |

A pack is pulled only for:
- **Safety, any single time:** puffing or damage, heat, a resting cell under 3.0 V, or a cell spread over 0.20 V.
- **Sustained failure:** 3 of its last 4 storage nights with an IR Caution (average IR up 50% or more from its own first 3 nights) or a cell 100 mV or more low.

Everything else is a note: the IR trend watch, the board IR match, a single high-IR cell, and low-cell notes.

| Service status | Typical triggers |
| --- | --- |
| **In service** | Normal |
| **Watch** | A note only. The pack **stays on its board**; the note says what to look at next night (for example a low cell or one higher-IR cell), or a borderline or failed rest test |
| **D pool** | Pulled for sustained failure. Charged on its own, never in parallel, and stays in rotation at a fixed slot |
| **Retire** | Puffing or damage (immediately), IR 2× its own baseline, a cell 2× its pack-mates on 3 nights, a cell under 2.0 V for over a week, or a pack that can't hold storage |


- Safety calls come from **measured data** and never wait on research.
- A pack charging alone one time because of its rest voltage isn't the same as a pack pulled for safety or sustained failure, in the D pool, or retired.
- Leaving a pack out of the averages doesn't delete its data.

## The D pool

- Packs that shouldn't be parallel-charged any more, but are still worth tracking, move to the **D pool** with labels `D-1`, `D-2`, and so on.
- They're **charged on their own, never in parallel**, and stay in rotation: D-1 goes last on DX8-2 Channel 1 on nights it flew. The IR, floor and low-cell-gap checks and rest tests still apply. Rule B is N/A. Its Watch is a note only.
- A moved pack keeps its permanent ID, so its page shows its full history, e.g. "was C1-P1 until 2026-10-08."
- A pack that's finally disposed of is marked retired, with the date. Its history stays.
- *First entry:* the pack that was C1-P1 became **D-1** on 2026-10-08 for self-discharge on Cell 6 (a chronic low floor).

## Rest pool (retired)

The rest pool is retired (2026-10-17). C1-P4 and C2-P2 return to their home slots on their next storage night, and their rest tests complete in place (see *section 6*).

## What isn't measured yet

- **Capacity in/out (mAh) over time:** not tracked. Storage runs are top-ups, not capacity tests.
- **Charge count:** each pack's number of logged storage sessions is tracked. Older flights and charges before logging began aren't counted.
- **Purchase date:** unknown for the current packs; recorded for new packs.
- **Cost per cycle:** not tracked.
- **Ambient and pack temperature at measurement:** not measured. The temperature the charger logs and shows is its own internal reading, not the pack's.
- **Heat, sag, or puff checks:** not tracked as data. A pack reported as puffed, damaged, or hot on charge comes off its board at once, and puffing or damage means retirement.

## Safety notes

- **Where charging happens:** parallel charges are done on a concrete floor, away from anything flammable, and are never left unattended. Storage charges are done in a fireproof BatBox.
- Parallel-charge only within one series, on fused boards, and only packs within 0.60 V rest voltage of each other at the time.
- A pack with a resting cell under 3.0 V, or a cell spread over 0.20 V, stays off the parallel board.
- Storage-charge each pack on its own after flying so one bad cell can't hide in a group.
- A pack whose cell collapses or can't hold storage voltage comes out of service. *(Example: an original C2-P5 had a cell drop from about 3.78 V to 1.8 V. The pack was retired and a qualified replacement took the C2-P5 slot.)*
- Watch is a note, not a reason to panic. A pull is a signal to act.
- These are one hobbyist's rules for one fleet. Follow your manufacturer's guidance and your own judgment.

## New packs

- A new pack gets the next permanent ID and a commission entry. Its first full charge is recorded as a baseline (the arrival cell voltages are that charge's start cells).
- From then on it charges on its series' parallel board like every other pack, from its home channel, with the same rest-voltage check and the same watch notes and pull rules. Series never mix on a board. The IR trend check starts once it has 3 storage nights, and no IR check takes it off its board before its 3rd storage night.
- Pulled packs may move to the D pool or retire. A new pack can take a freed slot under a new permanent ID.

---
*Fleet: LostPennyFPV. Data and status calls are updated after each Storage night.*
