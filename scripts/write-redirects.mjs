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
const registry = parseCsv(fs.readFileSync(path.join(root, "data/v2/label_registry.csv"), "utf8"));
const hidden = new Set();
for (const row of registry) {
  for (const label of (row.hidden_labels || "").split("|")) {
    if (label.trim()) hidden.add(label.trim());
  }
}
// Public redirects follow the current slot only. A hidden label stays in the
// event log and does not get a /pack or /slot URL.
const labels = new Set();
for (const pack of packs) {
  if (pack.label && !hidden.has(pack.label)) labels.add(pack.label);
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
// framework null selects the Other preset. outputDirectory must stay "out"
// (the Next preset would look at public/).
const config = {
  $schema: "https://openapi.vercel.sh/vercel.json",
  framework: null,
  buildCommand: "npm run build",
  outputDirectory: "out",
  trailingSlash: true,
  redirects,
};
const stale = redirects.filter(
  (rule) => /D-1/i.test(rule.source) || /D-1/i.test(rule.destination),
);
if (stale.length) {
  console.error(`write-redirects would emit ${stale.length} retired D-1 redirects`);
  process.exit(1);
}
fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
console.log(`wrote ${redirects.length} redirects to vercel.json`);
