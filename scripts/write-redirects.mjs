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
const packs = parseCsv(fs.readFileSync(path.join(root, "data/v2/packs.csv"), "utf8"));
const events = parseCsv(fs.readFileSync(path.join(root, "data/v2/pack_events.csv"), "utf8"));
const labels = new Set();
for (const pack of packs) if (pack.label) labels.add(pack.label);
for (const event of events) {
  if (event.from_label) labels.add(event.from_label);
  if (event.to_label) labels.add(event.to_label);
}

const redirects = [];
const seen = new Set();
function add(source, destination) {
  if (source === destination || seen.has(source)) return;
  seen.add(source);
  redirects.push({ source, destination, permanent: true });
}

for (const pack of packs) {
  const uid = pack.pack_uid;
  const canonical = `/pack/${uid}/`;
  add(`/pack/${uid}`, canonical);
  const lower = uid.toLowerCase();
  if (lower !== uid) {
    add(`/pack/${lower}`, canonical);
    add(`/pack/${lower}/`, canonical);
  }
}

for (const label of labels) {
  add(`/pack/${label}`, `/pack/${label}/`);
  add(`/slot/${label}`, `/slot/${label}/`);
  const lower = label.toLowerCase();
  if (lower !== label) {
    add(`/pack/${lower}`, `/pack/${label}/`);
    add(`/pack/${lower}/`, `/pack/${label}/`);
    add(`/slot/${lower}`, `/slot/${label}/`);
    add(`/slot/${lower}/`, `/slot/${label}/`);
  }
}

const file = path.join(root, "vercel.json");
fs.writeFileSync(file, `${JSON.stringify({ redirects }, null, 2)}\n`);
console.log(`wrote ${redirects.length} redirects to vercel.json`);
