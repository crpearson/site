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
LIPO_CHARGER_MAP, to a JSON object of serial -> alias (DX8-A, DX8-B). Keys that
start with "_" are ignored. The real map stays off this repo. Ingest maps each
header serial to its alias immediately after parsing and uses only the alias
after that. A missing map, or a serial that is not in the map, exits without
printing the serial.

Mapping (Lipo Lary's locked rules, see data/README or site "About the data"):
  * Only LiPo Storage logs named LiPo[Storage_NNN_CHx].txt(.gz) are auto-mapped.
  * NNN is per charger alias; never merge NNN streams across chargers.
  * CH1 -> fleet C1, CH2 -> fleet C2. Within a night and channel, sort by NNN
    ascending: lowest = P1 ... sixth = P6.  A channel is mapped only if it has
    exactly 6 valid files in the night; otherwise those files stay UNASSIGNED.
  * Charger/fleet lock (only when registry charger has "fleet_lock": true, i.e.
    after dual-DX8 goes live): files from that alias for the other fleet stay
    unassigned. Currently OFF (dual-DX8 HOLD; DX8-A logged both channels).
  * HARD fingerprints must pass or the whole fleet-night is left unassigned
    ("needs_review"): C1-P4 Cell1 = pack-max IR; C2-P2 Cell3 = pack-min IR.
    Soft fingerprints (C2-P6 lowest C2 avg, C2-P4 tightest spread) are advisory.
  * Discard from the numeric store (raw kept): 0-byte, no ;130; IR line,
    duration < 60 s, not 6S, negative or implausible IR (> 1000 mOhm), non-Storage,
    LiHV chemistry.
  * Dedupe by sha256 of decompressed content, and by (charger alias, NNN, CH).
  * Store is append-only: an existing (session, pack) row is never overwritten.
  * Files without NNN in the name (renamed/hashed) need --manifest CSV with
    columns filename,pack (and optional session); otherwise UNASSIGNED.
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
]


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
    # single-DX8 era / dual-DX8 HOLD, DX8-A logged both CH1 (C1) and CH2 (C2).
    # Keys are charger aliases (DX8-A, DX8-B), never serials.
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


def group_nights(logs: list[Log], max_gap: int = 4) -> list[list[Log]]:
    """Split valid named Storage logs (per charger alias) into nights.

    Lary's rule: a night is a 12-file set (6 CH1 + 6 CH2) taken in NNN order.
    Walk files by NNN; close a set when it reaches 6+6, when the NNN gap exceeds
    max_gap, or when a channel would get a 7th file. Incomplete sets are kept as
    their own group (a 6-file single-channel set = partial night, e.g. C2-only).
    """
    nights = []
    by_charger: dict = {}
    for l in logs:
        if l.valid and l.nnn is not None:
            by_charger.setdefault(l.charger, []).append(l)
    for _charger, items in by_charger.items():
        items.sort(key=lambda x: x.nnn)
        cur: list = []
        for l in items:
            n_ch = sum(1 for x in cur if x.channel == l.channel)
            if cur and (l.nnn - cur[-1].nnn > max_gap or n_ch == 6):
                nights.append(cur)
                cur = []
            cur.append(l)
            if sum(1 for x in cur if x.channel == "CH1") == 6 and sum(1 for x in cur if x.channel == "CH2") == 6:
                nights.append(cur)
                cur = []
        if cur:
            nights.append(cur)
    return nights


def assign(logs: list[Log], session: Optional[str], registry, manifest: dict) -> list[Log]:
    lock = charger_fleet_lock(registry)
    # manifest-driven files (no NNN in name)
    for l in logs:
        if l.nnn is None and l.name in manifest:
            pack, sess = manifest[l.name]
            if l.valid:
                l.pack, l.session = pack, sess or session
                l.assign_note = "manifest"
        elif l.nnn is None and l.valid:
            l.assign_note = "UNASSIGNED: no NNN in filename and not in manifest"

    nights = group_nights(logs)
    multi = len(nights) > 1
    for night in nights:
        sid = session if (session and not multi) else f"S{min(l.nnn for l in night):03d}"
        for ch, fleet in (("CH1", "C1"), ("CH2", "C2")):
            chlogs = sorted([l for l in night if l.channel == ch], key=lambda x: x.nnn)
            if not chlogs:
                continue
            charger = chlogs[0].charger
            if charger in lock and lock[charger] != fleet:
                for l in chlogs:
                    l.assign_note = f"UNASSIGNED: charger {charger} is locked to {lock[charger]}"
                continue
            if len(chlogs) != 6:
                for l in chlogs:
                    l.assign_note = f"UNASSIGNED: night {sid} has {len(chlogs)} valid {ch} files (need 6)"
                continue
            packs = {f"{fleet}-P{i+1}": l for i, l in enumerate(chlogs)}
            ok, notes = hard_fp(fleet, packs)
            for pack, l in packs.items():
                if ok:
                    l.pack, l.session = pack, sid
                    l.assign_note = "; ".join(notes) if notes else "mapped channel-then-NNN"
                else:
                    l.assign_note = "UNASSIGNED (needs_review): " + "; ".join(notes)
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
                **{k: v for k, v in p.items() if k not in ("pack", "note", "charger")},
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
def load_manifest(p: Optional[Path]) -> dict:
    if not p:
        return {}
    with p.open() as f:
        return {r["filename"]: (r["pack"], r.get("session") or None) for r in csv.DictReader(f)}


def ingest(paths: list[Path], session: Optional[str], manifest: dict, dry: bool, report: Optional[Path], charger_map: Optional[dict]):
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
    assign(logs, session, registry, manifest)

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
    ap.add_argument("--manifest", type=Path, help="CSV filename,pack[,session] for logs without NNN in name")
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
    ingest(a.inputs, a.session, load_manifest(a.manifest), a.dry_run, a.report, charger_map)


if __name__ == "__main__":
    main()
