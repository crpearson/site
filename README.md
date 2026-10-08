# LostPennyFPV · LiPo fleet health

Static dashboard for a 12-pack LiPo fleet. Internal resistance, intra-pack spread, start-floor voltage, and inter-pack rest delta come from iCharger DX8 Storage charges.

The canonical store is `data/store.csv`: 156 rows across 14 sessions. The site reads the JSON under `data/`. Status calls live in `data/status.json` (the same table as `STATUS.md`).

C1 and C2 are owned CNHL Black Series V2 packs. Partial nights are stored as measured and are never interpolated. Capacity in/out and cost per cycle are not in this store.

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

Logs whose names have no NNN need a manifest CSV with columns `filename`, `pack`, and optional `session`:

```bash
python3 scripts/ingest.py path/to/renamed.txt --manifest path/to/manifest.csv --session YYYY-MM-DD
```

`data/legacy-manifest.csv` is that shape. The store is append-only: an existing `(session, pack)` row is not overwritten.

### Mapping rules

- Only LiPo Storage logs named `LiPo[Storage_NNN_CHx].txt` or `.txt.gz` are auto-mapped. NNN is per charger alias. Do not merge NNN streams across chargers.
- Channel, then NNN. CH1 maps to fleet C1, CH2 to fleet C2. Within a night and a channel, sort by NNN ascending: lowest is P1, sixth is P6.
- A channel is mapped only when that night has exactly 6 valid files on it. Otherwise those files stay unassigned.
- Hard fingerprints must pass or the whole fleet-night is left unassigned (`needs_review`): C1-P4 cell 1 is the pack-max IR, and C2-P2 cell 3 is the pack-min IR.
- Soft fingerprints are advisory and can fail without remapping: C2-P6 is the lowest C2 average, and C2-P4 has the tightest C2 spread.
- Dual-DX8 hold / `fleet_lock`. A charger alias is locked to one fleet only when that charger in `data/pack-registry.json` has `"fleet_lock": true`. Both DX8-A and DX8-B are unlocked. DX8-A has logged CH1 (C1) and CH2 (C2). Set `fleet_lock` once DX8-B is in service. Until then, files from the other fleet are not rejected for charger.
- Discarded from the numeric store: 0-byte files, logs with no `;130;` IR line, duration under 60 s, not 6S, negative or implausible IR (over 1000 mΩ), non-Storage programs, and LiHV chemistry.
- Dedupe is by sha256 of the decompressed log, and by `(charger alias, NNN, channel)`.

### Charger alias map

DX8 log headers still carry `SN:<serial>`. Public data stores only the alias (`DX8-A` or `DX8-B`). Pass a private JSON object that maps each serial to an alias:

```bash
python3 scripts/ingest.py path/to/new.tgz --charger-map path/to/map.json --session YYYY-MM-DD
```

If `--charger-map` is omitted, ingest reads `LIPO_CHARGER_MAP`. Keys that start with `_` are ignored, so a map may carry a comment field. Ingest applies the map immediately after parsing and uses only the alias after that: night grouping, the `fleet_lock` check, dedupe keys, output rows, and log or error messages. If a log has a header serial and the map is missing, or the serial is not in the map, ingest exits and prints `unknown charger serial ...` plus the last two digits only.

The real map stays off this repo. Do not commit it. `.gitignore` ignores `*charger-alias*.json` and `private/`. Fixtures use the placeholder serial `0000000000` and `fixtures/charger-map.test.json`, which maps that placeholder to `DX8-A`. The site build does not need the map or any environment variable.

### Smoke test

Fixtures under `fixtures/` are trimmed DX8 samples. Dry-run does not modify the store.

```bash
python3 scripts/ingest.py fixtures/night-S386 --charger-map fixtures/charger-map.test.json --dry-run
python3 scripts/ingest.py fixtures/c2-only-20260930/C2-storage-20260930.tgz --charger-map fixtures/charger-map.test.json --session 2026-09-30 --dry-run
python3 scripts/ingest.py fixtures/edge-cases --charger-map fixtures/charger-map.test.json --dry-run
```

`fixtures/night-S386` is a full 12-file night and assigns all 12 packs to S386. Those rows are already in the store, so a dry run reports them as append-only skips. `fixtures/c2-only-20260930` assigns C2-P1 through C2-P6 to session `2026-09-30`. `fixtures/edge-cases` discards LiHV, Charge, Discharge, a short log, a non-6S log, and an implausible IR, and leaves the renamed file with no NNN unassigned.

## Routes

- `/` fleet overview, status calls, and time-series panels
- `/pack/C1-P1` (and the other eleven pack ids) drill-down
- `/bakeoff` brand and series prices
- `/about` glossary, Rule A, Rule B, and gaps

## Deploy

This is a static Next.js export. Publish `out/` or connect the repo to a host that runs `npm run build`. No environment variables are required.
