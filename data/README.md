# Data

`store.csv` is the canonical append-only IR store (156 rows, 14 sessions). `sessions.json`, `packs-timeseries.json`, and `meta.json` are built from it by `scripts/ingest.py`. The site reads the JSON. Do not hand-edit those three if you can rebuild them.

`status.json` is the live fleet call (OK / Caution / OFF), separate from the IR store. `pack-registry.json` is chargers, brands, prices, and pack identity. `ir_store.csv` is the shorter Lary export the store was normalized from. `legacy-manifest.csv` maps renamed logs that have no NNN in the filename.

Mapping rules and the ingest command live in the repository README. Short version: channel then NNN (CH1 → C1, CH2 → C2, lowest NNN in a channel is P1), hard fingerprints (C1-P4 cell 1 is pack-max IR, C2-P2 cell 3 is pack-min IR), and `fleet_lock` stays off during the dual-DX8 hold.

Partial nights are not interpolated. Capacity in/out is not in the DX8 Storage logs.
