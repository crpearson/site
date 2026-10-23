import fs from "node:fs";
import path from "node:path";

/**
 * Rendered /next-charge notes. Each check-before advisory and each per-cell
 * line is at most 30 words. The page has no cell-pair list: no "P1, P2 cell"
 * run, no "Cell N … mV from" chain, and no note that names three cells.
 */

const LIMIT = 30;
const root = process.cwd();
const pagePath = path.join(root, "out", "batteries", "next-charge", "index.html");

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

function plain(html) {
  return decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function wordCount(text) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.split(" ").length : 0;
}

function pairList(text) {
  if (/C\d-P\d,\s*C\d-P\d\s+cell\s+\d+/i.test(text)) return "pack-pair run";
  if (/\bCell\s+\d+\b[^.]{0,40}\bmV from\b/i.test(text)) return "Cell N mV-from chain";
  if ((text.match(/\bCell\s+\d+\b/g) || []).length >= 3) return "repeated Cell N";
  return null;
}

function sliceSection(html, id) {
  const at = html.indexOf(`id="${id}"`);
  if (at < 0) return null;
  const start = html.lastIndexOf("<section", at);
  const end = html.indexOf("</section>", at);
  if (start < 0 || end < 0) return null;
  return html.slice(start, end);
}

function noteItems(sectionHtml) {
  const items = [];
  for (const match of sectionHtml.matchAll(/<(p|li)\b[^>]*class="[^"]*\bnote\b[^"]*"[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const text = plain(match[2]);
    if (text) items.push(text);
  }
  return items;
}

function visibleBlocks(html) {
  const stripped = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ");
  const blocks = [];
  for (const match of stripped.matchAll(/<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const text = plain(match[2]);
    if (text) blocks.push(text);
  }
  return blocks;
}

function selfTest() {
  const short = "Charged full on 10-18 (about 4.20 V per cell). Storage-charge it before it goes back on the C1 board.";
  if (wordCount(short) > LIMIT) throw new Error("advisory word counter rejected the real C1-P4 line");
  if (wordCount("one two three") !== 3) throw new Error("word counter");
  const long = Array.from({ length: 31 }, (_, i) => `w${i}`).join(" ");
  if (wordCount(long) !== 31) throw new Error("word counter missed 31");
  if (!pairList("C3-P1, C3-P2 cell 6 195 mV")) throw new Error("missed a pack-pair run");
  if (!pairList("Cell 1 195 mV from C3-P2; Cell 2 194 mV from C3-P3.")) throw new Error("missed a Cell N chain");
  if (!pairList("Cell 1, Cell 2 and Cell 3 were apart")) throw new Error("missed repeated Cell N");
  if (pairList("Cell 6 started 128 mV below the other cells once.")) throw new Error("flagged a single cell mention");
  if (pairList("C3: all gaps come from C3-P1")) throw new Error("flagged the root-cause line");
}

selfTest();

if (!fs.existsSync(pagePath)) {
  console.error("advisory note check needs out/batteries/next-charge/index.html");
  process.exit(1);
}

const html = fs.readFileSync(pagePath, "utf8");
const failures = [];
const counted = [];

for (const id of ["advisory-heading", "cell-check-heading"]) {
  const section = sliceSection(html, id);
  if (!section) {
    failures.push(`missing #${id}`);
    continue;
  }
  const items = noteItems(section);
  if (items.length === 0) failures.push(`#${id} has no note items`);
  for (const item of items) {
    const count = wordCount(item);
    counted.push({ id, count, item });
    if (count > LIMIT) failures.push(`#${id} ${count} words: ${item}`);
    const kind = pairList(item);
    if (kind) failures.push(`#${id} ${kind}: ${item}`);
  }
}

for (const block of visibleBlocks(html)) {
  const kind = pairList(block);
  if (kind) failures.push(`${kind}: ${block.slice(0, 180)}`);
}

const max = counted.reduce((best, item) => Math.max(best, item.count), 0);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`advisory note check passed (${counted.length} items, max ${max} words, cell-pair lists 0)`);
for (const item of counted) console.log(`  ${item.count} ${item.item}`);
