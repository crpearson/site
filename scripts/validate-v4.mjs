import fs from "node:fs";
import path from "node:path";
import { laryParallelBucket, parallelBucket } from "../lib/parallel-rules.mjs";

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

const root = process.cwd();
const irSource = fs.readFileSync(path.join(root, "lib/ir.ts"), "utf8");
const fleetSource = fs.readFileSync(path.join(root, "lib/fleet.ts"), "utf8");
if (!/IR_STORE_IS_DX8_INTEGER = false/.test(irSource)) {
  console.error("lib/ir.ts must keep IR_STORE_IS_DX8_INTEGER false");
  process.exit(1);
}
if (fleetSource.includes("ir_store_v2")) {
  console.error("lib/fleet.ts must not read ir_store_v2");
  process.exit(1);
}

const v4 = parseCsv(fs.readFileSync(path.join(root, "data/v2/ir_store_v4.public.csv"), "utf8"));
if (v4.length !== 159) {
  console.error(`expected 159 ir_store_v4 rows, got ${v4.length}`);
  process.exit(1);
}

let matched = 0;
for (const row of v4) {
  const cells = [1, 2, 3, 4, 5, 6].map((index) => Number(row[`c${index}_mOhm`]));
  const avg = Number(row.avg_mOhm);
  const spread = Number(row.spread_mOhm);
  if (cells.some((cell) => !Number.isFinite(cell) || cell > 20) || !Number.isFinite(avg) || !Number.isFinite(spread)) {
    console.error(`IR row out of true-mΩ range: ${row.session}/${row.pack}`);
    process.exit(1);
  }
  matched += 1;
}

const spot = v4.find((row) => row.pack_uid === "CNHL-2026-001" && row.session === "2026-10-09");
const spotCells = spot ? [1, 2, 3, 4, 5, 6].map((index) => Number(spot[`c${index}_mOhm`]).toFixed(1)).join(",") : "";
if (spotCells !== "3.2,2.9,2.5,2.2,3.0,2.8") {
  console.error(`D-1 2026-10-09 cells ${spotCells}`);
  process.exit(1);
}

const calls = parseCsv(fs.readFileSync(path.join(root, "data/v2/status_calls.csv"), "utf8"));
const packs = parseCsv(fs.readFileSync(path.join(root, "data/v2/packs.csv"), "utf8"));
const rests = parseCsv(fs.readFileSync(path.join(root, "data/v2/rest_tests.csv"), "utf8"));
const visibleRests = rests.filter((row) => row.result.trim() !== "FILLED-SEE-DAY0-ROW");
if (visibleRests.length !== 3 || visibleRests.some((row) => row.pack_uid === "CNHL-2026-003")) {
  console.error("rest tests should show three day-0 rows and no C1-P3 test");
  process.exit(1);
}
for (const uid of ["CNHL-2026-004", "CNHL-2026-008"]) {
  const pack = packs.find((row) => row.pack_uid === uid);
  if (!pack || pack.charge_count !== "14") {
    console.error(`${uid} charge_count should be 14`);
    process.exit(1);
  }
}

function sessionOf(source, date) {
  const raw = source.match(/session=([^;]+)/)?.[1]?.trim() ?? "";
  const token = raw.split(/\s+/)[0] ?? "";
  if (/^\d{4}-\d{2}-\d{2}-restday0$/.test(token)) return token;
  if (/^\d{4}-\d{2}-\d{2}(?:-eve)?$/.test(token) || /^S\d+$/.test(token)) return token;
  return date;
}

const byUid = new Map();
calls.forEach((row, index) => {
  const list = byUid.get(row.pack_uid) ?? [];
  list.push({ ...row, index, session: sessionOf(row.source, row.date) });
  byUid.set(row.pack_uid, list);
});

const disagreements = [];
for (const [uid, list] of byUid) {
  const statusRows = list
    .filter((row) => !/^unchanged\b/i.test(row.status.trim()))
    .sort((a, b) => compareTime(a.session, b.session) || compareTime(a.date, b.date) || a.index - b.index);
  const latest = statusRows[statusRows.length - 1];
  if (!latest || !latest.date.startsWith("2026-10-09") || !latest.status.startsWith("PARALLEL")) continue;
  const history = v4
    .filter((row) => row.pack_uid === uid && row.session_type !== "rest-test-day0")
    .sort((a, b) => compareTime(a.session, b.session));
  const pack = packs.find((row) => row.pack_uid === uid);
  const computed = parallelBucket(
    history.map((row) => ({
      spread: Number(row.spread_mOhm),
      cells: [1, 2, 3, 4, 5, 6].map((index) => Number(row[`c${index}_mOhm`])),
      gap: Number(row.low_cell_gap_mV),
      floor: Number(row.floor_mV),
      floorCell: Number(row.floor_cell),
      starts: [1, 2, 3, 4, 5, 6].map((index) => Number(row[`start_c${index}_mV`])),
    })),
    {
      inDPool: pack?.series === "D" || /d pool/i.test(pack?.status ?? ""),
      failedRest: visibleRests.some((row) => row.pack_uid === uid && /fail/i.test(row.result)),
      selfDischargeWatch: /self-discharge/i.test(pack?.status ?? ""),
    },
  );
  const recorded = laryParallelBucket(latest.status);
  if (/OWNER OVERRIDE/i.test(latest.reason)) {
    console.log(
      `owner override ${uid} (${latest.label_at_time}): recorded ${recorded}; computed ${computed.call}; not a disagreement. Low-cell gap stays on monitor. Cell 4 has no rest test.`,
    );
  } else if (computed.call !== recorded) {
    disagreements.push(`${uid}: computed ${computed.call}, recorded ${recorded}`);
  }
}

if (disagreements.length) {
  console.log(`parallel call disagreements (${disagreements.length}), Lary's text left unchanged:`);
  for (const line of disagreements) console.log(line);
}

console.log(`v4 IR validation passed ${matched}/${v4.length} (site scale is 1; displayed mΩ match ir_store_v4)`);
