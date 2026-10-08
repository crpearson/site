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

console.log("v2 IR validation passed 156/156");
