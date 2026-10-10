import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

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
  console.log("pack grid overflow check skipped (no Chrome)");
  process.exit(0);
}
if (!existsSync(path.join(outDir, "index.html"))) {
  console.error("pack grid overflow check needs out/index.html");
  process.exit(1);
}

const types = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".json": "application/json",
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  let pathname = decodeURIComponent(url.pathname);
  let file = path.join(outDir, pathname);
  if (pathname.endsWith("/")) file = path.join(file, "index.html");
  if (!file.startsWith(outDir) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404);
    res.end("missing");
    return;
  }
  const ext = path.extname(file);
  res.writeHead(200, { "content-type": types[ext] ?? "application/octet-stream" });
  res.end(readFileSync(file));
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const require = createRequire(path.join(root, "package.json"));
const puppeteer = require("puppeteer-core");
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const failures = [];
for (const width of [1280, 390]) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector(".pack-grid .tile");
  const found = await page.evaluate(() => {
    const problems = [];
    const tiles = [...document.querySelectorAll(".pack-grid .tile")];
    if (tiles.length < 13) problems.push(`expected at least 13 pack cards, found ${tiles.length}`);
    for (const tile of tiles) {
      const box = tile.getBoundingClientRect();
      if (box.right > window.innerWidth + 1 || box.left < -1) {
        problems.push(`${tile.textContent?.slice(0, 40)} extends past the viewport`);
      }
      if (tile.scrollWidth > tile.clientWidth + 1) {
        problems.push(`${tile.textContent?.slice(0, 48)} content is wider than the card`);
      }
      for (const child of tile.querySelectorAll("*")) {
        const rect = child.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        if (rect.right > box.right + 2 || rect.left < box.left - 2 || rect.bottom > box.bottom + 2) {
          const label = child.className?.toString?.() || child.tagName;
          problems.push(`${label} overflows ${tile.querySelector(".tile-label")?.textContent ?? "a card"}`);
        }
      }
    }
    return problems;
  });
  for (const problem of found) failures.push(`${width}px: ${problem}`);
  await page.close();
}

await browser.close();
server.close();

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("pack grid overflow check passed at 1280 and 390");
