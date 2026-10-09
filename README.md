# LostPennyFPV · LiPo fleet health

Static dashboard for a 12-pack LiPo fleet. Internal resistance, intra-pack spread, start-floor voltage, and inter-pack rest delta come from iCharger DX8 Storage charges.

The canonical store is `data/store.csv`: 156 rows across 14 sessions, joined to `data/v2/` for pack identity. The site reads those CSVs. Status calls live in `data/v2/status_calls.csv`. `data/status.json` still holds Rule A / Rule B thresholds and the gap list.

C1 and C2 are owned CNHL Black Series V2 packs. Partial nights are stored as measured and are never filled in. Capacity in/out and cost per cycle are not in this store.

## Not charged on the charts

A night is "not charged" for a pack when it is on the fleet night list and the pack has no measurement that night, while the pack was in service. In service means on or after the pack's commission night and before a retirement date. Each move starts a new service span. Nights before commission are not marked. Nights on or after a move are not given the hollow start/end marker.

The store is never filled in. No value is invented. On a per-pack line (pack pages, the overview pack trends, the cell explorer, and the tile sparklines), a faint dotted segment at about 40% opacity joins the two real readings on either side of one or more not-charged nights in the same span. Those skipped nights have no marker and no number. A not-charged night before the first reading or after the last, still in the pre-move span, is a small hollow ring on the bottom edge of the graph, in the line color at low opacity, also with no value. A dotted join never crosses a move. Series-average lines and the Rule B line are not pack lines. They still stop where that series has no value, and they are not dotted across. The legend on an affected chart reads: dotted = not charged · ○ = not charged (start/end).

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
- Hard fingerprints must pass or ingest exits non-zero: C1-P4 cell 1 is the pack-max IR, and C2-P2 cell 3 is the pack-min IR.
- Soft fingerprints are advisory and can fail without remapping: C2-P6 is the lowest C2 average, and C2-P4 has the tightest C2 spread.
- `fleet_lock`. A charger alias is locked to one fleet only when that charger in `data/pack-registry.json` has `"fleet_lock": true`. Both DX8-1 and DX8-2 are unlocked.
- Discarded from the numeric store: 0-byte files, logs with no `;130;` IR line, duration under 60 s, not 6S, negative or implausible IR (over 1000 mΩ), non-Storage programs, and LiHV chemistry.
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
- `/about` glossary, Rule A, Rule B, and gaps

## Deploy

This is a static Next.js export. Publish `out/` or connect the repo to a host that runs `npm run build`. No environment variables are required.
