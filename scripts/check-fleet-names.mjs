import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "out");

/**
 * Rendered pages. Historical store rows may still say the old label.
 * Nothing that reaches a page may.
 */
const hidden =
  /\bD-1\b|\bD1\b|\bD[ -]pool\b|\bDubious\b|\bseries D\b/i;

function decode(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name.endsWith(".html")) files.push(full);
  }
  return files;
}

function visibleText(html) {
  const attrs = [...html.matchAll(/\b(?:title|aria-label|alt)="([^"]*)"/gi)].map((match) => match[1]);
  const body = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ");
  return decode(`${body} ${attrs.join(" ")}`).replace(/\s+/g, " ");
}

function selfTest() {
  const clean = "C1-P1 passed its 7-day rest test and charges on the C1 board.";
  if (hidden.test(clean)) throw new Error("fleet-name check flagged C1-P1");
  for (const sample of ["D-1", "pack D1", "the D pool", "D-pool nights", "Dubious", "series D"]) {
    if (!hidden.test(sample)) throw new Error(`fleet-name check missed ${sample}`);
  }
}

selfTest();

if (!fs.existsSync(outDir)) {
  console.error("fleet-name check: missing out/");
  process.exit(1);
}

const home = path.join(outDir, "index.html");
const homeText = visibleText(fs.readFileSync(home, "utf8"));
if (!/across 24 packs still in a slot/.test(homeText)) {
  console.error("fleet-name check: home does not count 24 packs still in a slot");
  process.exit(1);
}

const hits = [];
for (const file of walk(outDir)) {
  const html = decode(fs.readFileSync(file, "utf8"));
  for (const match of html.matchAll(new RegExp(hidden.source, "gi"))) {
    const at = match.index ?? 0;
    const window = html.slice(Math.max(0, at - 40), at + match[0].length + 40).replace(/\s+/g, " ");
    hits.push(`${path.relative(root, file)}: ${window}`);
  }
}

if (hits.length) {
  console.error(`fleet-name check failed (${hits.length}).`);
  for (const hit of hits.slice(0, 40)) console.error(hit);
  process.exit(1);
}

console.log("fleet-name check passed (24 packs; D-1, D1, D pool, Dubious, series D: 0)");
