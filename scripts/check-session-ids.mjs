import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "out");
const pattern = /\bS\d{3}\b/g;

/**
 * Visible text that matches a session id for a reason that is not an id.
 * Empty: every hit is an internal session id and must not be public.
 */
const allowlist = [];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name.endsWith(".html")) files.push(full);
  }
  return files;
}

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

function visibleText(html) {
  const attrs = [...html.matchAll(/\b(?:title|aria-label|alt)="([^"]*)"/gi)].map((match) => match[1]);
  const body = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ");
  return decode(`${body} ${attrs.join(" ")}`);
}

if (!fs.existsSync(outDir)) {
  console.error("session-id check: missing out/");
  process.exit(1);
}

const hits = [];
for (const file of walk(outDir)) {
  const text = visibleText(fs.readFileSync(file, "utf8"));
  const found = text.match(pattern);
  if (!found) continue;
  const rel = path.relative(root, file);
  for (const id of found) {
    if (allowlist.some((item) => item.file === rel && item.id === id)) continue;
    hits.push(`${rel}: ${id}`);
  }
}

if (hits.length) {
  console.error(`session-id check failed (${hits.length} hits). Internal session ids must not be visible.`);
  for (const hit of hits.slice(0, 40)) console.error(hit);
  if (hits.length > 40) console.error(`… ${hits.length - 40} more`);
  process.exit(1);
}

console.log("session-id check passed (0, allowlist empty)");
