# LostPennyFPV · LiPo fleet health

Static dashboard for the LiPo fleet. Internal resistance, intra-pack spread, start-floor voltage, and inter-pack rest delta come from iCharger DX8 Storage charges.

The IR the site shows is `data/v2/ir_store_v4.public.csv`: 215 rows, already true milliohms (median of the DX8 `;128;` samples, divided by 10 in the file). `data/store.csv` and `data/v2/ir_store_v2.public.csv` are the retired `;130;` archive. That line is charge taken per cell in mAh, not IR, and the site does not read it. Status calls live in `data/v2/status_calls.csv`. `data/status.json` holds the Rules v3 thresholds and the gap list.

C1, C2, C3 and C4 are owned CNHL Black Series V2 packs. C3 and C4 are in rotation: CNHL V2 6S 1300 Black, purchased 2026-10-13, first full charge and storage night 1 on 2026-10-14. Partial nights are stored as measured and are never filled in. Capacity in/out and cost per cycle are not in this store.

## Not charged on the charts

A night is "not charged" for a pack when it is on the fleet night list and the pack has no measurement that night, while the pack was in service. In service means on or after the pack's commission night and before a retirement date. A move does not start a new line: the pack is one serial. Nights before commission are not marked. Nothing is drawn before the first reading or after the last.

The store is never filled in. No value is invented. Chart geometry lives in `lib/bridges.ts` as a per-chart mode, rendered by `LineChart` and the tile `Sparkline`. Every recorded reading is joined to the next one. Aggregate charts (series mean IR, including the bake-off chart, Rule B rest-Δ, and the fleet pack trends) draw that line solid through a night with no reading. Their legend does not say "not charged". The series mean still averages only packs measured in that series that night. Pack lines on those charts follow the serial through earlier labels. Pack charts (pack pages and tile sparklines) keep a faint dotted segment at about 40% opacity between two real readings when that pack was not charged, including across a move. Those skipped nights have no marker and no number. A pack with only its first reading is a single point, because a one-point line has no stroke. Rule B is N/A, and is not drawn as a skip, when the series did run but fewer than two packs charged in parallel. The legend on a pack chart that has a skip reads: dotted = not charged. The caption does not call a night "not charged" when any line on that chart still has a point.

`2026-10-09-restday0` is an individual rest-test baseline for C1-P4 and C2-P2. Those rows are not the latest IR, not a series or fleet mean, and not a Rule B night. They are listed as Rest test day 0. A night in the Rest pool is labeled Rest pool, not "not charged". `2026-10-10` is public for C1 and C2. DX8-2 IR is validated. A figure carries † and the legend "provisional: charger screen not compared with a photo" only when that row's `ir_validation` says provisional. `2026-10-11` is a storage night for nine packs and is the latest IR for those packs. `2026-10-11-charge` is a charge run for C2-P6 and C1-P5. It is excluded from latest readings, cards, Rule B, and series and fleet means, the same way a rest-test day-0 row is, and it is listed on those pack pages as a charge run. `2026-10-14-charge` is the first full charge for C3-P1 through C4-P6 and is excluded the same way. `2026-10-14` is their first storage night. `2026-10-16` is storage night 2, one pack per run, so it is not a board night. Charge rules v5 put every pack on its own parallel board. Watch is a note. C3 and C4 each have all six packs and no recorded Rule B yet. Their next-night outlook is C3 0.629 V check first (0.430 V without C3-P5) and C4 0.249 V Go. Recorded Rule B stays C1 0.186 V and C2 0.230 V on 2026-10-11, and C1 0.135 V and C2 0.479 V on 2026-10-10. The Go limit is 0.60 V. C3 and C4 do not share a board with each other or with C1 or C2. Charts stay one series at a time. The date tick for a night is omitted on a chart only when every plotted line is unpublished, and kept when any line has a value or a real skip. With C2 published, 10-10 and 10-11 stay on the C2 charts. The C1 and C2 boards' last public measurement is 2026-10-11. C3 and C4 were last measured on 2026-10-16. CNHL-2026-001's 2026-10-09 reading stays on that pack's line and in the C1 mean. A pack's line follows the serial through every label. Line resistance (L_R) is stored and not shown. `data/UNITS.public.md` is the public column list: a displayed field has to be marked validated, or provisional when the page flags it, and L_R is marked not published. `data/packs-timeseries.json` and `data/sessions.json` name the retired `;130;` charge line `cells_chg_mah`, `avg_chg_mah`, and `spread_chg_mah`. The site does not render those files. A chart caption lists a night as not charged only when every line on that chart is blank there.

A star on the night label is a partial night (the night did not include every pack). That mark stays separate. A pack that was charged on a partial night still has a point on the line. When the pack itself was not charged, the tooltip is only the night and "Not charged: <night>", with no partial tag and no number. CNHL-2026-001 left C1-P1 on 2026-10-08 and returned on 2026-10-17. Its line joins the 2026-09-27 reading to the 2026-10-09 reading. 2026-09-30 sits between them with no value, so the pack chart dots that join and the fleet chart keeps it solid. C1-P5 and the other C1 packs were not charged on 2026-09-30, between readings, so that night is a dotted join on the pack chart. Each C2 pack was not charged on 2026-09-26, between S413 and 2026-09-26-eve, so those lines have one dotted join. `fixtures/v2-gap` is a two-slot manifest for ingest, not this chart mark.

## Run locally

Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production build

```bash
npm install
npm run build
```

`output: "export"` in `next.config.ts` writes a static site to `out/`. Charts render in the browser. There is no server, database, auth, or analytics.

Preview the export with any static file server:

```bash
npx --yes serve out
```

## Repeatable ingest

`scripts/ingest.py` is stdlib-only (Python 3.9+). It accepts a folder, `.tgz` / `.tar.gz` / `.tar`, `.zip`, a single `.txt`, or a `.txt.gz`.

Dry-run a new upload:

```bash
python3 scripts/ingest.py path/to/new.tgz --charger-map path/to/map.json --session YYYY-MM-DD --dry-run
```

Append it to `data/store.csv` and rebuild the JSON (`sessions.json`, `packs-timeseries.json`, `meta.json`):

```bash
python3 scripts/ingest.py path/to/new.tgz --charger-map path/to/map.json --session YYYY-MM-DD
npm run build
```

`--session` is the night id. Use the PT calendar date (`2026-10-12`) when you have one. If you omit it, a single night is named `S` plus the lowest file NNN (`S263`). Passing several nights in one upload without grouping them yourself makes each night `S<min NNN>`.

Rebuild JSON from the CSV without parsing logs:

```bash
python3 scripts/ingest.py --rebuild
```

`--manifest` accepts two shapes. A session manifest has a `slots` column (pipe-separated labels in slot order) plus `session`, `charger_alias`, `channel`, `series`, `mode` (`parallel` or `individual`), and optional `nnn_first` / `nnn_last`. Extra private columns are ignored and must not be committed. A legacy file manifest has `filename`, `pack`, and optional `session`.

```bash
python3 scripts/ingest.py path/to/new.tgz --charger-map path/to/map.json --manifest path/to/session-manifest.csv --session YYYY-MM-DD
python3 scripts/ingest.py path/to/renamed.txt --manifest path/to/manifest.csv --session YYYY-MM-DD
```

The public historical manifest is `data/v2/session_manifest.public.csv`. The store is append-only: an existing `(session, pack)` row is not overwritten.

### Mapping rules

- Only LiPo Storage logs named `LiPo[Storage_NNN_CHx].txt` or `.txt.gz` are auto-mapped. NNN is per charger alias. Do not merge NNN streams across chargers.
- For each manifest row, sort that charger and channel by NNN ascending and map the files onto `slots` in order. The lowest NNN is the first label. Parallel and individual nights use the same order. If the file count does not equal the slot count, ingest exits non-zero and assigns nothing for that row.
- The manifest `slots` column always wins. With no session manifest, a new night uses the home-channel map in `data/v2/next_charge.json`: each active slot, ordered by `planner_rules.series_order` then pack number, grouped by charger and channel. That is the Rules v6/v7 layout (one pack per run on its home channel; today, six slots on each of the four channels). If that file cannot be read, ingest falls back to the same layout, not the retired C1/C2 3+3 split. The count check still applies, so a channel whose file count is not the slot count is refused rather than reshuffled. Rows with a blank NNN range apply only when `--session` matches.
- Each label resolves to a `pack_uid` from `data/v2/packs.csv` and `data/v2/pack_events.csv` as of the session date.
- The usual low cell, taken from `ir_store_v4`, is advisory only. A mismatch is printed and does not remap. The old `;130;` fingerprint gate is retired.
- `fleet_lock`. A charger alias is locked to one fleet only when that charger in `data/pack-registry.json` has `"fleet_lock": true`. Both DX8-1 and DX8-2 are unlocked.
- Cell IR on a raw DX8 log is the median of the `;128;` samples, in 0.1 mΩ steps. Ingest divides that median by 10 once. v4 rows are already milliohms and are not divided again. `IR_SCALE` (0.01), the ÷10 divisor, and the 10 mΩ cap live in `lib/bounds.mjs`; `scripts/ingest.py` copies those numbers. The `;130;` line is mAh and is not stored as IR.
- Discarded from a numeric ingest: 0-byte files, logs with no `;128;` IR samples, duration under 60 s, not 6S, negative or implausible IR (over 10 mΩ after the ÷10), non-Storage programs, and LiHV chemistry. The 10 mΩ cap is a sanity limit, not a Rules v3 cut. Ingest will not append those milliohm rows onto `data/store.csv`, which is the retired archive.
- Dedupe is by sha256 of the decompressed log, and by `(charger alias, NNN, channel)`.

### Charger alias map

DX8 log headers still carry `SN:<serial>`. Public data stores only the alias (`DX8-1` or `DX8-2`). Pass a private JSON object that maps each serial to an alias:

```bash
python3 scripts/ingest.py path/to/new.tgz --charger-map path/to/map.json --session YYYY-MM-DD
```

If `--charger-map` is omitted, ingest reads `LIPO_CHARGER_MAP`. Keys that start with `_` are ignored, so a map may carry a comment field. Ingest applies the map immediately after parsing and uses only the alias after that: night grouping, the `fleet_lock` check, dedupe keys, output rows, and log or error messages. If a log has a header serial and the map is missing, or the serial is not in the map, ingest exits and prints `unknown charger serial ...` plus the last two digits only.

The real map stays off this repo. Do not commit it. `.gitignore` ignores `*charger-alias*.json` and `private/`. Fixtures use the placeholder serials `0000000000` and `0000000001` in `fixtures/charger-map.test.json` (`DX8-1` and `DX8-2`). The site build does not need the map or any environment variable.

### Smoke test

Fixtures under `fixtures/` are trimmed DX8 samples. Dry-run does not modify the store. Historical nights use the public session manifest, because those channels are not the current home-channel queue.

```bash
python3 scripts/ingest.py fixtures/night-S386 --charger-map fixtures/charger-map.test.json --manifest data/v2/session_manifest.public.csv --dry-run
python3 scripts/ingest.py fixtures/c2-only-20260930/C2-storage-20260930.tgz --charger-map fixtures/charger-map.test.json --manifest data/v2/session_manifest.public.csv --session 2026-09-30 --dry-run
python3 scripts/ingest.py fixtures/edge-cases --charger-map fixtures/charger-map.test.json --manifest data/v2/session_manifest.public.csv --dry-run
python3 scripts/ingest.py fixtures/v2-split --charger-map fixtures/charger-map.test.json --session 2026-10-07 --dry-run
python3 scripts/ingest.py fixtures/v2-gap --charger-map fixtures/charger-map.test.json --manifest fixtures/v2-gap/manifest.csv --session 2026-10-09 --dry-run
python3 scripts/ingest.py fixtures/v2-individual-d --charger-map fixtures/charger-map.test.json --manifest fixtures/v2-individual-d/manifest.csv --session 2026-10-09 --dry-run
```

`fixtures/night-S386` is a full 12-file night and assigns all 12 packs to S386. Those rows are already in the store, so a dry run reports them as append-only skips. `fixtures/c2-only-20260930` assigns C2-P1 through C2-P6 to session `2026-09-30`. `fixtures/edge-cases` discards LiHV, Charge, Discharge, a short log, a non-6S log, and an implausible IR, and leaves the renamed file with no NNN unassigned. `fixtures/v2-split` is the old 3-per-channel night and does not pass a manifest. The default map is now six home-channel slots per channel, so that dry run exits non-zero on the count check. `fixtures/v2-gap` maps two files to C1-P2 and C1-P3. `fixtures/v2-individual-d` maps one file to a single slot. `fixtures/v2-mismatch` has three files and two slots and must exit non-zero (`3 files for 2 slots`).

`scripts/ingest.py` only writes the retired `data/store.csv` (and the JSON rebuilt from it). Once that CSV has old-format rows, a real run refuses to append. Against this repo it is a parse-and-check step. Use `--dry-run`.

### Tests

```bash
npm test
```

That runs `python3 -m unittest tests/test_ingest.py` and `node scripts/sane-range.test.mjs`. The Python test covers the ÷10 IR conversion, readings over the 10 mΩ cap, runs under 60 s, LiHV logs, the slot-count refusal, and the charger serial staying out of the output. The Node checks cover the sane-range bounds in `lib/bounds.mjs`. No extra test framework. Snapshot numbers stay in `npm run check-snapshot`, off the production build.

## Routes

- `/` Lost Penny home: wordmark, section cards, a battery snapshot, and what’s new
- `/batteries/` fleet overview, one block per series, status calls, and time-series panels
- `/batteries/next-charge/` run order and the next-charge planner
- `/batteries/bakeoff/` brand comparison
- `/batteries/methodology/` how packs are charged, logged, and judged
- `/batteries/terms-and-rules/` glossary, rules, and gaps
- `/about/` about Lost Penny
- `/builds/`, `/gear/`, `/howtos/` section stubs
- `/batteries/pack/CNHL-2026-001/` (and every other serial) is the pack page. The header shows the current slot label and the serial. A pack with no current series still has this page. History stays here. The next serial is CNHL-2026-025 and a serial is never reused.
- `/batteries/slot/C1-P1/` (and the other current labels) is the position page: the pack in that slot, linked to its serial, plus past occupants with dates.
- `/pack/:serial` and `/pack/:serial/` redirect in one hop to `/batteries/pack/:serial/`. There is no `/slot/*` redirect. Old `/pack/<label>` and `/slot/<label>` URLs are not redirected.
- `/next-charge`, `/bakeoff`, and `/methodology` (each with and without a trailing slash) redirect to the matching `/batteries/` path.

## Deploy

This is a static Next.js export. Publish `out/` or connect the repo to a host that runs `npm run build`. No environment variables are required.
