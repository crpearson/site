import { createServer } from "node:http";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Standing layout check. Serves out/ and opens every public page in Playwright
 * at 1280 and 390. Fails when the page scrolls sideways, when an element is
 * wider than its box, or when text draws outside a card. Containers marked
 * data-scroll-ok (wide tables and heatmaps) are allowed to scroll.
 *
 * .sr-only is skipped: Tailwind clips that text to a 1px box for screen
 * readers, so its scrollWidth is the hidden sentence, not a visible overflow.
 * Case-alias pages that only meta-refresh to the canonical URL are skipped;
 * the canonical page is checked.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "out");
const chromeCandidates = [
  process.env.CHROME_PATH,
  "/opt/google/chrome/chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);
const chrome = chromeCandidates.find((candidate) => existsSync(candidate));
if (!chrome) {
  console.log("overflow check skipped (no Chrome)");
  process.exit(0);
}
if (!existsSync(path.join(outDir, "index.html"))) {
  console.error("overflow check needs out/index.html");
  process.exit(1);
}

function pages(dir, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith("_") || entry.name === "404" || entry.name === "404.html") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) pages(full, found);
    else if (entry.name === "index.html") {
      const html = readFileSync(full, "utf8");
      if (/http-equiv="refresh"/i.test(html)) continue;
      const rel = path.relative(outDir, dir).split(path.sep).join("/");
      const route = `/${rel ? `${rel}/` : ""}`;
      if (route === "/" || /^\/(bakeoff|about|methodology|pack|slot)(\/|$)/.test(route)) found.push(route);
    }
  }
  return found;
}

const limit = Number(process.env.OVERFLOW_LIMIT || 0);
const routes = [...new Set(pages(outDir))].sort().slice(0, limit || undefined);
const types = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
};

const server = createServer((req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    let file = path.join(outDir, decodeURIComponent(url.pathname));
    if (url.pathname.endsWith("/")) file = path.join(file, "index.html");
    if (!file.startsWith(outDir) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404);
      res.end("missing");
      return;
    }
    res.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  } catch (error) {
    res.writeHead(500);
    res.end(error instanceof Error ? error.message : "error");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();

const { chromium } = await import("playwright-core");
let browser = await launchBrowser();

console.log(`checking ${routes.length} pages`);
const failures = [];

function deadline(ms) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
  });
}

async function launchBrowser() {
  return chromium.launch({
    executablePath: chrome,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
}

function measure() {
  const problems = [];
  const doc = document.documentElement;
  const pageWidth = Math.max(doc.scrollWidth, document.body?.scrollWidth ?? 0);
  if (pageWidth > doc.clientWidth + 1) {
    let culprit = "body";
    let worst = 0;
    for (const el of document.querySelectorAll("body *")) {
      if (el.closest("[data-scroll-ok], .sr-only")) continue;
      const rect = el.getBoundingClientRect();
      const over = Math.round(rect.right - doc.clientWidth);
      if (over > worst && rect.width > 1 && rect.height > 1) {
        worst = over;
        culprit = (el.getAttribute("class") || el.tagName).toString().slice(0, 80);
      }
    }
    problems.push(`page scrolls horizontally ${pageWidth}>${doc.clientWidth} (${culprit} +${worst}px)`);
  }
  const clips = new Set(["hidden", "clip", "auto", "scroll"]);
  const clippedRect = (el) => {
    const rect = el.getBoundingClientRect();
    let left = rect.left;
    let right = rect.right;
    let top = rect.top;
    let bottom = rect.bottom;
    let parent = el.parentElement;
    while (parent) {
      const style = getComputedStyle(parent);
      const box = parent.getBoundingClientRect();
      if (clips.has(style.overflowX)) {
        left = Math.max(left, box.left);
        right = Math.min(right, box.right);
      }
      if (clips.has(style.overflowY)) {
        top = Math.max(top, box.top);
        bottom = Math.min(bottom, box.bottom);
      }
      parent = parent.parentElement;
    }
    return { left, right, top, bottom, width: right - left, height: bottom - top };
  };
  for (const el of document.querySelectorAll("body *")) {
    if (el.closest("[data-scroll-ok], .sr-only")) continue;
    if (el.namespaceURI === "http://www.w3.org/2000/svg") continue;
    const sw = el.scrollWidth;
    const cw = el.clientWidth;
    if (!cw || sw <= cw + 1) continue;
    const name = (el.getAttribute("class") || el.tagName).toString().slice(0, 70);
    const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 48);
    problems.push(`${name} is ${sw}px in a ${cw}px box${text ? ` (${text})` : ""}`);
  }
  for (const card of document.querySelectorAll(".tile, .stat, .panel")) {
    if (card.closest("[data-scroll-ok]")) continue;
    const box = card.getBoundingClientRect();
    for (const child of card.querySelectorAll("*")) {
      if (child.closest("[data-scroll-ok], .sr-only")) continue;
      if (child.namespaceURI === "http://www.w3.org/2000/svg") continue;
      const raw = child.getBoundingClientRect();
      if (raw.width < 1 || raw.height < 1) continue;
      if (raw.right <= box.right + 2 && raw.left >= box.left - 2) continue;
      const rect = clippedRect(child);
      if (rect.width < 1 || rect.height < 1) continue;
      if (rect.right > box.right + 2 || rect.left < box.left - 2) {
        const name = (child.getAttribute("class") || child.tagName).toString().slice(0, 50);
        problems.push(`${name} draws past its card`);
        break;
      }
    }
  }
  return problems;
}

for (const width of [1280, 390]) {
  let context = await browser.newContext({
    viewport: { width, height: 900 },
    javaScriptEnabled: false,
  });
  let page = await context.newPage();
  for (const route of routes) {
    const url = `http://127.0.0.1:${port}${route}`;
    try {
      const response = await Promise.race([
        page.goto(url, { waitUntil: "domcontentloaded", timeout: 8000 }),
        deadline(10000),
      ]);
      if (!response || response.status() >= 400) {
        failures.push(`${width}px ${route} HTTP ${response?.status() ?? "none"}`);
        continue;
      }
      const found = await Promise.race([page.evaluate(measure), deadline(10000)]);
      const shown = found.slice(0, 8);
      for (const problem of shown) failures.push(`${width}px ${route} ${problem}`);
      if (found.length > shown.length) {
        failures.push(`${width}px ${route} +${found.length - shown.length} more`);
      }
    } catch (error) {
      failures.push(`${width}px ${route} check failed: ${error.message.split("\n")[0]}`);
      await context.close().catch(() => {});
      if (!browser.isConnected()) browser = await launchBrowser();
      context = await browser.newContext({
        viewport: { width, height: 900 },
        javaScriptEnabled: false,
      });
      page = await context.newPage();
    }
  }
  await context.close().catch(() => {});
}

await browser.close();
server.close();

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`overflow check passed for ${routes.length} pages at 1280 and 390`);
