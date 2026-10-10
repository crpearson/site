import fs from "node:fs";
import path from "node:path";

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
  return body.map((cells) =>
    Object.fromEntries(header.map((key, index) => [key, cells[index] ?? ""])),
  );
}

const root = process.cwd();
const store = parseCsv(fs.readFileSync(path.join(root, "data/store.csv"), "utf8"));
const v2 = parseCsv(fs.readFileSync(path.join(root, "data/v2/ir_store_v2.public.csv"), "utf8"));
const fields = ["c1", "c2", "c3", "c4", "c5", "c6", "avg", "spread"];

if (store.length !== 156 || v2.length !== 156) {
  console.error(`expected 156 rows in both stores, got store=${store.length} v2=${v2.length}`);
  process.exit(1);
}

const byKey = new Map(v2.map((row) => [`${row.session}\t${row.pack}`, row]));
const mismatches = [];
for (const row of store) {
  const other = byKey.get(`${row.session}\t${row.pack}`);
  if (!other) {
    mismatches.push(`${row.session}/${row.pack} missing from ir_store_v2`);
    continue;
  }
  for (const field of fields) {
    if (String(row[field]) !== String(other[field])) {
      mismatches.push(`${row.session}/${row.pack} ${field}`);
    }
  }
}

if (mismatches.length) {
  console.error(`v2 IR validation failed (${mismatches.length} mismatch${mismatches.length === 1 ? "" : "es"})`);
  for (const line of mismatches) console.error(line);
  process.exit(1);
}

// The 156/156 check compares the two CSV files as stored. It does not scale.
// Display scaling lives in lib/ir.ts and applies only while the CSVs are still
// DX8 integers. TODO(lary): when the corrected milliohm CSVs arrive, set
// IR_STORE_IS_DX8_INTEGER false and drop the raw-integer expectation below.
const irSource = fs.readFileSync(path.join(root, "lib/ir.ts"), "utf8");
function irConst(name) {
  const match = irSource.match(new RegExp(`export const ${name} = (true|false|[0-9.]+)`));
  if (!match) {
    console.error(`lib/ir.ts is missing ${name}`);
    process.exit(1);
  }
  if (match[1] === "true") return true;
  if (match[1] === "false") return false;
  return Number(match[1]);
}
const storeIsRaw = irConst("IR_STORE_IS_DX8_INTEGER");
const scale = irConst("IR_SCALE");
const sample = v2.find((row) => row.pack_uid === "CNHL-2026-001" && row.session === "S413");
const rawCells = sample ? [1, 2, 3, 4, 5, 6].map((index) => sample[`c${index}`]).join(",") : "";
if (storeIsRaw) {
  if (rawCells !== "569,543,524,538,552,545") {
    console.error(`expected raw S413 cells 569,543,524,538,552,545, got ${rawCells}`);
    process.exit(1);
  }
  const scaled = rawCells.split(",").map((value) => (Number(value) * scale).toFixed(2));
  if (scaled.join(",") !== "5.69,5.43,5.24,5.38,5.52,5.45") {
    console.error(`scaled S413 cells ${scaled.join(",")} do not match ÷100`);
    process.exit(1);
  }
  console.log("v2 IR validation passed 156/156 (CSV match is the DX8 integer; display uses IR_SCALE)");
} else {
  if (rawCells === "569,543,524,538,552,545") {
    console.error("IR_STORE_IS_DX8_INTEGER is false but the CSV still holds DX8 integers");
    process.exit(1);
  }
  console.log("v2 IR validation passed 156/156 (CSV values are already mΩ; IR_SCALE is not applied)");
}
