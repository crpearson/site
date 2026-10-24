import fs from "node:fs";
import path from "node:path";
import { CELL_IR_MOHM, CELL_VOLTS, PACK_IR_MOHM, PACK_REST_VOLTS } from "../lib/bounds.mjs";
import { buildNextBoard } from "../lib/next-board.mjs";
import { irValidationIsProvisional, PROVISIONAL_LEGEND, PROVISIONAL_MARK } from "../lib/ir-validation.mjs";
import { checkNextCharge } from "../lib/next-charge.mjs";
import { latestCalendarDate, pacificCalendarDate } from "../lib/pacific-date.mjs";
import { publicCsvProblems } from "../lib/public-csv.mjs";
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

const root = process.cwd();
const fleetSource = fs.readFileSync(path.join(root, "lib/fleet.ts"), "utf8");
if (fleetSource.includes("ir_store_v2")) {
  console.error("lib/fleet.ts must not read ir_store_v2");
  process.exit(1);
}

const v4 = parseCsv(fs.readFileSync(path.join(root, "data/v2/ir_store_v4.public.csv"), "utf8"));

const CELL_IR = CELL_IR_MOHM;
const PACK_IR = PACK_IR_MOHM;
const CELL_V = CELL_VOLTS;
const plausibility = [];

function flag(row, field, value, message) {
  const where = [row.session, row.pack || row.label || row.pack_uid].filter(Boolean).join("/");
  plausibility.push(`${where} ${field}=${value}: ${message}`);
}

function finite(raw) {
  if (raw == null || String(raw).trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : Number.NaN;
}

function within(row, field, raw, [lo, hi], unit) {
  const value = finite(raw);
  if (value == null) return;
  if (!Number.isFinite(value) || value < lo || value > hi) {
    flag(row, field, raw, `outside ${lo}–${hi} ${unit}`);
  }
}

function nonNegative(row, field, raw) {
  const value = finite(raw);
  if (value == null) return;
  if (!Number.isFinite(value) || value < 0) flag(row, field, raw, "count must be non-negative");
}

let matched = 0;
for (const row of v4) {
  const cells = [1, 2, 3, 4, 5, 6].map((index) => Number(row[`c${index}_mOhm`]));
  const avg = Number(row.avg_mOhm);
  const spread = Number(row.spread_mOhm);
  if (cells.some((cell) => !Number.isFinite(cell)) || !Number.isFinite(avg) || !Number.isFinite(spread)) {
    console.error(`IR row is not a number: ${row.session}/${row.pack}`);
    process.exit(1);
  }
  cells.forEach((cell, index) => within(row, `c${index + 1}_mOhm`, cell, CELL_IR, "mΩ"));
  const sum = cells.reduce((total, cell) => total + cell, 0);
  if (String(row.pack_SR_mOhm).trim() === "") within(row, "sum of c1..c6_mOhm", sum, PACK_IR, "mΩ");
  else within(row, "pack_SR_mOhm", row.pack_SR_mOhm, PACK_IR, "mΩ");
  within(row, "sum of c1..c6_mOhm", sum, PACK_IR, "mΩ");
  const cellMax = Math.max(...cells);
  if (spread < 0 || spread > cellMax) {
    flag(row, "spread_mOhm", spread, `outside 0–${cellMax} mΩ (cell max on this row)`);
  }
  for (let index = 1; index <= 6; index += 1) {
    const mv = finite(row[`start_c${index}_mV`]);
    if (mv == null) flag(row, `start_c${index}_mV`, row[`start_c${index}_mV`], "missing cell voltage");
    else within(row, `start_c${index}_mV`, mv / 1000, CELL_V, "V");
  }
  if (String(row.floor_mV).trim() !== "") within(row, "floor_mV", Number(row.floor_mV) / 1000, CELL_V, "V");
  nonNegative(row, "n128", row.n128);
  nonNegative(row, "duration_s", row.duration_s);
  matched += 1;
}

const packs = parseCsv(fs.readFileSync(path.join(root, "data/v2/packs.csv"), "utf8"));
for (const pack of packs) nonNegative(pack, "charge_count", pack.charge_count);

const rests = parseCsv(fs.readFileSync(path.join(root, "data/v2/rest_tests.csv"), "utf8"));
for (const test of rests) {
  if (test.result.trim() === "FILLED-SEE-DAY0-ROW") continue;
  nonNegative(test, "cycle", test.cycle);
  for (let index = 1; index <= 6; index += 1) {
    const mv = finite(test[`c${index}_mV`]);
    if (mv == null) continue;
    within(test, `c${index}_mV`, mv / 1000, CELL_V, "V");
  }
}

const chargeSheet = JSON.parse(fs.readFileSync(path.join(root, "data/v2/next_charge.json"), "utf8"));
function outlookBoards(value, out = []) {
  if (Array.isArray(value)) value.forEach((item) => outlookBoards(item, out));
  else if (value && typeof value === "object" && Array.isArray(value.packs) && value.outlook_rule_b) out.push(value);
  else if (value && typeof value === "object") Object.values(value).forEach((item) => outlookBoards(item, out));
  return out;
}
for (const board of outlookBoards(chargeSheet)) {
  const outlook = board.outlook_rule_b;
  within({ session: board.series, pack: "outlook" }, "value_v", outlook.value_v, [0, 2], "V");
  within({ session: board.series, pack: "outlook" }, "limit_v", outlook.limit_v, [0.01, 2], "V");
  if (outlook.value_without_check_first_v != null) {
    within({ session: board.series, pack: "outlook" }, "value_without_check_first_v", outlook.value_without_check_first_v, [0, 2], "V");
  }
  if (board.last_rule_b_V != null) within({ session: board.series, pack: "recorded" }, "last_rule_b_V", board.last_rule_b_V, [0, 2], "V");
  for (const item of outlook.check_first ?? []) {
    within({ session: board.series, pack: item.label }, "last_rest_V", item.last_rest_V, PACK_REST_VOLTS, "V");
    within({ session: board.series, pack: item.label }, "last_offset_max_V", item.last_offset_max_V, [0, 2], "V");
  }
  const ir = outlook.ir_match;
  if (!ir || typeof ir !== "object") {
    flag({ session: board.series, pack: "ir_match" }, "ir_match", ir, "missing IR match");
    continue;
  }
  within({ session: board.series, pack: "ir_match" }, "board_median_mohm", ir.board_median_mohm, CELL_IR, "mΩ");
  const notePct = ir.note_pct ?? ir.check_first_pct;
  const strongPct = ir.strong_note_pct ?? ir.charge_alone_pct;
  within({ session: board.series, pack: "ir_match" }, "note_pct", notePct, [0.01, 100], "%");
  within({ session: board.series, pack: "ir_match" }, "strong_note_pct", strongPct, [0.01, 100], "%");
  if (!(strongPct > notePct)) {
    flag({ session: board.series, pack: "ir_match" }, "strong_note_pct", strongPct, "must be above note_pct");
  }
  for (const item of ir.packs ?? []) {
    within({ session: board.series, pack: item.label }, "avg_mohm", item.avg_mohm, CELL_IR, "mΩ");
    within({ session: board.series, pack: item.label }, "pct_off", item.pct_off, [-100, 1000], "%");
  }
}

if (plausibility.length) {
  console.error(`plausibility failed (${plausibility.length}). Lary's files were not edited:`);
  for (const line of plausibility) console.error(line);
  process.exit(1);
}
console.log(`plausibility passed ${v4.length}/${v4.length} (no real-data row outside the bounds)`);
console.log(`v4 IR validation passed ${matched}/${v4.length} (site scale is 1; displayed mΩ match ir_store_v4)`);

function fail(message) {
  console.error(message);
  process.exit(1);
}

const calls = parseCsv(fs.readFileSync(path.join(root, "data/v2/status_calls.csv"), "utf8"));
const latestPtDate = latestCalendarDate([
  ...v4.map((row) => row.session),
  ...calls.map((row) => row.date),
  ...calls.map((row) => (row.source.match(/session=([^;]+)/)?.[1] ?? "").trim().split(/\s+/)[0] ?? ""),
]);
if (pacificCalendarDate(new Date("2026-10-10T06:30:00Z")) !== "2026-10-09") {
  fail("Pacific date helper treated 2026-10-10 06:30 UTC as a Pacific Oct 10");
}
if (pacificCalendarDate(new Date("2026-10-10T08:00:00Z")) !== "2026-10-10") {
  fail("Pacific date helper did not roll the calendar at Pacific midnight");
}
const board = buildNextBoard();
if (board.as_of !== latestPtDate) {
  fail(`next parallel as-of ${board.as_of} is not the latest data date ${latestPtDate}`);
}
if (board.series.some((item) => item.labels.some((label) => label.startsWith("D-")))) fail("a D label is on a next parallel board");
if (board.resting.length !== 0) fail("the rest pool is retired (rules v6), but next.json still lists resting packs");
const labelRegistry = parseCsv(fs.readFileSync(path.join(root, "data/v2/label_registry.csv"), "utf8"));
for (const row of labelRegistry) {
  if (row.display_series === "D" || /^D-/.test(row.display_label)) fail(`label registry displays series D for ${row.pack_uid}`);
}
// Public CSV downloads (every CSV under data/, history included): no log-number columns, channel is the
// full name ("DX8-1 Channel 1"), and no log numbers or CH1/CH2 tags in any field.
function csvFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) csvFiles(full, out);
    else if (entry.name.endsWith(".csv")) out.push(full);
  }
  return out;
}
const publicCsvs = csvFiles(path.join(root, "data"));
for (const file of publicCsvs) {
  const text = fs.readFileSync(file, "utf8");
  for (const problem of publicCsvProblems(path.relative(root, file), text, parseCsv(text))) fail(problem);
}
for (const file of ["data/sessions.json", "data/packs-timeseries.json", "data/meta.json", "data/pack-registry.json", "data/status.json"]) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  const hit = text.match(/file_nnn|\bNNN\b|Storage_\d+|\bCH[12]\b|#\d+ =|2603022837|2604012839/);
  if (hit) fail(`${file} carries a log number, serial or short channel tag (${hit[0]})`);
}
console.log(`public csv shape passed (${publicCsvs.length} files)`);
// Planner data: run order and file counts only; no log numbers and no short channel tags in next_charge.
for (const file of ["data/v2/next_charge.json", "data/v2/NEXT_CHARGE.md"]) {
  const body = fs.readFileSync(path.join(root, file), "utf8");
  const hit = body.match(/Storage_\d+|next_log|next_number|log_number|expected_log/i);
  if (hit) fail(`${file} carries a log number field (${hit[0]})`);
  if (/\bCH[12]\b/.test(body)) fail(`${file} uses a short channel tag; write "DX8-1 Channel 1" in full`);
}
const nextChargePage = fs.readFileSync(path.join(root, "app/batteries/next-charge/page.tsx"), "utf8");
const chargePlanner = fs.readFileSync(path.join(root, "components/ChargePlanner.tsx"), "utf8");
const runSheet = fs.readFileSync(path.join(root, "components/RunSheet.tsx"), "utf8");
const notes = fs.readFileSync(path.join(root, "components/NextChargeNotes.tsx"), "utf8");
const chargeAlone = fs.readFileSync(path.join(root, "components/ParallelBoardDiagram.tsx"), "utf8");
const plannerSource = `${nextChargePage}\n${chargePlanner}\n${runSheet}\n${notes}`;
if (!nextChargePage.includes("loadNextChargeV4") || !nextChargePage.includes("planRuns")) {
  fail("the next charge page must plan runs with planRuns from the v4 file");
}
if (!chargePlanner.includes('from "@/lib/plan-runs.mjs"') || chargePlanner.includes("next-charge.mjs")) {
  fail("the planner client must call planRuns from the pure module");
}
if (chargePlanner.includes("fly-D-1") || chargePlanner.includes("D-1") || nextChargePage.includes("with D-1")) {
  fail("the next charge planner must not offer a D-1 box");
}
if (!plannerSource.includes("DX8-1 Channel 1") || !plannerSource.includes("DX8-1: ")) {
  fail("the next charge page must show full channel names and file counts");
}
if (!notes.includes("Out of rotation") || !notes.includes("Notes") || !notes.includes("Self-discharge") || !notes.includes("Measurement") || !notes.includes("Per-cell check")) {
  fail("the next charge page must show pulled packs, performance notes, self-discharge checks, measurement and the per-cell check");
}
if (/\bCH[12]\b/.test(plannerSource) || /series board|series parallel/i.test(plannerSource)) {
  fail("the next charge page uses a short channel tag or a series board");
}
if (/Storage_\d+|log number|next_log/i.test(plannerSource)) {
  fail("the next charge page asks for a log number");
}
if (!chargeAlone.includes("last_offset_max_V") || !chargeAlone.includes(" V")) {
  fail("charge-alone offsets must be shown in volts");
}
const nextFile = JSON.parse(fs.readFileSync(path.join(root, "data/v2/next.json"), "utf8"));
if (JSON.stringify(nextFile) !== JSON.stringify(board)) {
  fail("data/v2/next.json does not match the boards built from the latest parallel calls");
}
console.log(`next parallel ${board.as_of}: ${board.series.map((item) => item.labels.join("+")).join(" | ")}`);

for (const file of ["data/packs-timeseries.json", "data/sessions.json"]) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  if (text.includes('"cells_ir_mohm"') || text.includes('"avg_ir_mohm"') || text.includes("spread_mohm") || text.includes("_ir_mohm")) {
    fail(`${file} still labels ;130; charge as milliohms`);
  }
}

function jsonFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) jsonFiles(full, out);
    else if (entry.name.endsWith(".json")) out.push(full);
  }
  return out;
}

function numbersUnder(value, out = []) {
  if (typeof value === "number" && Number.isFinite(value)) out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => numbersUnder(item, out));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => numbersUnder(item, out));
  return out;
}

function mohmLimit(key) {
  return /pack|(^|_)avg|sr|s_r/i.test(key) ? PACK_IR[1] : CELL_IR[1];
}

for (const file of jsonFiles(path.join(root, "data"))) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const walkValues = (value) => {
    if (Array.isArray(value)) value.forEach(walkValues);
    else if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        if (key.endsWith("_mohm")) {
          const limit = mohmLimit(key);
          for (const number of numbersUnder(child)) {
            if (number > limit) fail(`${path.relative(root, file)} ${key}=${number} exceeds ${limit}`);
          }
        } else walkValues(child);
      }
    }
  };
  walkValues(data);
}

for (const file of ["data/meta.json", "data/sessions.json"]) {
  const data = JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
  const metrics = file.endsWith("sessions.json") ? data.meta.metrics_available : data.metrics_available;
  for (const name of metrics) {
    if (String(name).includes("mohm") || String(name).includes("_ir_")) {
      fail(`${file} metrics_available still uses a milliohm name for the charge store: ${name}`);
    }
  }
}
console.log("charge-store names and _mohm bounds passed");

function walkTsx(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkTsx(full, out);
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

function expandColumns(cell) {
  const names = [];
  for (const piece of cell.replace(/\*/g, "").split(",")) {
    const part = piece.trim();
    const range = part.split(/\s*(?:…|\.\.\.)\s*/);
    if (range.length === 2) {
      const start = range[0].match(/^(.*?)(\d+)(.*)$/);
      const end = range[1].match(/^(.*?)(\d+)(.*)$/);
      if (start && end && start[1] === end[1] && start[3] === end[3]) {
        for (let n = Number(start[2]); n <= Number(end[2]); n += 1) names.push(`${start[1]}${n}${start[3]}`);
        continue;
      }
    }
    if (part.includes("_")) names.push(part);
  }
  return names;
}

function validationMark(text) {
  const plain = text.replace(/\*/g, "");
  if (/not published/i.test(plain)) return "not-published";
  if (/not validated/i.test(plain)) return "not-validated";
  if (irValidationIsProvisional(plain)) return "provisional";
  if (/validated/i.test(plain)) return "validated";
  if (/derived/i.test(plain)) return "derived";
  if (/label/i.test(plain)) return "label";
  return "other";
}

function unitsColumns(markdown) {
  const marks = new Map();
  for (const line of markdown.split("\n")) {
    if (!line.startsWith("|") || line.includes("---")) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 2) continue;
    const mark = validationMark(cells[cells.length - 1]);
    for (const name of expandColumns(cells[0])) marks.set(name, mark);
  }
  return marks;
}

function findNamed(dir, name, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".preview-main" || entry.name === "out") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findNamed(full, name, out);
    else if (entry.name === name) out.push(full);
  }
  return out;
}

const privateUnits = findNamed(root, "UNITS.md");
if (privateUnits.length) fail(`private units file is still in the repo: ${privateUnits.map((file) => path.relative(root, file)).join(", ")}`);
const unitsPath = path.join(root, "data/UNITS.public.md");
if (!fs.existsSync(unitsPath)) fail("data/UNITS.public.md is missing");
const units = unitsColumns(fs.readFileSync(unitsPath, "utf8"));
if (units.get("LR_mOhm") !== "not-published") fail("LR_mOhm must be marked not published in data/UNITS.public.md");

const ui = walkTsx(path.join(root, "app")).concat(walkTsx(path.join(root, "components")));
const uiText = ui.map((file) => fs.readFileSync(file, "utf8")).join("\n");
const codeText = `${uiText}\n${fs.readFileSync(path.join(root, "lib/fleet.ts"), "utf8")}`;
if (/\bL_R\b/.test(codeText) || codeText.includes("LR_mOhm") || /\.lr\b/.test(codeText)) {
  fail("displayed code renders L_R");
}
const markerSource = fs.readFileSync(path.join(root, "lib/ir-validation.mjs"), "utf8");
const provisionalFlagged =
  uiText.includes("<ProvisionalMark") &&
  uiText.includes("<ProvisionalLegend") &&
  uiText.includes("PROVISIONAL_LEGEND") &&
  uiText.includes("PROVISIONAL_MARK") &&
  markerSource.includes(PROVISIONAL_LEGEND) &&
  markerSource.includes(PROVISIONAL_MARK);
if (!fleetSource.includes("irValidationIsProvisional")) {
  fail("provisional IR is not driven by ir_validation");
}
for (const row of v4) {
  const text = String(row.ir_validation ?? "");
  if (!text.trim()) fail(`missing ir_validation on ${row.session}/${row.pack_uid}`);
  const provisional = irValidationIsProvisional(text);
  if (provisional && !provisionalFlagged) {
    fail(`provisional IR on ${row.session}/${row.pack_uid} is published without the provisional marker`);
  }
  if (!provisional && !/\bvalidated\b/i.test(text)) {
    fail(`ir_validation is not validated or provisional on ${row.session}/${row.pack_uid}`);
  }
}
for (const [name, mark] of units) {
  if (name.length < 4 || !name.includes("_")) continue;
  const inPage = uiText.includes(name);
  const usedAsIr = /mOhm$/i.test(name) && (codeText.includes(name) || (/^c\d_mOhm$/.test(name) && codeText.includes("_mOhm")));
  if (!(inPage || usedAsIr)) continue;
  if (mark === "validated") continue;
  if (mark === "provisional" && provisionalFlagged) continue;
  fail(`${name} is displayed and marked ${mark}`);
}
console.log("units check passed (displayed fields are validated or flagged provisional; L_R is not published)");

const nextCharge = checkNextCharge(root);
console.log(`next charge validated (${nextCharge.schema})`);
