import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "out");

/**
 * A chart series is the paths that share data-series inside one svg.
 * Two or more recorded points must be joined by that many segments minus one.
 * A lone moveto is allowed only when the series has a single point.
 */
function pointKey(x, y) {
  return `${Number(x).toFixed(3)},${Number(y).toFixed(3)}`;
}

function segmentKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function xOf(key) {
  return Number(key.split(",")[0]);
}

function parsePath(d) {
  const points = [];
  const segments = [];
  let cursor = null;
  const re = /([ML])\s*(-?\d*\.?\d+)\s+(-?\d*\.?\d+)/g;
  for (const match of d.matchAll(re)) {
    const key = pointKey(match[2], match[3]);
    points.push(key);
    if (match[1] === "L" && cursor) segments.push(segmentKey(cursor, key));
    cursor = key;
  }
  return { points, segments };
}

function seriesInSvg(svg) {
  const groups = new Map();
  const re = /<path\b([^>]*)\/?>/gi;
  for (const match of svg.matchAll(re)) {
    const attrs = match[1];
    const d = attrs.match(/\bd="([^"]*)"/)?.[1] ?? "";
    const id = attrs.match(/\bdata-series="([^"]*)"/)?.[1] ?? "";
    if (!id) continue;
    const parsed = parsePath(d);
    const group = groups.get(id) ?? { points: [], segments: [] };
    group.points.push(...parsed.points);
    group.segments.push(...parsed.segments);
    groups.set(id, group);
  }
  return groups;
}

/** Returns a list of problems. Empty means the svg follows the line rule. */
export function auditSvg(svg, where = "fixture") {
  const problems = [];
  const visible = svg.replace(/<script\b[\s\S]*?<\/script>/gi, " ");
  if (visible.includes('class="miss-ring"')) problems.push(`${where}: hollow ring`);
  const spark = visible.match(/<svg\b[^>]*data-chart="sparkline"[^>]*>[\s\S]*?<\/svg>/gi) ?? [];
  for (const block of spark) {
    if (/<circle\b[^>]*\bfill="none"/.test(block)) problems.push(`${where}: hollow sparkline ring`);
  }
  const svgs = svg.match(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi) ?? [];
  for (const block of svgs) {
    const open = block.match(/^<svg\b[^>]*>/i)?.[0] ?? "";
    const chart = /class="[^"]*\bplot-svg\b/.test(open) || /data-chart="sparkline"/.test(open);
    if (!chart) continue;
    const name = open.match(/\bdata-chart="([^"]*)"/)?.[1] ?? "chart";
    for (const [id, group] of seriesInSvg(block)) {
      const unique = [...new Set(group.points)].sort((a, b) => xOf(a) - xOf(b) || a.localeCompare(b));
      if (unique.length < 2) continue;
      const have = new Set(group.segments);
      let joined = 0;
      for (let index = 1; index < unique.length; index += 1) {
        const key = segmentKey(unique[index - 1], unique[index]);
        if (have.has(key)) joined += 1;
        else problems.push(`${where}: ${name} / ${id} gap ${unique[index - 1]} → ${unique[index]}`);
      }
      if (joined !== unique.length - 1 || group.segments.length !== unique.length - 1) {
        problems.push(
          `${where}: ${name} / ${id} has ${unique.length} points and ${group.segments.length} segments`,
        );
      }
    }
  }
  return problems;
}

function selfTest() {
  const dots = `<svg class="plot-svg" data-chart="t"><path data-series="a" d="M1.000 2.000" /><path data-series="a" d="M3.000 4.000" /></svg>`;
  const broken = `<svg class="plot-svg" data-chart="t"><path data-series="a" d="M1.000 2.000 L2.000 3.000" /><path data-series="a" d="M4.000 5.000" /></svg>`;
  const solid = `<svg class="plot-svg" data-chart="t"><path data-series="a" d="M1.000 2.000 L2.000 3.000 L4.000 5.000" /></svg>`;
  const mixed = `<svg class="plot-svg" data-chart="t"><path data-series="a" d="M1.000 2.000 L2.000 3.000" /><path data-series="a" d="M2.000 3.000 L4.000 5.000" /></svg>`;
  const single = `<svg class="plot-svg" data-chart="t"><path data-series="a" d="M1.000 2.000" /></svg>`;
  const ring = `<svg class="plot-svg" data-chart="t"><path data-series="a" d="M1 2 L3 4" /><span class="miss-ring"></span></svg>`;
  const cases = [
    [dots, true, "dots-only"],
    [broken, true, "broken"],
    [solid, false, "solid"],
    [mixed, false, "mixed"],
    [single, false, "single"],
    [ring, true, "ring"],
  ];
  const failed = [];
  for (const [svg, shouldFail, name] of cases) {
    const problems = auditSvg(svg, name);
    if (shouldFail && problems.length === 0) failed.push(`${name} was accepted`);
    if (!shouldFail && problems.length > 0) failed.push(`${name} was rejected: ${problems.join("; ")}`);
  }
  if (failed.length) {
    console.error("chart-line self-test failed");
    for (const item of failed) console.error(item);
    process.exit(1);
  }
  console.log("chart-line self-test passed (dots-only and broken fixtures fail; solid, dotted, and one-point pass)");
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

selfTest();

if (!fs.existsSync(outDir)) {
  console.error("chart-line check: missing out/");
  process.exit(1);
}

const problems = [];
const rows = [];
let seriesCount = 0;
for (const file of walk(outDir)) {
  const html = fs.readFileSync(file, "utf8");
  const rel = path.relative(root, file);
  problems.push(...auditSvg(html, rel));
  if (!rel.startsWith("out/pack/") || !html.includes("plot-svg")) continue;
  const svgs = html.match(/<svg\b[^>]*class="[^"]*\bplot-svg\b[^>]*>[\s\S]*?<\/svg>/gi) ?? [];
  svgs.forEach((svg, chartIndex) => {
    const chart = svg.match(/\bdata-chart="([^"]*)"/)?.[1] ?? `chart ${chartIndex + 1}`;
    for (const [id, group] of seriesInSvg(svg)) {
      const points = new Set(group.points).size;
      const segments = group.segments.length;
      seriesCount += 1;
      rows.push({ rel, chart, id, points, segments });
    }
  });
}

const packRows = rows.filter((row) => /\/CNHL-/.test(row.rel));
console.log("pack chart audit (points vs segments)");
console.log("pack\tchart\tseries\tpoints\tsegments");
for (const row of packRows) {
  const pack = row.rel.split("/")[2];
  const chart = row.chart.replace(/\s+/g, " ").slice(0, 42);
  console.log(`${pack}\t${chart}\t${row.id}\t${row.points}\t${row.segments}`);
}
console.log(`pack series rows: ${packRows.length}`);

if (problems.length) {
  console.error(`chart-line check failed (${problems.length})`);
  for (const problem of problems.slice(0, 40)) console.error(problem);
  if (problems.length > 40) console.error(`… ${problems.length - 40} more`);
  process.exit(1);
}

console.log(`chart-line check passed (${rows.length} pack-page series, site svgs joined)`);
