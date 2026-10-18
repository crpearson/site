# Methodology — LostPennyFPV LiPo Fleet Health

*How this fleet is charged, logged, and judged. These are one hobbyist's working rules for one fleet, not manufacturer guidance. Version: 2026-10-17 (rules v7; pack registry v2).*

## Why track packs at all

5" FPV packs usually fail one cell at a time. When packs are parallel-charged, one bad cell can put the whole board at risk. The goal here is to catch a weak pack early, pull it only when it is a real fire risk, and follow every pack's health over months and years.

## Hardware

| Item | What's used |
| --- | --- |
| Packs | CNHL V2 6S ~1300 mAh (Black). Four series of six in rotation (**C1**, **C2**, **C3** and **C4**). C3 and C4 were added 2026-10-14 (purchased 2026-10-13) |
| Chargers | Two Junsi iCharger DX8s, **DX8-1** and **DX8-2**. Every pack has a permanent home channel for its storage log (see *Home channels*) |
| Power supply | Chargery S1500, usually set to 28 V |
| Parallel boards | HGLRC Thor 6-port, fused |
| Extra charger | HOTA D6 Pro on the same PSU. It handles extra parallel work only and **isn't used for tracking logs**. Packs stored on the HOTA (e.g. while travelling) sit slightly below the DX8's 3.85 V/cell storage target, so the next DX8 storage run is a short top-up |

A pack is only ever parallel-charged with its own series. Series are never mixed on a board, and brands are never mixed in a series.

## Pack identity

- Every physical pack has a **permanent ID** in the form `{brand}-{year}-{number}`, e.g. `CNHL-2026-001`. The year is the year the ID was assigned. IDs are never reused and don't include the slot.
- The **label** (e.g. `C1-P4`) is the pack's current slot in a series. Series slots are `C1-P1…P6`, `C2-P1…P6`, `C3-P1…P6` and `C4-P1…P6`. The D pool (labels `D-1`, `D-2`, …) has no packs now.
- When a pack moves (for example from C1-P1 to D-1 and back), its ID and full history go with it. When a new pack takes over a slot, it gets a new ID, and the old pack's history stays under its own ID.
- Every move, replacement, and retirement is logged as a dated event, and every status call is kept as a dated history.

## The routine

1. **Before a flying session, parallel-charge by series** at about 1.5C per pack (the board current is that times the number of packs on the board). Every pack charges on its own parallel board, one six-pack parallel board per series. Before connecting, each pack's resting voltage is checked (see *Checks before connecting*). A pack that fails a check charges alone that night; a pulled pack isn't charged at all.
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

- An **empty slot** or a **pulled pack** is skipped, and nothing is reordered. A pulled pack gets no storage charge.
- **C1-P1** is filled again from the next storage night: the pack that was D-1 moves back (see *The D pool*). The spare pack stays a spare.

### Each night
1. Take every series that was flown, and every pack in it.
2. Each channel runs its packs in series order (C1, C2, C3, C4), then pack number order.
3. On each charger, start Channel 1, then Channel 2, then wait for both to finish before the next pair. When one channel runs out, the other carries on alone.

## Mapping logs to packs

1. Split the files by charger (from the header), then by channel. Each charger's files follow that night's run order, round by round, Channel 1 then Channel 2. Each charger has one file counter, shared by Charge and Storage runs, so gaps in the numbering are normal.
2. Every file is checked against the run order: its channel must match, its first reading must make sense for that pack (for example, a pack charged earlier the same day starts near full), and the number of files must match the number of packs that ran on that charger. **A wrong channel, a wrong count, or first readings that don't fit the pack hold that charger's mapping until it is confirmed.** If a run has no log, the remaining logs are matched to packs by their cell pattern, and the pack without a log is shown as charged with no reading.
3. As a soft cross-check, each pack tends to have the same lowest cell on arrival night after night. A mismatch gets a note but never causes a remap on its own. Packs are **never quietly relabeled**.

## Metrics and thresholds

### How readings are taken
- **Resting voltage** is read at least **90 minutes** after a charge or a flight. A pack read sooner still shows the bounce of its last charge or the sag of its last flight.
- **IR** is measured with the pack **on its own**, one pack per DX8 channel. IR read on a parallel board is not used.

### 1. Per-cell IR (DX8)
Healthy cells in this fleet read about **2–3.5 mΩ** per cell on the DX8, and the whole pack about 11–21 mΩ. The DX8's own manual says its IR accuracy is limited, so this fleet doesn't use absolute "retire above X mΩ" cutoffs from other meters. IR is used for **relative and trend checks**: within a pack, against the pack's own history, and against its siblings.

### 2. In-pack IR checks (Rule A: one pack)
- **Spread** = highest-cell IR minus lowest-cell IR in one pack that night.
- **Ratio** = a cell's IR divided by the pack's median cell IR.
- These are **performance notes**. A spread of **2.0 mΩ or more** gets a note so it is looked at again next night. A single high-IR cell is covered in *section 8*.

### 3. Checks before connecting (the board)
These checks apply only when packs are actually connected in parallel. They are read at the board, from each pack's resting voltage, before anything is plugged in. Each one sends a pack to **charge alone that night**: it stays in rotation, nothing in its record changes, and it's back on the board next time it passes.

| Check | Charges alone that night if |
| --- | --- |
| Pack spread | The board's packs are **more than 0.60 V** apart (0.1 V per cell on 6S) |
| Cell against cell | Any cell is **more than 0.10 V** from the same-position cell of another pack on the board |
| Inside the pack | The pack's own cells are **more than 0.10 V** apart at rest |
| Low cell | A cell rests **between 2.0 and 3.0 V**. Below 2.5 V the DX8 charges it slowly with its restore function, and the pack then gets the self-discharge check |
| Connectors | A damaged main lead, XT60 or balance plug. Fix it before any charging |
| Board warning | A port fuse blows or a balance-pin light comes on: stop the charge, find the outlier pack, and charge it alone. If the same pack keeps causing it, its own gap to the board tightens to **0.30 V** |

**The boards.** The HGLRC Thor 6-port has a **15 A blade fuse on each port** and **no main input fuse**, a **2 A self-resetting fuse on each balance pin** with a light that shows when it trips, and a **40 A** maximum input. Its manual asks for each cell within 0.1 V, main lead first, then balance. So the 0.60 V and 0.10 V limits stay as they are, now backed by the board maker. At a **0.60 V** gap, the first rush of current into one pack joining five matched packs is about **13 A** for typical packs and about **21 A** for fresh, warm ones. It fades within about a minute. A **storage pack next to a full pack** draws about **46 A**, which blows the port fuse.

The cell-against-cell check matters because on a parallel board each cell is tied to the same-position cell of every other pack through the balance wires. Two packs can match on total voltage and still push current through those thin wires.

The site shows two figures per board for the pack spread. The **recorded** figure is history: the packs actually charged together on that series' last board night, judged by the rule in force that night, and it never changes afterwards. The **next-night outlook** uses the latest rest voltage of every pack on the board and names any pack that was outside 0.60 V, so it can be checked first. A series that hasn't had a board night yet has no recorded figure. The pack spread shows **N/A** for a pulled pack (not charged; its slot is skipped) and for a series with fewer than two packs on the board.

**What the logs can and can't show here.** The next board connection comes after the storage charge, so the board checks use the voltages at the end of each pack's latest storage run. If a run has no end reading, or the pack was charged with no log, we use the end of its previous storage run and say so. When those end voltages show packs more than 0.60 V apart, cells more than 0.10 V apart, a cell more than 0.10 V from the same cell of another pack, or a cell between 2.0 and 3.0 V, it becomes an advisory: **check resting voltage before connecting**. It is never a status change. The check itself is done at the board.

Rule A looks at one pack's IR, and the board checks look at which packs can share a board. The two are tracked separately and never lumped together as "spread."

### 4. Lowest-cell starting voltage
The lowest cell on the first log line, as the pack arrives.
- **Under 3600 mV** is a performance note. A cell at 3.0–3.3 V after flying is normal.
- **2.0–3.0 V at rest** means charge alone that night (see *section 3*).
- **Under 1.5 V**, or **under 2.0 V for about a week**, means the pack is pulled (fire risk).

### 5. The low-cell gap
- **Low-cell gap** = how far the lowest cell starts below the median of the other five cells.
- **60 mV or more** is a performance note. On its own it is not a pull or a charge-alone reason; a gap that comes back within days of a balanced storage charge is self-discharge (see *section 6*).
- A short top-up night (for example after the packs were stored on the HOTA) says little either way.

### 6. Self-discharge check
Self-discharge is the one voltage sign that points to fire risk: a weak separator lets a small current run inside the cell, and that can turn into a short. **A pack is pulled** if, after a balanced storage charge, one cell drops **0.05 V or more more than its other cells within 48 to 72 hours**, or any cell loses **about 0.10 V within 24 hours**.

We check it from the logs for a pack that hasn't flown in between: compare the first reading of its next storage log with the end of its last storage run, and take the suspect cell's drop minus the middle drop of the other cells. The upload note has to list the series or packs that were flown.
- **48 to 72 hours:** the pull rule applies directly.
- **Longer gaps:** an extra drop under 0.05 V clears the check. 0.05 V or more over a longer gap isn't proof, so it's an advisory to recheck within 48 to 72 hours.
- The storage end is read as the charge finishes, not 90 minutes later. That lifts every cell's drop a little, and about equally, so the extra drop of one cell over the others still holds.

Results are also graded, scaled to 7 days, as a performance note:

| Extra drop, scaled to 7 days | Grade |
| --- | --- |
| 10 mV or less | Pass |
| 10–30 mV | Borderline |
| Over 30 mV | Fail |

A fail grade is a note only; it is never a reason to retire a pack. C1-P1's RT-001-1 (from its time as D-1) was read from a screen photo on day 8 and passed. C1-P4's RT-004-1 and C2-P2's RT-008-1 complete from the first reading of their next storage log, if they haven't flown since 2026-10-09.

### 7. Trends over time
- Each pack's average IR is compared with its own first 3 storage nights (see *section 8*). These are performance notes only.
- When the whole fleet's IR moves the same direction on the same night, it's usually **temperature**, not wear.

### 8. IR
On a parallel board every pack sits at the same voltage, so the charge current splits between the packs by their internal resistance. At the currents used here that split is gentle and evens itself out, so IR differences between packs are **not** a reason to pull a pack or charge it alone. IR is still tracked, always from each pack's **own storage run**, as a performance record:

- **Trend against its own start.** The pack's starting level is the middle value of its average IR over its first 3 storage nights. Night-to-night noise on the DX8 is about ±20%. **+30% or more on 2 of its last 3 nights**, or **+50%** on a night, is a performance note.
- **Match across the board.** Each pack's average IR against the middle value of the other packs on its board that ran the same night. **More than 25% off on 2 of its last 3 nights**, or more than 35%, is a performance note.
- **One high cell.** A cell at **1.5× its pack's middle cell IR or more, and at least 1.2 mΩ above it**, is a performance note.
- **A sudden step in one cell.** A cell at **2× its own starting level or more AND 2× its pack's middle cell IR or more**, measured on its own, means **charge alone and inspect** on the next board night. It becomes a pull only together with heat, swelling or self-discharge.

A pack with fewer than 3 storage nights has no starting level yet, so the trend and step checks don't apply to it.

## How calls are made

Every pack gets two calls: one for the **parallel board**, and one for its **service status**. The default is simple: **every pack charges on its own parallel board.**

| Parallel call | Meaning |
| --- | --- |
| **Go** | On its parallel board at normal current. This is every pack unless one of the rows below applies |
| **Go, check first** | On its board, but the logs suggest a board check might fail (see *section 3*). Its resting voltage is checked before connecting |
| **Charges alone that night** | It failed a board check, or has a single-cell IR step. That night only; it stays in rotation and nothing in its record changes |
| **Pulled** | Out of rotation and not charged: its slot is skipped like an empty slot, with no reordering |

A pack is **pulled** only for fire risk:
- swelling or pouch damage (a dent, crush, bend or puncture; torn heat-shrink alone is re-wrapped, not a pull);
- heat while charging of **45 °C or more**, or clearly hotter than its siblings (not heat left over from a flight);
- a cell under **1.5 V**, or under **2.0 V for about a week**;
- self-discharge (see *section 6*);
- abnormal behaviour when charged on its own: a cell's voltage falls while charging, a cell won't rise, the restore pre-charge fails, or the DX8 keeps stopping with a low-cell error.

**Storage nights** (one pack per channel) apply only the pull list, because there's no other pack to push current into. A damaged connector is still fixed first. Storage nights are also where the self-discharge check and solo IR come from.

Everything else is a performance note: IR trend, board IR match, a single high-IR cell, low cells and low-cell gaps.

| Service status | Typical triggers |
| --- | --- |
| **In service** | Normal |
| **Watch** | A note only. The pack **stays on its board**; the note says what to look at next (for example an open self-discharge check) |
| **Pulled** | A pull sign above. Out of rotation until it is reviewed |
| **Retire** | Swelling or pouch damage, or a pull sign that is confirmed |

- Pull calls come from **measured data or a hands-on report** and never wait on research.
- A pack charging alone one night isn't the same as a pulled pack.
- Leaving a pack out of the averages doesn't delete its data.

## The D pool (no packs)

- The D pool was for packs charged on their own only. It has **no packs now**, and no new pack goes there under these rules.
- *History:* the pack that was C1-P1 became **D-1** on 2026-10-08 for self-discharge on Cell 6 (a chronic low floor). It charged on its own after that, last on DX8-2 Channel 1.
- **It moves back to C1-P1 from the next storage night (2026-10-17).** It passed its rest test, and under these rules a weak cell's history is a note, not a pull: only a repeat of the self-discharge (see *section 6*) would pull it. It keeps its permanent ID `CNHL-2026-001` and its full history, so its page and chart run on unbroken from C1-P1 through D-1 and back. It charges on DX8-1 Channel 1 and joins the C1 parallel board. Cell 6 is a watch note. It was charged full on 2026-10-17, so its resting voltage is checked before it is connected. The spare pack stays a spare.

## Rest pool (retired)

The rest pool is retired (2026-10-17). C1-P4 and C2-P2 are back at their home slots, and their rest tests complete as self-discharge checks (see *section 6*).

## What isn't measured

- **Pack temperature:** not in the logs. The temperature the DX8 logs and shows is the charger's own, not the pack's. Heat on charge is reported by hand.
- **Swelling, pouch damage, connector damage and abnormal charging:** not in the logs. Reported by hand.
- **Flight times:** not in the logs, so we can't tell whether a first log reading was 90 minutes or more after a flight. Voltage signs from the logs are advisories.
- **The board checks:** read at the board before connecting, not from our logs.
- **Capacity in/out (mAh) over time:** not tracked. Storage runs are top-ups, not capacity tests.
- **Charge count:** each pack's number of logged storage sessions is tracked. Older flights and charges before logging began aren't counted.
- **Purchase date:** unknown for the older packs; recorded for new packs.
- **Cost per cycle:** not tracked.

## Where the numbers come from

The pull and charge-alone rules come from a 2026-10-17 review of the published guidance. Main sources:
- **The board:** HGLRC's Thor 6-port listing and manual text, GetFPV, RaceDayQuads and Oscar Liang's Thor review (port fuses, balance fuses, input limit). The inrush figures are worked out from pack IR, not measured.
- **0.60 V pack spread (0.1 V per cell):** CommonSenseRC Paraboard instructions; Oscar Liang, *Parallel charging*; the ISDT PC-4860 listing (Flyingtech); the HGLRC Thor board manual text; CNHL's parallel-charging guide.
- **0.10 V cell against cell:** the JST XH connector datasheet (3 A at 22 AWG); ToolkitRC and ISDT board specs (2 A balance current).
- **IR differences don't harm the board:** Gogoana et al. 2014 (MIT, *J. Power Sources*); Bruen & Marco 2016 (Warwick); the iCharger DX8 manual (p. 14: IR accuracy "is not high"); RCHelicopterFun on LiPo IR.
- **Single-cell IR step:** Oscar Liang, *When to retire a LiPo*.
- **Self-discharge:** Battery University BU-802b; Guo et al. 2016 (*Scientific Reports*, srep30248).
- **Swelling and damage:** the DX8 manual's safety notes; CNHL's swelling guide; NFPA on lithium-ion batteries; Battery University BU-301a.
- **Heat:** the DX8 manual (Cut-Temp default 45 °C); a LiPo cell datasheet (charge 0–45 °C, Farnell); Oscar Liang; CNHL's charging guide.
- **Low voltage:** Battery University BU-702 and BU-808a; Fear et al. 2018 (*J. Electrochem. Soc.*, UL); the DX8 manual's restore function.
- **Pack figures:** lipo.si's 6S 1300 test (IR); a retailer listing for the CNHL Black 1300 6S (5C max charge).

**Where the evidence is weak**, in plain words:
- The **0.1 V per cell** figure is a long-standing convention that board makers repeat. Nobody has tested it as a hard line. The physics backs it as a sensible point, where the first rush of current is about the pack's own charge rating.
- The **board, lead and fuse resistances** behind the current estimates are estimates. Fuse makers don't publish trip curves for the small balance fuses, and the port fuse's exact time-delay curve isn't published either. The Thor's own manual is an image, so its 0.1 V warning was read from a reproduction.
- The **self-discharge numbers** (0.05 V in 48–72 hours, 0.10 V in 24 hours) are worked out from Battery University's general lithium-ion rule, not from a hobby-LiPo study. They will be tuned against this fleet's own logs; a healthy pack at storage voltage drifts only a few mV over several days.
- The **IR mismatch studies** used different cells, cycled hard and permanently in parallel. They show faster ageing, not danger, so applying them to charge-only paralleling is a stretch, but it points to "doesn't matter", not "pull".
- The **2.0 V and 1.5 V** low-voltage rules come from protected consumer lithium-ion cells. For hobby LiPo, the 2.0–2.5 V band is a judgement call.
- **"A slight puff is cosmetic"** has no support anywhere. A swollen pack is not charged.
- There's **no CNHL datasheet** for these exact packs; only retailer listings.

## Safety notes

- **Where charging happens:** parallel charges are done on a concrete floor, away from anything flammable, and are never left unattended. Storage charges are done in a fireproof BatBox.
- Parallel-charge only within one series, on fused boards, and only packs that pass the board checks at the time: main lead first, then the balance plug.
- A swollen, damaged or hot pack, or one with a cell under 1.5 V, is pulled and not charged.
- Storage-charge each pack on its own after flying so one bad cell can't hide in a group.
- A pack whose cell collapses or can't hold storage voltage comes out of service. *(Example: an original C2-P5 had a cell drop from about 3.78 V to 1.8 V. The pack was retired and a qualified replacement took the C2-P5 slot.)*
- Watch and performance notes are notes, not a reason to panic. A pull is a signal to act.
- These are one hobbyist's rules for one fleet. Follow your manufacturer's guidance and your own judgment.

## New packs

- A new pack gets the next permanent ID and a commission entry. Its first full charge is recorded as a baseline (the arrival cell voltages are that charge's start cells).
- From then on it charges on its series' parallel board like every other pack, from its home channel, with the same board checks and pull rules. Series never mix on a board. The IR trend and step checks start once it has 3 storage nights.
- A pulled pack may retire. A new pack can take a freed slot under a new permanent ID.

---
*Fleet: LostPennyFPV. Data and status calls are updated after each Storage night.*
