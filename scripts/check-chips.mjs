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

/** Field label still sitting in front of a tier. Display text drops that label. */
const serviceField = /\bSERVICE\s+(?:In\s+service|Watch|Pulled|Retire|In\s+rotation|New|D[ -]pool)\b/i;
const serviceInService = /\bservice\s+in\s+service\b/i;

function visibleAndLabels(html) {
  const attrs = [...html.matchAll(/\b(?:title|aria-label|aria-description|alt)="([^"]*)"/gi)].map(
    (match) => decode(match[1]),
  );
  const body = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ");
  return decode(`${body} ${attrs.join(" ")}`).replace(/\s+/g, " ");
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
    "Parallel Go | In service",
    "Parallel Go: on the C1 board | In service (watch)",
    "Parallel Go: on the C1 board | Watch (self-discharge check RT-004-1)",
    "Go (watch)",
    "GO",
    "service status",
    "Service is separate: In service, Watch, Pulled, or Retire.",
  ];
  for (const text of bad) {
    if (!doubledWords(text)) throw new Error(`chip check missed ${text}`);
  }
  if (!serviceInService.test("SERVICE IN SERVICE") || !serviceField.test("SERVICE IN SERVICE")) {
    throw new Error("page check missed SERVICE IN SERVICE");
  }
  for (const text of good) {
    if (doubledWords(text)) throw new Error(`chip check flagged ${text}`);
    if (serviceInService.test(text) || serviceField.test(text)) {
      throw new Error(`page check flagged ${text}`);
    }
  }
  const raw = [
    "PARALLEL GO | SERVICE In service",
    "PARALLEL GO: on the C1 board | SERVICE In service (watch)",
    "PARALLEL GO: on the C1 board | SERVICE Watch (self-discharge check RT-004-1)",
  ];
  for (const text of raw) {
    if (!serviceField.test(text)) throw new Error(`page check missed ${text}`);
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

const pageHits = [];
for (const file of walk(outDir)) {
  const text = visibleAndLabels(fs.readFileSync(file, "utf8"));
  const doubled = [...text.matchAll(new RegExp(serviceInService.source, "gi"))];
  const labeled = [...text.matchAll(new RegExp(serviceField.source, "gi"))];
  for (const match of doubled) {
    pageHits.push(`${path.relative(root, file)}: service in service at “${text.slice(Math.max(0, match.index - 24), match.index + match[0].length + 24)}”`);
  }
  for (const match of labeled) {
    pageHits.push(`${path.relative(root, file)}: SERVICE field at “${text.slice(Math.max(0, match.index - 24), match.index + match[0].length + 24)}”`);
  }
}

if (pageHits.length) {
  console.error(`status display check failed (${pageHits.length}).`);
  for (const hit of pageHits.slice(0, 40)) console.error(hit);
  process.exit(1);
}

console.log("status display check passed (service in service 0, SERVICE field label 0)");
