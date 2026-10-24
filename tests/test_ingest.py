"""Parse-and-check coverage for scripts/ingest.py. Stdlib unittest only.

Run from the repo root:

    python3 -m unittest tests/test_ingest.py
"""
from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INGEST_PATH = ROOT / "scripts" / "ingest.py"
STORE = ROOT / "data" / "store.csv"
CHARGER_MAP = ROOT / "fixtures" / "charger-map.test.json"
SERIALS = ("0000000000", "0000000001")


def load_ingest():
    spec = importlib.util.spec_from_file_location("ingest", INGEST_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules["ingest"] = module
    spec.loader.exec_module(module)
    return module


def lipo_log(name: str, cells: list[int], duration_ms: int = 120_000, serial: str = "0000000000", chem: str = "LiPo") -> tuple[str, bytes]:
    joined = ";".join(str(cell) for cell in cells)
    text = (
        f"@Model:DX8; Fireware:V1.17; Hardware:V1.00; SN:{serial}\n"
        "$1;1;0;1;0;0;28066;22066;0;280;0;3700;3700;3700;3700;3700;3700;0;0;41\n"
        f"$1;128;{duration_ms};320;170;{joined};0;0;1\n"
    )
    return name, text.encode()


class TestIngest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ingest = load_ingest()
        cls.store_before = STORE.read_bytes()

    @classmethod
    def tearDownClass(cls):
        # These checks are dry runs and parse() calls. The retired store stays put.
        if STORE.read_bytes() != cls.store_before:
            raise AssertionError("data/store.csv changed during ingest tests")

    def test_ingest(self):
        ingest = self.ingest
        with self.subTest("ir divided by 10"):
            raw = (ROOT / "fixtures" / "v2-gap" / "LiPo[Storage_901_CH1].txt").read_bytes()
            log, _serial = ingest.parse("LiPo[Storage_901_CH1].txt", raw)
            # The ;128; cell columns on this fixture are 28, which is 2.8 mΩ after /10.
            self.assertIsNone(log.discard)
            self.assertEqual(log.ir, [2.8, 2.8, 2.8, 2.8, 2.8, 2.8])

        with self.subTest("reject IR over the cap"):
            name, raw = lipo_log("LiPo[Storage_1_CH1].txt", [101, 28, 28, 28, 28, 28])
            log, _serial = ingest.parse(name, raw)
            self.assertEqual(log.discard, f"implausible IR (>{ingest.MAX_PLAUSIBLE_IR} mΩ)")
            self.assertFalse(log.valid)

        with self.subTest("reject runs under 60s"):
            found = None
            for name, raw in ingest.iter_inputs(ROOT / "fixtures" / "edge-cases"):
                if name.startswith("LiPo[Storage_275_"):
                    found = ingest.parse(name, raw)[0]
                    break
            self.assertIsNotNone(found)
            self.assertLess(found.duration_ms, 60_000)
            self.assertTrue(found.discard.startswith("too short"))

        with self.subTest("reject LiHV"):
            found = None
            for name, raw in ingest.iter_inputs(ROOT / "fixtures" / "edge-cases"):
                if name.startswith("LiHV["):
                    found = ingest.parse(name, raw)[0]
                    break
            self.assertIsNotNone(found)
            self.assertEqual(found.discard, "LiHV (not fleet chemistry)")

        with self.subTest("slot-count mismatch refuses"):
            result = self._run([
                "fixtures/v2-mismatch",
                "--charger-map", "fixtures/charger-map.test.json",
                "--manifest", "fixtures/v2-mismatch/manifest.csv",
                "--session", "2026-10-09",
                "--dry-run",
            ])
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("3 files for 2 slots", result.stderr)
            for serial in SERIALS:
                self.assertNotIn(serial, result.stdout)
                self.assertNotIn(serial, result.stderr)

        with self.subTest("charger serial never appears"):
            with tempfile.TemporaryDirectory() as tmp:
                report = Path(tmp) / "report.json"
                result = self._run([
                    "fixtures/v2-gap",
                    "--charger-map", "fixtures/charger-map.test.json",
                    "--manifest", "fixtures/v2-gap/manifest.csv",
                    "--session", "2026-10-09",
                    "--dry-run",
                    "--report", str(report),
                ])
                self.assertEqual(result.returncode, 0, result.stderr)
                report_text = report.read_text()
                blob = result.stdout + result.stderr + report_text
                for serial in SERIALS:
                    self.assertNotIn(serial, blob)
                self.assertIn("DX8-1", report_text)
                summary = json.loads(result.stdout.split("dry run:")[0])
                self.assertGreater(summary["assigned"], 0)

            name, raw = lipo_log("LiPo[Storage_2_CH1].txt", [28, 28, 28, 28, 28, 28], serial="9988776655")
            log, header = ingest.parse(name, raw)
            self.assertEqual(header, "9988776655")
            self.assertNotIn("9988776655", json.dumps(ingest.asdict(log)))
            with tempfile.TemporaryDirectory() as tmp:
                folder = Path(tmp)
                (folder / name).write_bytes(raw)
                result = self._run([
                    str(folder),
                    "--charger-map", "fixtures/charger-map.test.json",
                    "--dry-run",
                ])
                self.assertNotEqual(result.returncode, 0)
                self.assertNotIn("9988776655", result.stdout + result.stderr)
                self.assertIn("...55", result.stderr)

        with self.subTest("default slots come from next_charge"):
            doc = json.loads((ROOT / "data" / "v2" / "next_charge.json").read_text())
            order = doc["planner_rules"]["series_order"]
            include = set(doc["planner_rules"]["include_states"])
            rows = [
                row for row in doc["home_channels"]
                if row["charger"] == "DX8-1" and row["channel"] == 1 and row["state"] in include
            ]
            rows.sort(key=lambda row: (order.index(row["series"]), row["slot"]))
            expected = [row["label"] for row in rows]
            self.assertEqual(ingest.DEFAULT_SLOTS[("DX8-1", "CH1")], expected)
            self.assertNotEqual(expected, ["C1-P1", "C1-P2", "C1-P3"])
            missing = ROOT / "data" / "v2" / "no-such-next-charge.json"
            self.assertEqual(ingest.load_default_slots(missing), ingest.FALLBACK_SLOTS)
            self.assertNotEqual(ingest.FALLBACK_SLOTS[("DX8-1", "CH1")], ["C1-P1", "C1-P2", "C1-P3"])

    def test_public_shape(self):
        ingest = self.ingest
        self.assertEqual(ingest.full_channel("DX8-2", "CH1"), "DX8-2 Channel 1")
        self.assertEqual(ingest.full_channel("DX8-1", "DX8-1 Channel 2"), "DX8-1 Channel 2")
        self.assertEqual(ingest.full_channel(None, "CH1"), "")
        self.assertEqual(ingest.split_channel("DX8-1 Channel 2"), ("DX8-1", "CH2"))
        self.assertNotIn("file_nnn", ingest.STORE_COLS)
        self.assertNotIn("charger", ingest.STORE_COLS)
        raw = (ROOT / "fixtures" / "v2-gap" / "LiPo[Storage_901_CH1].txt").read_bytes()
        log, _serial = ingest.parse("LiPo[Storage_901_CH1].txt", raw)
        log.charger = "DX8-1"
        row = ingest.to_row(log)
        self.assertEqual(row["channel"], "DX8-1 Channel 1")
        self.assertNotIn("file_nnn", row)
        self.assertNotIn("901", json.dumps(row))

        with self.subTest("public manifest shape maps with --session"):
            with tempfile.TemporaryDirectory() as tmp:
                manifest = Path(tmp) / "manifest.csv"
                manifest.write_text(
                    "session,channel,series,mode,slots,days_since_last_use,notes\n"
                    "2026-10-09,DX8-1 Channel 1,C1,parallel,C1-P2|C1-P3,,gap night\n"
                )
                result = self._run([
                    "fixtures/v2-gap",
                    "--charger-map", "fixtures/charger-map.test.json",
                    "--manifest", str(manifest),
                    "--session", "2026-10-09",
                    "--dry-run",
                ])
                self.assertEqual(result.returncode, 0, result.stderr)
                summary = json.loads(result.stdout.split("dry run:")[0])
                self.assertEqual(summary["by_session"].get("2026-10-09"), ["C1-P2", "C1-P3"])

    def _run(self, args: list[str]) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(INGEST_PATH), *args],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )


if __name__ == "__main__":
    unittest.main()
