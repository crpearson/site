# Data

`store.csv` is the retired `;130;` archive. Its numbers are charge taken per cell in mAh, not IR. The site does not read it. `npm run build` runs `scripts/validate-v4.mjs` and checks all 215 rows of `v2/ir_store_v4.public.csv`, which is already true milliohms. Nine rows are the 2026-10-11 storage night. Two are the 2026-10-11 charge run and are not storage nights. Twenty-four rows are C3 and C4 on 2026-10-14: twelve charge-run rows, which are not storage nights, and twelve storage rows, their first storage night. Twelve more rows are the 2026-10-16 storage night, night 2. C3 and C4 are in rotation (CNHL V2 6S 1300 Black, purchased 2026-10-13).

`v2/` is the registry the site reads:

- `packs.csv` — current label, series, charge mode, parallel call, and charge count
- `pack_events.csv` — commission, moves, and rest-test starts
- `status_calls.csv` — verbatim status text. The latest real call per pack is shown. A row marked unchanged is a measurement note.
- `session_manifest.public.csv` — historical slot lists (the slots column wins over the default 3+3 split)
- `ir_store_v4.public.csv` — true cell IR in milliohms and pack S_R. Line resistance is in the file and is not shown.
- `ir_store_v2.public.csv` — legacy `;130;` rows, not shown as IR
- `rest_tests.csv` — 7-day rest tests. Placeholder rows marked `FILLED-SEE-DAY0-ROW` are not shown
- `next.json` — next parallel boards. `as_of` is 2026-10-16, the latest Pacific date in the calls and IR store. The page dates each board by that series' last public measurement. C1 and C2 were last measured on 2026-10-11. C3 and C4 each list all six packs. Rest pool packs are off the boards. `packs-timeseries.json` stores the retired `;130;` charge line as `cells_chg_mah`, `avg_chg_mah`, and `spread_chg_mah`, not as IR. The site does not render that file.
- `UNITS.public.md` — public column units. The private units file is not in this repo.

`archive/v1-20261008/ir_store.csv` is the previous shorter export. `sessions.json`, `packs-timeseries.json`, and `meta.json` can still be rebuilt from the store by `scripts/ingest.py`. The site uses the JSON for session order, thresholds, and gaps. `status.json` holds those thresholds. `pack-registry.json` is chargers and brand catalog prices. Do not treat a registry pack price as a purchase price.

Mapping rules and the ingest command live in the repository README. Short version: a session manifest lists slots in order, files sort by NNN, and the counts must match. With no manifest, the slot map is the home-channel list in `v2/next_charge.json` (series order, then pack number). A missing file falls back to that same layout. The usual low cell is advisory only. Cell IR comes from the `;128;` samples. DX8-1 and DX8-2 are aliases. The raw log header still has a serial; `scripts/ingest.py` maps it with `--charger-map` (or `LIPO_CHARGER_MAP`) before anything is grouped or written. The real map is private and is not in this repo. `scripts/ingest.py` only writes the retired `store.csv` and refuses once old-format rows are present, so a normal run is a parse-and-check (`--dry-run`).

Partial nights are not interpolated. Capacity in/out is not in the DX8 Storage logs.
