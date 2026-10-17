import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const patterns = [/series board/i, /series-board/i, /series parallel/i, /series-parallel/i];
const textExt = new Set([
  ".html",
  ".txt",
  ".json",
  ".js",
  ".mjs",
  ".css",
  ".svg",
  ".xml",
  ".md",
  ".csv",
]);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (textExt.has(path.extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

const roots = ["out", "data", "content"].map((dir) => path.join(root, dir));
const missing = roots.filter((dir) => !fs.existsSync(dir));
if (missing.length) {
  console.error(`series-board check: missing ${missing.map((dir) => path.relative(root, dir)).join(", ")}`);
  process.exit(1);
}

const hits = [];
for (const dir of roots) {
  for (const file of walk(dir)) {
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      if (patterns.some((pattern) => pattern.test(line))) {
        hits.push(`${path.relative(root, file)}:${index + 1}: ${line.trim().slice(0, 180)}`);
      }
    });
  }
}

if (hits.length) {
  console.error(`series-board check failed (${hits.length} lines). Charging boards are parallel boards.`);
  for (const hit of hits) console.error(hit);
  process.exit(1);
}

console.log("series-board check passed");
