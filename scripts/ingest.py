#!/usr/bin/env python3
"""
LiPo hub ingest — iCharger DX8 Storage logs -> normalized store + site JSON.

Stdlib only (Python 3.9+). Usage:

  # parse a new upload (folder, .tgz/.tar.gz, .zip, single .txt or .txt.gz), dry run
  python3 scripts/ingest.py path/to/upload --charger-map path/to/map.json --dry-run

  # append it to data/store.csv using a PT calendar-date night id, then rebuild JSON
  python3 scripts/ingest.py path/to/upload --charger-map path/to/map.json --session 2026-10-12

  # only rebuild data/*.json from data/store.csv
  python3 scripts/ingest.py --rebuild

The raw DX8 header still carries SN:<serial>. Pass --charger-map PATH, or set
LIPO_CHARGER_MAP, to a JSON object of serial -> alias (DX8-1, DX8-2). Keys that
start with "_" are ignored. The real map stays off this repo. Ingest maps each
header serial to its alias immediately after parsing and uses only the alias
after that. A missing map, or a serial that is not in the map, exits without
printing the serial.

Mapping (see data/README or the site "About the data" page):
  * Only LiPo Storage logs named LiPo[Storage_NNN_CHx].txt(.gz) are auto-mapped.
  * NNN is per charger alias; never merge NNN streams across chargers.
  * --manifest PATH is a session manifest when it has a slots column, or the
    legacy filename,pack CSV when it has a filename column. Private columns in
    a session manifest are ignored. The slots list always wins.
  * For each manifest row (session, charger_alias, channel, mode), sort that
    charger and channel's files by NNN ascending and map them onto `slots` in
    order. Parallel and individual use the same order. File count must equal
    slot count; otherwise ingest exits non-zero and does not assign.
  * With no session manifest, a new night uses the default split: DX8-1 CH1 =
    C1-P1..P3, DX8-1 CH2 = C1-P4..P6, DX8-2 CH1 = C2-P1..P3, DX8-2 CH2 =
    C2-P4..P6. The same count check applies. Blank-NNN manifest rows apply
    only when --session matches that row.
  * Each label resolves to a pack_uid from data/v2/packs.csv and pack_events.csv
    as of the session date. Rows carry pack_uid, label_at_time, series_at_time,
    charger alias, channel, file_nnn, charge_mode_at_time, and session_type.
  * Charger/fleet lock applies only when that alias has "fleet_lock": true.
  * HARD fingerprints must pass or ingest exits non-zero: C1-P4 Cell1 =
    pack-max IR; C2-P2 Cell3 = pack-min IR. Soft fingerprints (C2-P6 lowest
    C2 avg, C2-P4 tightest spread) are advisory and do not remap.
  * Discard from the numeric store: 0-byte, no ;130; IR line, duration < 60 s,
    not 6S, negative or implausible IR (> 1000 mOhm), non-Storage, LiHV.
  * Dedupe by sha256 of decompressed content, and by (charger alias, NNN, CH).
  * Store is append-only: an existing (session, pack) row is never overwritten.
  * Do not invent a row for a pack that did not run. The site treats that night as
    not charged on every line chart, including series mean and Rule B rest-delta.
    Between two real readings in the same service span it draws a dotted join and
    plots no value. Before the first reading or after the last it draws a hollow
    ring on the bottom edge, also with no value. Nights before commission and
    nights after a move are not marked. Ingest must not fill those nights in.
  * Files without NNN need a filename,pack manifest; otherwise UNASSIGNED.
"""
from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import json
import os
import re
import statistics
import sys
import tarfile
import zipfile
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable, Optional

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
STORE = DATA / "store.csv"
REGISTRY = DATA / "pack-registry.json"

NAME_RE = re.compile(r"(LiPo|LiHV)\[([A-Za-z ]+)_(\d+)_(CH[12])\]\.txt(?:\.gz)?$")
MIN_DURATION_MS = 60_000
MAX_PLAUSIBLE_IR = 1000
STORE_COLS = [
    "session", "pack", "c1", "c2", "c3", "c4", "c5", "c6", "avg", "spread",
    "start_floor_mV", "start_imbalance_mV", "rest_V", "end_avg_mV", "duration_s",
    "charger", "channel", "file_nnn", "source_sha256", "note",
    "pack_uid", "label_at_time", "series_at_time", "charge_mode_at_time", "session_type",
]

DEFAULT_SLOTS = {
    ("DX8-1", "CH1"): ["C1-P1", "C1-P2", "C1-P3"],
    ("DX8-1", "CH2"): ["C1-P4", "C1-P5", "C1-P6"],
    ("DX8-2", "CH1"): ["C2-P1", "C2-P2", "C2-P3"],
    ("DX8-2", "CH2"): ["C2-P4", "C2-P5", "C2-P6"],
}
PACKS_CSV = DATA / "v2" / "packs.csv"
EVENTS_CSV = DATA / "v2" / "pack_events.csv"


@dataclass
class Log:
    name: str                      # basename only (never a local path)
    sha256: str
    chem: Optional[str] = None
    program: Optional[str] = None
    nnn: Optional[int] = None
    channel: Optional[str] = None
    charger: Optional[str] = None  # alias after the map is applied; never a serial
    model_ok: bool = False
    start_cells: Optional[list] = None
    end_cells: Optional[list] = None
    ir: Optional[list] = None
    duration_ms: Optional[int] = None
    discard: Optional[str] = None
    pack: Optional[str] = None
    session: Optional[str] = None
    assign_note: Optional[str] = None
    pack_uid: Optional[str] = None
    label_at_time: Optional[str] = None
    series_at_time: Optional[str] = None
    charge_mode: Optional[str] = None
    session_type: Optional[str] = None

    @property
    def valid(self) -> bool:
        return self.discard is None and self.ir is not None

    @property
    def avg(self):
        return round(statistics.mean(self.ir), 1) if self.ir else None

    @property
    def spread(self):
        return max(self.ir) - min(self.ir) if self.ir else None


# ----------------------------------------------------------------- reading
def iter_inputs(path: Path) -> Iterable[tuple[str, bytes]]:
    """Yield (basename, raw bytes) for every log-like file in path."""
    if path.is_dir():
        for p in sorted(path.rglob("*")):
            if p.is_file():
                yield from iter_inputs(p)
        return
    n = path.name
    if n.startswith("._") or n == ".DS_Store":
        return
    if n.endswith((".tgz", ".tar.gz", ".tar")):
        with tarfile.open(path) as tf:
            for m in tf.getmembers():
                if m.isfile():
                    base = Path(m.name).name
                    if base.startswith("._"):
                        continue
                    f = tf.extractfile(m)
                    if f:
                        yield from _expand(base, f.read())
        return
    if n.endswith(".zip"):
        with zipfile.ZipFile(path) as zf:
            for m in zf.infolist():
                base = Path(m.filename).name
                if not m.is_dir() and not base.startswith("._"):
                    yield from _expand(base, zf.read(m))
        return
    if n.endswith((".txt", ".txt.gz")):
        yield from _expand(n, path.read_bytes())


def _expand(base: str, raw: bytes) -> Iterable[tuple[str, bytes]]:
    if base.endswith(".gz"):
        try:
            raw = gzip.decompress(raw)
        except OSError:
            pass
        base = base[:-3]
    if base.endswith(".txt"):
        yield base, raw


# ----------------------------------------------------------------- parsing
def parse(name: str, raw: bytes) -> tuple[Log, Optional[str]]:
    """Parse one log. The header serial is returned separately and is not stored on Log."""
    text = raw.decode("utf-8", errors="replace")
    log = Log(name=name, sha256=hashlib.sha256(raw).hexdigest())
    m = NAME_RE.search(name)
    if m:
        log.chem, log.program, nnn, log.channel = m.groups()
        log.nnn = int(nnn)
    if not raw:
        log.discard = "0-byte"
        return log, None
    lines = text.splitlines()
    hdr = next((l for l in lines if l.startswith("@")), "")
    log.model_ok = "Model:DX8" in hdr
    sm = re.search(r"SN:(\d+)", hdr)
    header_serial = sm.group(1) if sm else None

    samples = []
    ir_line = None
    for line in lines:
        if not re.match(r"^\$[12];", line):
            continue
        parts = line.split(";")
        if log.channel is None:
            log.channel = "CH" + parts[0][1]
        if parts[1] == "1" and len(parts) >= 17:
            try:
                cells = [int(parts[i]) for i in range(11, 17)]
            except ValueError:
                continue
            samples.append(cells)
        elif parts[1] == "130":
            ir_line = parts
    if samples:
        log.start_cells, log.end_cells = samples[0], samples[-1]

    if log.chem == "LiHV":
        log.discard = "LiHV (not fleet chemistry)"
    elif log.program and log.program != "Storage":
        log.discard = f"non-Storage program ({log.program})"
    if ir_line is None:
        log.discard = log.discard or "no ;130; IR line"
        return log, header_serial
    try:
        log.duration_ms = int(ir_line[2])
        log.ir = [int(ir_line[i]) for i in range(3, 9)]
    except (ValueError, IndexError):
        log.discard = log.discard or "unparseable IR line"
        log.ir = None
        return log, header_serial
    if log.discard:
        return log, header_serial
    if not log.model_ok:
        log.discard = "header is not DX8"
    elif log.duration_ms < MIN_DURATION_MS:
        log.discard = f"too short ({log.duration_ms // 1000}s)"
    elif not log.start_cells or any(c < 1000 for c in log.start_cells) or 0 in log.ir:
        log.discard = "not 6S"
    elif any(v < 0 for v in log.ir):
        log.discard = "negative IR"
    elif any(v > MAX_PLAUSIBLE_IR for v in log.ir):
        log.discard = f"implausible IR (>{MAX_PLAUSIBLE_IR} mOhm)"
    return log, header_serial


def redact_serial(serial: str) -> str:
    tail = serial[-2:] if len(serial) >= 2 else serial
    return f"...{tail}"


def load_charger_map(path: Optional[Path]) -> Optional[dict]:
    """JSON object of serial -> alias. Keys starting with '_' are comments."""
    if path is None:
        env = os.environ.get("LIPO_CHARGER_MAP")
        if not env:
            return None
        path = Path(env)
    if not path.is_file():
        print(f"charger map not found: {path}", file=sys.stderr)
        raise SystemExit(1)
    try:
        data = json.loads(path.read_text())
    except json.JSONDecodeError:
        print(f"charger map is not valid JSON: {path}", file=sys.stderr)
        raise SystemExit(1)
    if not isinstance(data, dict):
        print("charger map must be a JSON object of serial to alias", file=sys.stderr)
        raise SystemExit(1)
    mapping = {}
    for key, value in data.items():
        if str(key).startswith("_"):
            continue
        if not isinstance(value, str) or not value:
            print("charger map values must be alias strings", file=sys.stderr)
            raise SystemExit(1)
        mapping[str(key)] = value
    return mapping


def apply_charger_alias(log: Log, header_serial: Optional[str], mapping: Optional[dict]) -> None:
    """Map a header serial to its alias. The raw serial is not kept on the log."""
    if not header_serial:
        return
    alias = mapping.get(header_serial) if mapping else None
    if not alias:
        print(f"unknown charger serial {redact_serial(header_serial)}", file=sys.stderr)
        raise SystemExit(1)
    log.charger = alias


# ----------------------------------------------------------------- mapping
def load_registry():
    if REGISTRY.exists():
        return json.loads(REGISTRY.read_text())
    return {"chargers": {}}


def charger_fleet_lock(registry) -> dict:
    # Only enforced once dual-DX8 is live (registry "fleet_lock": true). During the
    # single-DX8 era / dual-DX8 HOLD, DX8-1 logged both CH1 (C1) and CH2 (C2).
    # Keys are charger aliases (DX8-1, DX8-2), never serials.
    return {
        alias: c["fleet"]
        for alias, c in registry.get("chargers", {}).items()
        if isinstance(c, dict) and c.get("fleet") and c.get("fleet_lock")
    }


def hard_fp(fleet: str, packs: dict) -> tuple[bool, list]:
    notes = []
    ok = True
    if fleet == "C1" and "C1-P4" in packs:
        ir = packs["C1-P4"].ir
        if ir[0] != max(ir):
            ok = False
            notes.append("HARD FP FAIL: C1-P4 Cell1 is not pack-max IR")
    if fleet == "C2" and "C2-P2" in packs:
        ir = packs["C2-P2"].ir
        if ir[2] != min(ir):
            ok = False
            notes.append("HARD FP FAIL: C2-P2 Cell3 is not pack-min IR")
    if fleet == "C2" and len(packs) == 6:
        avgs = {p: l.avg for p, l in packs.items()}
        if min(avgs, key=avgs.get) != "C2-P6":
            notes.append("soft FP advisory: C2-P6 not lowest C2 avg")
        sp = {p: l.spread for p, l in packs.items()}
        if sorted(sp.values()).count(sp["C2-P4"]) > 1 or min(sp, key=sp.get) != "C2-P4":
            notes.append("soft FP advisory: C2-P4 not uniquely tightest spread")
    return ok, notes


def time_key(token: str):
    eve = token.endswith("-eve")
    day = token[:-4] if eve else token
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", day or ""):
        return (1, day, 1 if eve else 0)
    match = re.fullmatch(r"S(\d+)", token or "")
    if match:
        return (0, int(match.group(1)), 0)
    return (2, 0, token or "")


def load_identity():
    packs = list(csv.DictReader(PACKS_CSV.open())) if PACKS_CSV.exists() else []
    events = list(csv.DictReader(EVENTS_CSV.open())) if EVENTS_CSV.exists() else []
    return packs, events


def label_as_of(uid: str, session: str, events: list) -> Optional[str]:
    label = None
    owned = sorted((e for e in events if e.get("pack_uid") == uid), key=lambda e: time_key(e.get("date") or ""))
    for event in owned:
        if time_key(event.get("date") or "") <= time_key(session):
            if event.get("to_label"):
                label = event["to_label"]
        else:
            break
    return label


def resolve_label(label: str, session: str, packs: list, events: list):
    hits = [pack for pack in packs if label_as_of(pack["pack_uid"], session, events) == label]
    if len(hits) != 1:
        return None
    return hits[0]


def refuse(message: str):
    print(message, file=sys.stderr)
    raise SystemExit(1)


def bind_slots(logs: list[Log], slots: list[str], session: str, mode: str, registry, packs: list, events: list, manifest_series: Optional[str], how: str):
    ordered = sorted(logs, key=lambda item: item.nnn or 0)
    charger = ordered[0].charger or ""
    channel = ordered[0].channel or ""
    if len(ordered) != len(slots):
        refuse(f"refusing to assign {session} {charger} {channel}: {len(ordered)} files for {len(slots)} slots")
    lock = charger_fleet_lock(registry)
    for log, label in zip(ordered, slots):
        series = label.split("-")[0]
        if manifest_series and manifest_series != series:
            refuse(f"refusing to assign {session} {charger} {channel}: slot {label} is not series {manifest_series}")
        if charger in lock and lock[charger] != series:
            log.assign_note = f"UNASSIGNED: charger {charger} is locked to {lock[charger]}"
            continue
        pack = resolve_label(label, session, packs, events)
        if not pack:
            refuse(f"refusing to assign {session} {charger} {channel}: {label} has no pack on that date")
        log.pack = label
        log.session = session
        log.pack_uid = pack["pack_uid"]
        log.label_at_time = label
        log.series_at_time = pack.get("series") if pack.get("series") == series else series
        log.charge_mode = mode
        log.assign_note = how


def check_fingerprints(logs: list[Log]):
    groups: dict = {}
    for log in logs:
        if log.pack and log.series_at_time and log.session:
            groups.setdefault((log.session, log.series_at_time), []).append(log)
    for (sid, series), items in groups.items():
        packs = {log.pack: log for log in items}
        ok, notes = hard_fp(series, packs)
        if not ok:
            for log in items:
                log.pack = None
                log.assign_note = "UNASSIGNED (needs_review): " + "; ".join(notes)
            refuse(f"refusing to assign {sid} {series}: " + "; ".join(notes))
        if notes:
            for log in items:
                log.assign_note = "; ".join(notes)


def stamp_session_type(logs: list[Log]):
    present: dict = {}
    for log in logs:
        if log.session and log.pack:
            present.setdefault(log.session, set()).add(log.series_at_time)
    for log in logs:
        if not log.pack:
            continue
        if log.charge_mode == "individual":
            log.session_type = "individual"
        elif len(present.get(log.session, ())) <= 1:
            log.session_type = "single-series"
        else:
            log.session_type = "parallel-night"


def assign(logs: list[Log], session: Optional[str], registry, file_manifest: dict, session_rows: list) -> list[Log]:
    packs, events = load_identity()
    for log in logs:
        if log.nnn is None and log.name in file_manifest:
            pack, sess = file_manifest[log.name]
            if log.valid:
                log.pack, log.session = pack, sess or session
                log.label_at_time = pack
                log.assign_note = "file manifest"
                resolved = resolve_label(pack, log.session or "", packs, events) if log.session else None
                if resolved:
                    log.pack_uid = resolved["pack_uid"]
                    log.series_at_time = resolved.get("series") or pack.split("-")[0]
        elif log.nnn is None and log.valid:
            log.assign_note = "UNASSIGNED: no NNN in filename and not in manifest"

    if session_rows:
        rows = [row for row in session_rows if not session or row.get("session") == session]
        ranged = [row for row in rows if row.get("nnn_first") and row.get("nnn_last")]
        blank = [row for row in rows if not (row.get("nnn_first") and row.get("nnn_last"))]
        claimed: set = set()

        def take(row, candidates):
            slots = [slot for slot in (row.get("slots") or "").split("|") if slot]
            if not candidates or not slots:
                return
            bind_slots(
                candidates, slots, row["session"], row.get("mode") or "parallel",
                registry, packs, events, row.get("series") or None, "mapped manifest slots",
            )
            for log in candidates:
                if log.pack:
                    claimed.add(id(log))

        for row in ranged:
            lo, hi = int(row["nnn_first"]), int(row["nnn_last"])
            candidates = [
                log for log in logs
                if log.valid and log.nnn is not None and id(log) not in claimed
                and log.charger == row.get("charger_alias") and log.channel == row.get("channel")
                and lo <= log.nnn <= hi
            ]
            take(row, candidates)
        if session:
            for row in blank:
                candidates = [
                    log for log in logs
                    if log.valid and log.nnn is not None and id(log) not in claimed
                    and log.charger == row.get("charger_alias") and log.channel == row.get("channel")
                ]
                take(row, candidates)
    else:
        groups: dict = {}
        for log in logs:
            if log.valid and log.nnn is not None and not log.pack:
                groups.setdefault((log.charger, log.channel), []).append(log)
        if groups:
            sid = session or f"S{min(log.nnn for items in groups.values() for log in items):03d}"
            for key, items in groups.items():
                slots = DEFAULT_SLOTS.get(key)
                if not slots:
                    for log in items:
                        log.assign_note = f"UNASSIGNED: no default slots for {key[0]} {key[1]}"
                    continue
                bind_slots(items, slots, sid, "parallel", registry, packs, events, None, "mapped default split")

    check_fingerprints(logs)
    stamp_session_type(logs)
    return logs


# ----------------------------------------------------------------- store
def read_store() -> list[dict]:
    if not STORE.exists():
        return []
    with STORE.open() as f:
        return list(csv.DictReader(f))


def to_row(l: Log) -> dict:
    sc = l.start_cells or []
    return {
        "session": l.session, "pack": l.pack,
        **{f"c{i+1}": v for i, v in enumerate(l.ir)},
        "avg": f"{l.avg:.1f}", "spread": l.spread,
        "start_floor_mV": min(sc) if sc else "",
        "start_imbalance_mV": (max(sc) - min(sc)) if sc else "",
        "rest_V": f"{sum(sc)/1000:.3f}" if sc else "",
        "end_avg_mV": round(statistics.mean(l.end_cells)) if l.end_cells else "",
        "duration_s": l.duration_ms // 1000 if l.duration_ms else "",
        "charger": l.charger or "", "channel": l.channel or "",
        "file_nnn": l.nnn if l.nnn is not None else "",
        "source_sha256": l.sha256[:16], "note": l.assign_note or "",
        "pack_uid": l.pack_uid or "",
        "label_at_time": l.label_at_time or "",
        "series_at_time": l.series_at_time or "",
        "charge_mode_at_time": l.charge_mode or "",
        "session_type": l.session_type or "",
    }


def write_store(rows: list[dict]):
    DATA.mkdir(parents=True, exist_ok=True)
    with STORE.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=STORE_COLS, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in STORE_COLS})


# ----------------------------------------------------------------- site JSON
def sess_key(s: str):
    return (0, int(s[1:]), s) if re.fullmatch(r"S\d+", s) else (1, 0, s)


def num(v, f=float):
    try:
        return f(v) if v not in ("", None) else None
    except ValueError:
        return None


def rebuild_json(rows: list[dict], last_ingest: Optional[str] = None):
    sessions: dict = {}
    for r in rows:
        sessions.setdefault(r["session"], []).append(r)
    order = sorted(sessions, key=sess_key)
    out_sessions, series = [], {}
    for sid in order:
        packs = []
        for r in sorted(sessions[sid], key=lambda r: r["pack"]):
            p = {
                "pack": r["pack"],
                "pack_uid": r.get("pack_uid") or "",
                "label_at_time": r.get("label_at_time") or r.get("pack") or "",
                "series_at_time": r.get("series_at_time") or "",
                "charger": r.get("charger") or "",
                "cells_ir_mohm": [num(r[f"c{i}"], int) for i in range(1, 7)],
                "avg_ir_mohm": num(r["avg"]),
                "spread_mohm": num(r["spread"], int),
                "start_floor_mV": num(r["start_floor_mV"], int),
                "start_imbalance_mV": num(r.get("start_imbalance_mV"), int),
                "rest_V": num(r.get("rest_V")),
                "note": r.get("note", ""),
            }
            packs.append(p)
            series.setdefault(r["pack"], []).append({
                "session": sid,
                **{k: v for k, v in p.items() if k not in ("pack", "note", "charger", "pack_uid", "label_at_time", "series_at_time")},
            })
        fleets = sorted({p["pack"].split("-")[0] for p in packs})
        rest = {}
        for fl in fleets:
            vs = [p["rest_V"] for p in packs if p["pack"].startswith(fl) and p["rest_V"] is not None]
            if len(vs) >= 2:
                rest[fl] = {"full_set_delta_V": round(max(vs) - min(vs), 3), "n": len(vs)}
        out_sessions.append({"id": sid, "fleets": fleets, "pack_count": len(packs),
                             "partial": len(packs) < 12, "rest_delta": rest, "packs": packs})
    meta_path = DATA / "meta.json"
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    meta.update({
        "row_count": len(rows),
        "session_count": len(order),
        "sessions": order,
        "last_ingest": last_ingest or meta.get("last_ingest"),
    })
    (DATA / "sessions.json").write_text(json.dumps({"meta": meta, "sessions": out_sessions}, indent=1))
    (DATA / "packs-timeseries.json").write_text(json.dumps(series, indent=1))
    meta_path.write_text(json.dumps(meta, indent=2))


# ----------------------------------------------------------------- main
def load_manifest(p: Optional[Path]):
    """Session manifest (slots column) or legacy file manifest (filename column)."""
    if not p:
        return {}, []
    with p.open() as handle:
        reader = csv.DictReader(handle)
        rows = list(reader)
        fields = reader.fieldnames or []
    if "slots" in fields:
        return {}, rows
    if "filename" in fields:
        return {row["filename"]: (row["pack"], row.get("session") or None) for row in rows}, []
    print("manifest needs a slots column or a filename column", file=sys.stderr)
    raise SystemExit(1)


def ingest(paths: list[Path], session: Optional[str], file_manifest: dict, session_rows: list, dry: bool, report: Optional[Path], charger_map: Optional[dict]):
    registry = load_registry()
    seen_hash, seen_key, logs, dupes = set(), set(), [], 0
    for path in paths:
        for name, raw in iter_inputs(path):
            l, header_serial = parse(name, raw)
            apply_charger_alias(l, header_serial, charger_map)
            key = (l.charger, l.nnn, l.channel) if l.nnn is not None else None
            if l.sha256 in seen_hash or (key and key in seen_key):
                dupes += 1
                continue
            seen_hash.add(l.sha256)
            if key:
                seen_key.add(key)
            logs.append(l)
    assign(logs, session, registry, file_manifest, session_rows)

    rows = read_store()
    existing = {(r["session"], r["pack"]) for r in rows}
    existing_src = {r.get("source_sha256") for r in rows if r.get("source_sha256")}
    new_rows, skipped = [], []
    for l in logs:
        if l.pack and l.session:
            if (l.session, l.pack) in existing or l.sha256[:16] in existing_src:
                skipped.append(f"{l.session}/{l.pack} already in store (append-only, not overwritten)")
                continue
            new_rows.append(to_row(l))

    summary = {
        "files_unique": len(logs), "duplicates_skipped": dupes,
        "assigned": sum(1 for l in logs if l.pack),
        "discarded": {l.name: l.discard for l in logs if l.discard},
        "unassigned": {l.name: l.assign_note for l in logs if l.valid and not l.pack},
        "new_rows": len(new_rows), "already_present": skipped,
        "by_session": {},
    }
    for r in new_rows:
        summary["by_session"].setdefault(r["session"], []).append(r["pack"])
    print(json.dumps(summary, indent=2))
    if report:
        report.write_text(json.dumps({"summary": summary, "logs": [
            {k: v for k, v in asdict(l).items() if k not in ("end_cells",)} for l in logs]}, indent=1))
    if dry:
        print("dry run: store not modified")
        return summary
    rows.extend(new_rows)
    write_store(rows)
    rebuild_json(rows, last_ingest=session)
    return summary


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("inputs", nargs="*", type=Path)
    ap.add_argument("--session", help="night id, PT calendar date e.g. 2026-10-12 (default S<minNNN>)")
    ap.add_argument("--manifest", type=Path, help="session manifest (slots column) or legacy filename,pack CSV")
    ap.add_argument("--charger-map", type=Path, help="JSON serial-to-alias map (fallback: env LIPO_CHARGER_MAP). Keys starting with _ are ignored.")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--rebuild", action="store_true", help="regenerate data/*.json from data/store.csv")
    ap.add_argument("--report", type=Path, help="write per-file JSON report here")
    a = ap.parse_args()
    if a.rebuild and not a.inputs:
        rebuild_json(read_store())
        print("rebuilt data/*.json from", STORE)
        return
    if not a.inputs:
        ap.error("give an upload path or --rebuild")
    charger_map = load_charger_map(a.charger_map)
    file_manifest, session_rows = load_manifest(a.manifest)
    ingest(a.inputs, a.session, file_manifest, session_rows, a.dry_run, a.report, charger_map)


if __name__ == "__main__":
    main()
