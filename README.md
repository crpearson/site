# LostPennyFPV · LiPo fleet health

Static dashboard for a 12-pack LiPo fleet. Internal resistance, intra-pack spread, start-floor voltage, and inter-pack rest delta come from iCharger DX8 Storage charges.

The IR the site shows is `data/v2/ir_store_v4.public.csv`: 159 rows, already true milliohms (median of the DX8 `;128;` samples, divided by 10 in the file). `data/store.csv` and `data/v2/ir_store_v2.public.csv` are the retired `;130;` archive. That line is charge taken per cell in mAh, not IR, and the site does not read it. Status calls live in `data/v2/status_calls.csv`. `data/status.json` holds the Rules v3 thresholds and the gap list.

C1 and C2 are owned CNHL Black Series V2 packs. Partial nights are stored as measured and are never filled in. Capacity in/out and cost per cycle are not in this store.

## Not charged on the charts

A night is "not charged" for a pack when it is on the fleet night list and the pack has no measurement that night, while the pack was in service. In service means on or after the pack's commission night and before a retirement date. Each move starts a new service span. Nights before commission are not marked. Nights on or after a move are not given the hollow start/end marker.

The store is never filled in. No value is invented. Every line chart uses the same skipped-night drawing (`lib/bridges.ts`, rendered by `LineChart` and the tile `Sparkline`). On a per-pack line (pack pages, the overview pack trends, the cell explorer, and the tile sparklines), a faint dotted segment at about 40% opacity joins the two real readings on either side of one or more not-charged nights in the same span. Those skipped nights have no marker and no number. A not-charged night before the first reading or after the last, still in the pre-move span, is a small hollow ring on the bottom edge of the graph, in the line color at low opacity, also with no value. A dotted join never crosses a move. A series-level line (series mean IR, including the bake-off chart, and Rule B rest-Δ) has no pack service span: a night with no value is a skipped night and gets the same dotted join or hollow ring. Rule B is N/A, and is not drawn as a skip, when the series did run but fewer than two packs charged in parallel. Series D (pack D-1) is charged individually and has no rest-Δ line. The legend on an affected chart reads: dotted = not charged · ○ = not charged (start/end). The caption does not call a night "not charged" when any line on that chart still has a point.

`2026-10-09-restday0` is an individual rest-test baseline for C1-P4 and C2-P2. Those rows are not the latest IR, not a series or fleet mean, and not a Rule B night. They are listed as Rest test day 0. A night in the Rest pool is labeled Rest pool, not "not charged". D-1's 2026-10-09 run belongs to series D only. A pack's point stays on the series it was in that night, so a later move does not put the new run on the old series line. Line resistance (L_R) is stored and not shown. `data/UNITS.public.md` is the public column list: a displayed field has to be marked validated, and L_R is marked not published. `data/packs-timeseries.json` and `data/sessions.json` name the retired `;130;` charge line `cells_chg_mah`, `avg_chg_mah`, and `spread_chg_mah`. The site does not render those files. A chart caption lists a night as not charged only when every line on that chart is blank there.

A star on the night label is a partial night (the night did not include every pack). That mark stays separate. A pack that was charged on a partial night still has a solid point. When the pack itself was not charged, the tooltip is only the night and "Not charged: <night>", with no partial tag and no number. CNHL-2026-001 moved from C1-P1 to D-1 on 2026-10-08, which is after every night on the axis, so 2026-09-30 is still before the move. That night is after its last reading on 2026-09-27, so it gets a hollow ring, not a bridge into D-1. C1-P5 and the other C1 packs are the same shape on 2026-09-30. Each C2 pack was not charged on 2026-09-26, between S413 and 2026-09-26-eve, so those lines have one dotted join and no ring on that night. `fixtures/v2-gap` is a two-slot manifest for ingest, not this chart mark.

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

`--manifest` accepts two shapes. A session manifest has a `slots` column (pipe-separated labels in slot order) plus `session`, `charger_alias`, `channel`, `series`, `mode` (`parallel` or `individual`), and optional `nnn_first` / `nnn_last`. Extra private columns are ignored and must not be committed. A legacy file manifest has `filename`, `pack`, and optional `session` (`data/legacy-manifest.csv`).

```bash
python3 scripts/ingest.py path/to/new.tgz --charger-map path/to/map.json --manifest path/to/session-manifest.csv --session YYYY-MM-DD
python3 scripts/ingest.py path/to/renamed.txt --manifest path/to/manifest.csv --session YYYY-MM-DD
```

The public historical manifest is `data/v2/session_manifest.public.csv`. The store is append-only: an existing `(session, pack)` row is not overwritten.

### Mapping rules

- Only LiPo Storage logs named `LiPo[Storage_NNN_CHx].txt` or `.txt.gz` are auto-mapped. NNN is per charger alias. Do not merge NNN streams across chargers.
- For each manifest row, sort that charger and channel by NNN ascending and map the files onto `slots` in order. The lowest NNN is the first label. Parallel and individual nights use the same order. If the file count does not equal the slot count, ingest exits non-zero and assigns nothing for that row.
- The manifest `slots` column always wins. With no session manifest, a new night uses the default split: DX8-1 CH1 = C1-P1..P3, DX8-1 CH2 = C1-P4..P6, DX8-2 CH1 = C2-P1..P3, DX8-2 CH2 = C2-P4..P6. The same count check applies, so a legacy 6-file channel without the manifest is refused rather than reshuffled. Rows with a blank NNN range apply only when `--session` matches.
- Each label resolves to a `pack_uid` from `data/v2/packs.csv` and `data/v2/pack_events.csv` as of the session date.
- The usual low cell, taken from `ir_store_v4`, is advisory only. A mismatch is printed and does not remap. The old `;130;` fingerprint gate is retired.
- `fleet_lock`. A charger alias is locked to one fleet only when that charger in `data/pack-registry.json` has `"fleet_lock": true`. Both DX8-1 and DX8-2 are unlocked.
- Cell IR on a raw DX8 log is the median of the `;128;` samples, in 0.1 mΩ steps. Ingest divides that median by 10 once. `IR_STORE_IS_DX8_INTEGER` is false in `lib/ir.ts` and `scripts/ingest.py`, so v4 rows are not divided again. `IR_SCALE` (0.01) is only the old integer factor. The `;130;` line is mAh and is not stored as IR.
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

Fixtures under `fixtures/` are trimmed DX8 samples. Dry-run does not modify the store. Historical nights use the public session manifest, because those channels are six files and the default split is three.

```bash
python3 scripts/ingest.py fixtures/night-S386 --charger-map fixtures/charger-map.test.json --manifest data/v2/session_manifest.public.csv --dry-run
python3 scripts/ingest.py fixtures/c2-only-20260930/C2-storage-20260930.tgz --charger-map fixtures/charger-map.test.json --manifest data/v2/session_manifest.public.csv --session 2026-09-30 --dry-run
python3 scripts/ingest.py fixtures/edge-cases --charger-map fixtures/charger-map.test.json --manifest data/v2/session_manifest.public.csv --dry-run
python3 scripts/ingest.py fixtures/v2-split --charger-map fixtures/charger-map.test.json --session 2026-10-07 --dry-run
python3 scripts/ingest.py fixtures/v2-gap --charger-map fixtures/charger-map.test.json --manifest fixtures/v2-gap/manifest.csv --session 2026-10-09 --dry-run
python3 scripts/ingest.py fixtures/v2-individual-d --charger-map fixtures/charger-map.test.json --manifest fixtures/v2-individual-d/manifest.csv --session 2026-10-09 --dry-run
```

`fixtures/night-S386` is a full 12-file night and assigns all 12 packs to S386. Those rows are already in the store, so a dry run reports them as append-only skips. `fixtures/c2-only-20260930` assigns C2-P1 through C2-P6 to session `2026-09-30`. `fixtures/edge-cases` discards LiHV, Charge, Discharge, a short log, a non-6S log, and an implausible IR, and leaves the renamed file with no NNN unassigned. `fixtures/v2-split` is a new 12-pack night on the default 3+3+3+3 split and does not pass a manifest. `fixtures/v2-gap` maps two files to C1-P2 and C1-P3. `fixtures/v2-individual-d` maps one file to D-1. `fixtures/v2-mismatch` has three files and two slots and must exit non-zero.

## Routes

- `/` fleet overview, one block per series in the registry, status calls, and time-series panels
- `/pack/CNHL-2026-001/` (and the other pack uids) drill-down. Lowercase `/pack/cnhl-2026-001` redirects here. The path works with or without the trailing slash.
- `/slot/C1-P1/` (and the other labels) current occupant, or empty, plus past occupants
- `/pack/C1-P1/` and the other label URLs show that same slot view. An empty slot says it was vacated and links to the pack that moved.
- `/methodology` how packs are charged, logged, and judged
- `/bakeoff` brand and series prices
- `/about` glossary, Rules v3, Rule B, and gaps

## Deploy

This is a static Next.js export. Publish `out/` or connect the repo to a host that runs `npm run build`. No environment variables are required.

## Maintenance mode

`MAINTENANCE` in `middleware.js` stays `true`. The 503 page runs only when `process.env.VERCEL_ENV === "production"`, which is wtfpv.com. Preview deployments (`VERCEL_ENV=preview`) and any other environment skip it and serve the site, so a pull request can be reviewed. Static assets the maintenance page needs (fonts, favicon) still load. Next.js middleware does not run on a static export of `out/`.

Production keeps returning HTTP 503 with `Retry-After: 3600` and a short LostPennyFPV page. Opening a preview does not change wtfpv.com. Do not promote a preview deployment onto production to bypass the page.

To turn maintenance off on wtfpv.com:

1. In `middleware.js`, change `const MAINTENANCE = true;` to `const MAINTENANCE = false;`.
2. Deploy that change to production (`main`). No other file needs to change.

To turn it back on, set `const MAINTENANCE = true` and deploy production again.
