import fs from "node:fs";
import path from "node:path";

/**
 * Serial routing.
 * - A (label, date) claimed by label_registry maps to one serial.
 * - The current slot map (latest registry row per serial, else packs.csv) gives each label one serial.
 * - Built pack links point at a known serial.
 * - /pack/:serial is one hop. /slot/* redirects are absent.
 * - A hidden label such as D-1 still has its serial page.
 */

const root = process.cwd();
const outDir = path.join(root, "out");

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
  if (/^S\d+$/.test(token)) return [0, token.slice(1).padStart(6, "0")];
  if (/^\d{4}-\d{2}-\d{2}/.test(token)) return [1, token];
  return [2, token];
}

function compareTime(a, b) {
  const left = timeKey(a);
  const right = timeKey(b);
  if (left[0] !== right[0]) return left[0] - right[0];
  if (left[1] < right[1]) return -1;
  if (left[1] > right[1]) return 1;
  return 0;
}

function allDates(row) {
  return String(row.applies_to ?? "").trim().toLowerCase() === "all dates";
}

function overlaps(a, b) {
  if (allDates(a) || allDates(b)) return true;
  return a.date === b.date;
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

const failures = [];
function fail(message) {
  failures.push(message);
}

const packs = parseCsv(fs.readFileSync(path.join(root, "data/v2/packs.csv"), "utf8"));
const registry = parseCsv(fs.readFileSync(path.join(root, "data/v2/label_registry.csv"), "utf8"));
const serials = new Set(packs.map((pack) => pack.pack_uid).filter(Boolean));
const serialsLower = new Map([...serials].map((uid) => [uid.toLowerCase(), uid]));

const byLabel = new Map();
for (const row of registry) {
  const label = row.display_label;
  if (!label) {
    fail(`label_registry row for ${row.pack_uid} has no display_label`);
    continue;
  }
  if (!serials.has(row.pack_uid)) fail(`label_registry serial ${row.pack_uid} is not in packs.csv`);
  const list = byLabel.get(label) ?? [];
  list.push(row);
  byLabel.set(label, list);
}
for (const [label, rows] of byLabel) {
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      if (rows[i].pack_uid === rows[j].pack_uid) continue;
      if (!overlaps(rows[i], rows[j])) continue;
      const when = allDates(rows[i]) || allDates(rows[j]) ? "overlapping dates" : rows[i].date;
      fail(`${label} on ${when} resolves to ${rows[i].pack_uid} and ${rows[j].pack_uid}`);
    }
  }
}

const currentOwner = new Map();
for (const pack of packs) {
  const rows = registry.filter((row) => row.pack_uid === pack.pack_uid);
  const latest = rows.reduce((best, row) => (!best || compareTime(row.date, best.date) > 0 ? row : best), null);
  const label = latest ? latest.display_label : pack.label;
  const previous = currentOwner.get(label);
  if (previous && previous !== pack.pack_uid) {
    fail(`current slot ${label} resolves to ${previous} and ${pack.pack_uid}`);
  }
  currentOwner.set(label, pack.pack_uid);
}

const sourceRoots = ["app", "components", "lib"].map((dir) => path.join(root, dir));
const sourceHit = /["'`]\/(?:pack|slot)\//;
for (const dir of sourceRoots) {
  for (const file of walk(dir)) {
    if (!/\.(tsx|ts|mjs|md)$/.test(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    if (!sourceHit.test(text)) continue;
    const line = text.split("\n").findIndex((item) => sourceHit.test(item));
    fail(`${path.relative(root, file)}:${line + 1} links to /pack or /slot instead of a /batteries serial or slot path`);
  }
}

if (!fs.existsSync(outDir)) fail("missing out/");
else {
  for (const file of walk(outDir).filter((item) => item.endsWith(".html"))) {
    const html = fs.readFileSync(file, "utf8");
    const rel = path.relative(root, file);
    for (const match of html.matchAll(/href="([^"]+)"/g)) {
      const href = match[1];
      if (href.startsWith("/pack/") || href.startsWith("/slot/")) {
        fail(`${rel} still links to ${href}`);
        continue;
      }
      const packHref = href.match(/^\/batteries\/pack\/([^/?#]+)\/?$/);
      if (!packHref) continue;
      const token = decodeURIComponent(packHref[1]);
      if (!serialsLower.has(token.toLowerCase())) fail(`${rel} pack link ${href} is not a known serial`);
    }
  }
  for (const uid of serials) {
    const page = path.join(outDir, "batteries", "pack", uid, "index.html");
    if (!fs.existsSync(page)) fail(`missing serial page for ${uid}`);
  }
  const hidden = registry.find((row) =>
    row.hidden_labels.split("|").some((label) => label.trim() === "D-1"),
  );
  if (!hidden) fail("label_registry has no D-1 hidden label, so its serial page cannot be checked");
  else {
    const page = path.join(outDir, "batteries", "pack", hidden.pack_uid, "index.html");
    const html = fs.existsSync(page) ? fs.readFileSync(page, "utf8") : "";
    if (!html.includes(hidden.pack_uid) || !html.includes(hidden.display_label)) {
      fail(`D-1 serial page ${hidden.pack_uid} does not render ${hidden.display_label}`);
    }
  }
}

const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
if (vercel.trailingSlash === true) {
  fail("trailingSlash:true redirects /pack/:serial to /pack/:serial/ before the serial rule, so the printed QR is two hops");
}
const rules = vercel.redirects ?? [];
const slotRules = rules.filter(
  (rule) => rule.source.startsWith("/slot/") || rule.source === "/slot" || String(rule.destination).startsWith("/slot/"),
);
if (slotRules.length) fail(`/slot redirects still present (${slotRules.length})`);
const packRules = rules.filter((rule) => rule.source.startsWith("/pack/") || rule.source === "/pack");
const oneHop =
  packRules.length === 2 &&
  packRules.every((rule) => rule.destination === "/batteries/pack/:serial/" && rule.permanent === true) &&
  new Set(packRules.map((rule) => rule.source)).size === 2 &&
  packRules.some((rule) => rule.source === "/pack/:serial") &&
  packRules.some((rule) => rule.source === "/pack/:serial/");
if (!oneHop) fail(`/pack/:serial is not a single hop to /batteries/pack/:serial/ (${JSON.stringify(packRules)})`);

if (failures.length) {
  console.error(`pack-link check failed (${failures.length})`);
  for (const message of failures.slice(0, 40)) console.error(message);
  process.exit(1);
}

console.log(
  `pack-link check passed (${serials.size} serials, ${byLabel.size} registry labels, one serial per label/date, /slot redirects 0)`,
);
