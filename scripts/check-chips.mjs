import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "out");

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

/** Adjacent repeated words, or the service-field doubling the lamp used to shout. */
export function doubledWords(text) {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  for (let index = 1; index < words.length; index += 1) {
    if (words[index] === words[index - 1]) return words[index];
  }
  if (/\bservice\s+in\s+service\b/i.test(text)) return "service in service";
  if (/\bservice\s+service\b/i.test(text)) return "service service";
  return null;
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

function chipTexts(html) {
  const texts = [];
  const open = /<span\b([^>]*)>/gi;
  let match;
  while ((match = open.exec(html))) {
    const className = match[1].match(/\bclass="([^"]*)"/i)?.[1] ?? "";
    const tokens = className.split(/\s+/);
    if (!tokens.some((token) => token === "lamp" || token === "status-chip" || token === "badge")) continue;
    let depth = 1;
    const start = match.index + match[0].length;
    const tag = /<\/?span\b[^>]*>/gi;
    tag.lastIndex = start;
    let cursor = html.length;
    let close;
    while ((close = tag.exec(html))) {
      if (close[0].startsWith("</")) depth -= 1;
      else depth += 1;
      if (depth === 0) {
        cursor = close.index;
        break;
      }
    }
    const text = decode(html.slice(start, cursor).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    if (text) texts.push(text);
  }
  return texts;
}

function selfTest() {
  const bad = [
    "SERVICE IN SERVICE",
    "Service Service",
    "Parallel Go Go",
    "PARALLEL GO: ON THE C3 BOARD | SERVICE IN SERVICE",
  ];
  const good = [
    "Parallel Go: on the C3 board | In service",
    "Parallel Go: on the C1 board | In service (watch)",
    "Parallel Go: on the C1 board | Watch (self-discharge check RT-004-1)",
    "Go (watch)",
    "GO",
  ];
  for (const text of bad) {
    if (!doubledWords(text)) throw new Error(`chip check missed ${text}`);
  }
  for (const text of good) {
    if (doubledWords(text)) throw new Error(`chip check flagged ${text}`);
  }
}

selfTest();

if (!fs.existsSync(outDir)) {
  console.error("chip check: missing out/");
  process.exit(1);
}

const hits = [];
let chips = 0;
for (const file of walk(outDir)) {
  for (const text of chipTexts(fs.readFileSync(file, "utf8"))) {
    chips += 1;
    const doubled = doubledWords(text);
    if (!doubled) continue;
    hits.push(`${path.relative(root, file)}: ${doubled} in “${text}”`);
  }
}

if (hits.length) {
  console.error(`chip check failed (${hits.length} doubled chips).`);
  for (const hit of hits.slice(0, 40)) console.error(hit);
  process.exit(1);
}

console.log(`chip check passed (${chips} chips, 0 doubled)`);
