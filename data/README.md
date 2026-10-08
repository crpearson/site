# Data

`store.csv` is the append-only IR store (156 rows, 14 sessions). Its `charger` column is the charger alias (`DX8-1` or `DX8-2`), not a serial. `pack_uid`, `label_at_time`, and `series_at_time` are joined from `v2/ir_store_v2.public.csv` on `(session, pack)`. `c1`–`c6`, `avg`, and `spread` must match that file; `npm run build` runs `scripts/validate-v2.mjs` and fails on any mismatch. `start_floor_mV` in the store is the ingest value and is not rewritten when the v2 export differs.

`v2/` is the registry the site reads:

- `packs.csv` — current label, series, charge mode, and blank purchase fields
- `pack_events.csv` — commission and moves
- `status_calls.csv` — verbatim status text
- `session_manifest.public.csv` — historical slot lists (the slots column wins over the default 3+3 split)
- `ir_store_v2.public.csv` — IR rows with pack uid and the label at the time
- `next.json` — next parallel boards as of 2026-10-08, because that composition is not a column on the status calls

`archive/v1-20261008/ir_store.csv` is the previous shorter export. `sessions.json`, `packs-timeseries.json`, and `meta.json` can still be rebuilt from the store by `scripts/ingest.py`. The site uses the JSON for session order, thresholds, and gaps. `status.json` holds those thresholds. `pack-registry.json` is chargers and brand catalog prices. Do not treat a registry pack price as a purchase price. `legacy-manifest.csv` maps renamed logs that have no NNN in the filename.

Mapping rules and the ingest command live in the repository README. Short version: a session manifest lists slots in order, files sort by NNN, and the counts must match. With no manifest, DX8-1 CH1 is C1-P1..P3, DX8-1 CH2 is C1-P4..P6, DX8-2 CH1 is C2-P1..P3, and DX8-2 CH2 is C2-P4..P6. Hard fingerprints stay (C1-P4 cell 1 is pack-max IR, C2-P2 cell 3 is pack-min IR). DX8-1 and DX8-2 are aliases. The raw log header still has a serial; `scripts/ingest.py` maps it with `--charger-map` (or `LIPO_CHARGER_MAP`) before anything is grouped or written. The real map is private and is not in this repo.

Partial nights are not interpolated. Capacity in/out is not in the DX8 Storage logs.
