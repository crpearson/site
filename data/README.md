# Data

`store.csv` is the retired `;130;` archive. Its numbers are charge taken per cell in mAh, not IR. The site does not read it. `npm run build` runs `scripts/validate-v4.mjs` and checks all 159 rows of `v2/ir_store_v4.public.csv`, which is already true milliohms.

`v2/` is the registry the site reads:

- `packs.csv` — current label, series, charge mode, parallel call, and charge count
- `pack_events.csv` — commission, moves, and rest-test starts
- `status_calls.csv` — verbatim status text. The latest real call per pack is shown. A row marked unchanged is a measurement note.
- `session_manifest.public.csv` — historical slot lists (the slots column wins over the default 3+3 split)
- `ir_store_v4.public.csv` — true cell IR in milliohms, pack S_R, and line L_R
- `ir_store_v2.public.csv` — legacy `;130;` rows, not shown as IR
- `rest_tests.csv` — 7-day rest tests. Placeholder rows marked `FILLED-SEE-DAY0-ROW` are not shown
- `next.json` — next parallel boards as of 2026-10-08, because that composition is not a column on the status calls

`archive/v1-20261008/ir_store.csv` is the previous shorter export. `sessions.json`, `packs-timeseries.json`, and `meta.json` can still be rebuilt from the store by `scripts/ingest.py`. The site uses the JSON for session order, thresholds, and gaps. `status.json` holds those thresholds. `pack-registry.json` is chargers and brand catalog prices. Do not treat a registry pack price as a purchase price. `legacy-manifest.csv` maps renamed logs that have no NNN in the filename.

Mapping rules and the ingest command live in the repository README. Short version: a session manifest lists slots in order, files sort by NNN, and the counts must match. With no manifest, DX8-1 CH1 is C1-P1..P3, DX8-1 CH2 is C1-P4..P6, DX8-2 CH1 is C2-P1..P3, and DX8-2 CH2 is C2-P4..P6. The usual low cell is advisory only. Cell IR comes from the `;128;` samples. DX8-1 and DX8-2 are aliases. The raw log header still has a serial; `scripts/ingest.py` maps it with `--charger-map` (or `LIPO_CHARGER_MAP`) before anything is grouped or written. The real map is private and is not in this repo.

Partial nights are not interpolated. Capacity in/out is not in the DX8 Storage logs.
