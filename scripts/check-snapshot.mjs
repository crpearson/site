/**
 * Optional pins for the current data snapshot. Not part of `npm run build`.
 *
 *   node --experimental-strip-types scripts/check-snapshot.mjs
 *
 * The build keeps range, unit, series-D, provisional, and chart-behaviour checks.
 * This script keeps the exact dates, counts, statuses, and IR numbers that
 * otherwise have to be edited on every data night.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildNextBoard } from "../lib/next-board.mjs";
import { loadNextCharge, loadNextChargeV4, storageSummary } from "../lib/next-charge.mjs";
import { latestCalendarDate } from "../lib/pacific-date.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
register(pathToFileURL(path.join(here, "ts-hooks.mjs")).href);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") field += char;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((cells) => cells.some((cell) => cell.length));
  return body.map((cells) => Object.fromEntries(header.map((key, index) => [key, cells[index] ?? ""])));
}

function timeKey(token) {
  const rest = token.match(/^(\d{4}-\d{2}-\d{2})-restday0$/);
  if (rest) return [1, rest[1], 2];
  const charge = token.match(/^(\d{4}-\d{2}-\d{2})-charge$/);
  if (charge) return [1, charge[1], -1];
  const eve = token.endsWith("-eve");
  const day = eve ? token.slice(0, -4) : token;
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) return [1, day, eve ? 1 : 0];
  const session = token.match(/^S(\d+)$/);
  if (session) return [0, session[1].padStart(6, "0"), 0];
  return [2, token, 0];
}

function compareTime(a, b) {
  const left = timeKey(a);
  const right = timeKey(b);
  if (left[0] !== right[0]) return left[0] - right[0];
  if (left[1] !== right[1]) return left[1] < right[1] ? -1 : 1;
  return left[2] - right[2];
}

const v4 = parseCsv(fs.readFileSync(path.join(root, "data/v2/ir_store_v4.public.csv"), "utf8"));
if (v4.length !== 261) fail(`expected 261 ir_store_v4 rows, got ${v4.length}`);

const spot = v4.find((row) => row.pack_uid === "CNHL-2026-001" && row.session === "2026-10-09");
const spotCells = spot ? [1, 2, 3, 4, 5, 6].map((index) => Number(spot[`c${index}_mOhm`]).toFixed(1)).join(",") : "";
if (spotCells !== "3.2,2.9,2.5,2.2,3.0,2.8") fail(`D-1 2026-10-09 cells ${spotCells}`);

const packs = parseCsv(fs.readFileSync(path.join(root, "data/v2/packs.csv"), "utf8"));
const rests = parseCsv(fs.readFileSync(path.join(root, "data/v2/rest_tests.csv"), "utf8"));
const visibleRests = rests.filter((row) => row.result.trim() !== "FILLED-SEE-DAY0-ROW");
const day0Rests = visibleRests.filter((row) => row.reading === "storage_end");
const d1Seven = visibleRests.filter((row) => row.test_id === "RT-001-1" && row.reading === "7day");
if (
  day0Rests.length !== 3 ||
  visibleRests.length !== 6 ||
  ["RT-004-1", "RT-008-1"].some((id) => visibleRests.filter((row) => row.test_id === id && row.reading === "7day" && row.result === "PASS" && row.reading_date === "2026-10-18").length !== 1) ||
  d1Seven.length !== 1 ||
  d1Seven[0].result !== "PASS" ||
  d1Seven[0].excess_mV !== "2" ||
  visibleRests.some((row) => row.pack_uid === "CNHL-2026-003")
) {
  fail("rest tests should show three day-0 rows, the RT-001-1, RT-004-1 and RT-008-1 PASS rows, and no C1-P3 test");
}
for (const uid of ["CNHL-2026-004", "CNHL-2026-008"]) {
  const pack = packs.find((row) => row.pack_uid === uid);
  if (!pack || pack.charge_count !== "16") fail(`${uid} charge_count should be 16`);
}

const calls = parseCsv(fs.readFileSync(path.join(root, "data/v2/status_calls.csv"), "utf8"));
const events = parseCsv(fs.readFileSync(path.join(root, "data/v2/pack_events.csv"), "utf8"));
const labelRegistry = parseCsv(fs.readFileSync(path.join(root, "data/v2/label_registry.csv"), "utf8"));
const mapped = new Map(labelRegistry.map((row) => [row.pack_uid, row]));
const reg001 = mapped.get("CNHL-2026-001");
if (!reg001 || reg001.display_label !== "C1-P1" || reg001.display_series !== "C1" || reg001.applies_to !== "all dates" || reg001.date !== "2026-10-17") {
  fail("label_registry must map CNHL-2026-001 to C1-P1 / C1 for all dates, dated 2026-10-17");
}
const shownSeries = (row) => (mapped.has(row.pack_uid) && row.series_at_time === "D" ? mapped.get(row.pack_uid).display_series : row.series_at_time);
const moved = new Set(events.filter((row) => row.event === "move" && !mapped.has(row.pack_uid)).map((row) => row.pack_uid));
const slotted = packs.filter((pack) => !moved.has(pack.pack_uid) && !pack.retired.trim());
const latestAvg = (uid) => {
  const rows = v4
    .filter((row) => row.pack_uid === uid && row.session_type !== "rest-test-day0" && row.session_type !== "charge-run")
    .sort((a, b) => compareTime(a.session, b.session));
  return rows[rows.length - 1];
};
const fleetMean = slotted.reduce((sum, pack) => sum + Number(latestAvg(pack.pack_uid).avg_mOhm), 0) / slotted.length;
if (slotted.length !== 24 || fleetMean.toFixed(3) !== "2.773") {
  fail(`fleet mean ${fleetMean} over ${slotted.length}, expected 2.773 mΩ over 24`);
}
const c1p4 = latestAvg("CNHL-2026-004");
if (!c1p4 || c1p4.session !== "2026-10-18" || Number(c1p4.avg_mOhm) !== 2.65 || Number(c1p4.spread_mOhm) !== 1.2 || Number(c1p4.pack_SR_mOhm) !== 15.9 || Number(c1p4.floor_mV) !== 3612 || Number(c1p4.low_cell_gap_mV) !== 87) {
  fail(`C1-P4 latest operational row is ${c1p4?.session} ${c1p4?.avg_mOhm}`);
}
const c2p2 = latestAvg("CNHL-2026-008");
if (!c2p2 || c2p2.session !== "2026-10-18" || Number(c2p2.avg_mOhm) !== 3.133) {
  fail(`C2-P2 latest operational row is ${c2p2?.session} ${c2p2?.avg_mOhm}`);
}
const d1 = v4.find((row) => row.session === "2026-10-09" && row.pack_uid === "CNHL-2026-001");
if (!d1 || d1.series_at_time !== "D" || shownSeries(d1) !== "C1") fail("CNHL-2026-001 2026-10-09 must be stored as written and shown under C1");

function seriesMean(series) {
  const groups = new Map();
  for (const row of v4) {
    if (shownSeries(row) !== series || row.session_type === "rest-test-day0" || row.session_type === "charge-run") continue;
    const list = groups.get(row.session) ?? [];
    list.push(Number(row.avg_mOhm));
    groups.set(row.session, list);
  }
  const sessions = [...groups.keys()].sort(compareTime);
  const last = sessions[sessions.length - 1];
  const values = groups.get(last);
  return { session: last, mean: values.reduce((sum, value) => sum + value, 0) / values.length };
}
const expectedMeans = [
  ["C1", "2026-10-18", "2.786"],
  ["C2", "2026-10-18", "2.853"],
  ["C3", "2026-10-23", "2.728"],
  // 2026-10-23 C4 mean is over five packs: the C4-P4 row is held (Cell 6 IR 0.4 mΩ, under the 0.5 mΩ bound).
  ["C4", "2026-10-23", "2.787"],
];
for (const [series, session, mean] of expectedMeans) {
  const got = seriesMean(series);
  if (got.session !== session || got.mean.toFixed(3) !== mean) fail(`${series} last series value is ${got.session} ${got.mean}`);
}

const latestPtDate = latestCalendarDate([
  ...v4.map((row) => row.session),
  ...calls.map((row) => row.date),
  ...calls.map((row) => (row.source.match(/session=([^;]+)/)?.[1] ?? "").trim().split(/\s+/)[0] ?? ""),
]);
if (latestPtDate !== "2026-10-23") fail(`latest PT session or call date is ${latestPtDate}, expected 2026-10-23`);

const expectedBoards = [
  { series: "C1", labels: ["C1-P1", "C1-P2", "C1-P3", "C1-P4", "C1-P5", "C1-P6"] },
  { series: "C2", labels: ["C2-P1", "C2-P2", "C2-P3", "C2-P4", "C2-P5", "C2-P6"] },
  { series: "C3", labels: ["C3-P1", "C3-P2", "C3-P3", "C3-P4", "C3-P5", "C3-P6"] },
  { series: "C4", labels: ["C4-P1", "C4-P2", "C4-P3", "C4-P4", "C4-P5", "C4-P6"] },
];
const board = buildNextBoard();
const rendered = board.series.map((item) => item.labels.join("+")).join(" | ");
const expected = expectedBoards.map((item) => item.labels.join("+")).join(" | ");
if (rendered !== expected || board.as_of !== "2026-10-23") fail(`next parallel ${board.as_of} ${rendered}, expected 2026-10-23 ${expected}`);

for (const [label, series, test] of [["C1-P4", "C1", "RT-004-1"], ["C2-P2", "C2", "RT-008-1"]]) {
  const call = calls.filter((row) => row.label_at_time === label).at(-1);
  if (!call || call.date !== "2026-10-18" || call.status !== `PARALLEL GO: on the ${series} board | SERVICE In service` || !/rules v7/.test(call.source) || !call.reason.includes("check passed")) {
    fail(`${label} latest call should be the 2026-10-18 rules v7 pass (${test}) on the ${series} board`);
  }
  const back = events.filter((row) => row.pack_uid === call.pack_uid && row.event === "rest_pool_exit" && row.date === "2026-10-17");
  if (back.length !== 1) fail(`${label} needs one rest_pool_exit event dated 2026-10-17`);
}
{
  const p1 = calls.filter((row) => row.pack_uid === "CNHL-2026-001").at(-1);
  if (!p1 || p1.label_at_time !== "C1-P1" || p1.date !== "2026-10-17" || p1.status !== "PARALLEL GO: on the C1 board | SERVICE In service (watch)") fail("CNHL-2026-001 latest call should be C1-P1 on the C1 board");
  const move = events.filter((row) => row.pack_uid === "CNHL-2026-001" && row.event === "move");
  if (move.length !== 2 || move[1].date !== "2026-10-17" || move[1].from_label !== "D-1" || move[1].to_label !== "C1-P1") fail("CNHL-2026-001 needs the 2026-10-17 move D-1 -> C1-P1");
  if (!board.series.find((item) => item.series === "C1")?.labels.includes("C1-P1")) fail("C1-P1 is missing from the C1 board");
}
for (const [label, series] of [["C1-P5", "C1"], ["C2-P1", "C2"], ["C3-P2", "C3"], ["C3-P5", "C3"], ["C3-P6", "C3"], ["C4-P2", "C4"]]) {
  const call = calls.filter((row) => row.label_at_time === label).at(-1);
  if (!call || call.date !== "2026-10-17" || call.status !== `PARALLEL GO: on the ${series} board | SERVICE In service` || !/performance note/.test(call.reason)) {
    fail(`${label} latest call should be Go, In service, with its watch item as a performance note (rules v7)`);
  }
}
for (const label of ["C1-P4", "C2-P2", "C3-P5", "C3-P6", "C4-P2"]) {
  if (!board.series.some((item) => item.labels.includes(label))) fail(`${label} is missing from its board`);
}
const c4p4 = calls.filter((row) => row.label_at_time === "C4-P4").at(-1);
if (!c4p4 || c4p4.date !== "2026-10-16" || c4p4.status !== "PARALLEL GO: on the C4 board | SERVICE In service") {
  fail("C4-P4 latest call should be Go on the C4 board");
}
const methodologySha = createHash("sha256").update(fs.readFileSync(path.join(root, "content/methodology.md"))).digest("hex");
if (methodologySha !== "3c7d230a2ab182b7e9af2583463be41d47600d2a28162658a47be15b36a90ac7") {
  fail(`methodology.md sha256 is ${methodologySha}`);
}

const chargeFile = fs.readFileSync(path.join(root, "data/v2/next_charge.json"));
const chargeSha = createHash("sha256").update(chargeFile).digest("hex");
if (chargeSha !== "84e53d20ef22c6be6918ab9c49beef261d41adf015e65c42509373e1f5a5b03c") {
  fail(`next_charge.json sha256 is ${chargeSha}`);
}
const doc = loadNextChargeV4(root);
const row = (label) => doc.home_channels.find((item) => item.label === label);
if (doc.home_channels.length !== 24) fail(`home_channels has ${doc.home_channels.length} rows`);
const p1 = row("C1-P1");
if (p1.uid !== "CNHL-2026-001" || p1.state !== "active" || p1.charger !== "DX8-1" || p1.channel !== 1 || !/Cell 6 is a watch note/.test(p1.note) || /D pool|D-1/.test(p1.note)) {
  fail("C1-P1 must be CNHL-2026-001, active on DX8-1 Channel 1, with the Cell 6 watch note");
}
if (doc.home_channels.some((item) => item.state !== "active")) fail("every real slot is active");
const all = doc.planner_fixtures.find((item) => item.id === "C1+C2+C3+C4");
const wantChannels = {
  "DX8-1 Channel 1": ["C1-P1", "C1-P2", "C2-P5", "C3-P1", "C3-P2", "C4-P5"],
  "DX8-1 Channel 2": ["C1-P3", "C1-P4", "C2-P6", "C3-P3", "C3-P4", "C4-P6"],
  "DX8-2 Channel 1": ["C1-P5", "C2-P1", "C2-P2", "C3-P5", "C4-P1", "C4-P2"],
  "DX8-2 Channel 2": ["C1-P6", "C2-P3", "C2-P4", "C3-P6", "C4-P3", "C4-P4"],
};
if (JSON.stringify(all?.channels) !== JSON.stringify(wantChannels) || all.files["DX8-1"] !== 12 || all.files["DX8-2"] !== 12) {
  fail(`all-four run order is ${JSON.stringify(all?.channels)}`);
}
const c1 = doc.planner_fixtures.find((item) => item.id === "C1");
if (JSON.stringify(c1?.rounds) !== JSON.stringify({ "DX8-1": [["C1-P1", "C1-P3"], ["C1-P2", "C1-P4"]], "DX8-2": [["C1-P5", "C1-P6"]] })) fail("C1 rounds changed");
const synth = doc.planner_fixtures.find((item) => item.fixture_states);
if (!synth || JSON.stringify(synth.fixture_states) !== '{"C2-P3":"pulled"}' || synth.channels["DX8-2 Channel 2"].join("+") !== "C2-P4" || synth.files["DX8-2"] !== 3) {
  fail("the fixture-only pulled C2-P3 case changed");
}
if (doc.planner_fixtures.length !== 16) fail(`planner_fixtures has ${doc.planner_fixtures.length}`);
if (doc.pulled.length !== 0 || doc.charge_alone.length !== 0) fail("pulled and charge_alone must be empty on the real data");
const labels = (list) => list.map((item) => item.label).join("+");
if (labels(doc.watch) !== "C1-P1") fail(`watch is ${labels(doc.watch)}`);
// 2026-10-23: C3-P1 reached storage (3.86 V per cell), so its top-up advisory is cleared.
if (labels(doc.check_before_connecting) !== "") fail(`check_before_connecting is ${labels(doc.check_before_connecting)}`);
if (labels(doc.performance_notes) !== "C1-P4+C1-P5+C2-P1+C2-P4+C3-P2+C3-P5+C3-P6+C4-P2+C4-P6") fail(`performance_notes is ${labels(doc.performance_notes)}`);
if (doc.self_discharge_checks.open.map((item) => item.test_id).sort().join("+") !== "") fail("open self-discharge checks changed (RT-004-1 and RT-008-1 passed 2026-10-18)");
const boards = doc.parallel_boards.map((item) => `${item.series}:${item.packs.length}:${item.outlook_rule_b.value_v}:${item.outlook_rule_b.call}:${item.outlook_rule_b.cell_check.labels.join("+")}`).join(" ");
if (boards !== "C1:6:0.006:GO: C2:6:0.006:GO: C3:6:0.008:GO: C4:6:0.011:GO:") fail(`boards are ${boards}`);
if (doc.parallel_boards[2].outlook_rule_b.check_first.map((item) => item.label).join("+") !== "") fail("C3 check-first changed");

const view = loadNextCharge(root);
const summary = storageSummary(view.storage_runs).map((item) => item.line).join("\n");
const expectedSummary = [
  "DX8-1 Channel 1 C1-P1 · Channel 2 C1-P3 · DX8-2 Channel 1 C1-P5 · Channel 2 C1-P6",
  "DX8-1 Channel 1 C1-P2 · Channel 2 C1-P4 · DX8-2 Channel 1 C2-P1 · Channel 2 C2-P3",
  "DX8-1 Channel 1 C2-P5 · Channel 2 C2-P6 · DX8-2 Channel 1 C2-P2 · Channel 2 C2-P4",
].join("\n");
if (summary !== expectedSummary) fail(`set A view summary is\n${summary}`);
if (view.do_not_connect.length !== 0 || view.sets.C1_C2.parallel_boards.map((item) => item.packs.join("+")).join(" ") !== "C1-P1+C1-P2+C1-P3+C1-P4+C1-P5+C1-P6 C2-P1+C2-P2+C2-P3+C2-P4+C2-P5+C2-P6") {
  fail("set A view boards changed");
}

process.env.CHECK_SNAPSHOT = "1";
await import("../lib/fleet.ts");
console.log("snapshot checks passed");
