import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const redirects = [];
const seen = new Set();
function add(source, destination) {
  if (source === destination || seen.has(source)) return;
  seen.add(source);
  redirects.push({ source, destination, permanent: true });
}

// Printed serial QRs: one hop from /pack/<serial> to the canonical page.
// Label URLs and every /slot/* URL are not redirected.
add("/pack/:serial", "/batteries/pack/:serial/");
add("/pack/:serial/", "/batteries/pack/:serial/");

// Section pages moved under /batteries/.
for (const [source, destination] of [
  ["/next-charge", "/batteries/next-charge/"],
  ["/next-charge/", "/batteries/next-charge/"],
  ["/bakeoff", "/batteries/bakeoff/"],
  ["/bakeoff/", "/batteries/bakeoff/"],
  ["/methodology", "/batteries/methodology/"],
  ["/methodology/", "/batteries/methodology/"],
]) {
  add(source, destination);
}

const slotRedirects = redirects.filter(
  (rule) => rule.source.startsWith("/slot/") || rule.source === "/slot" || rule.destination.startsWith("/slot/"),
);
if (slotRedirects.length) {
  console.error(`write-redirects still emits ${slotRedirects.length} /slot redirects`);
  process.exit(1);
}
const packRedirects = redirects.filter((rule) => rule.source.startsWith("/pack/") || rule.source === "/pack");
const packOk =
  packRedirects.length === 2 &&
  packRedirects.every((rule) => rule.destination === "/batteries/pack/:serial/" && rule.permanent === true);
if (!packOk) {
  console.error("write-redirects pack rules must be the single /pack/:serial hop");
  console.error(JSON.stringify(packRedirects, null, 2));
  process.exit(1);
}

const file = path.join(root, "vercel.json");
// framework null selects the Other preset. outputDirectory must stay "out"
// (the Next preset would look at public/).
const config = {
  $schema: "https://openapi.vercel.sh/vercel.json",
  framework: null,
  buildCommand: "npm run build",
  outputDirectory: "out",
  trailingSlash: true,
  redirects,
};
const stale = redirects.filter(
  (rule) => /D-1/i.test(rule.source) || /D-1/i.test(rule.destination),
);
if (stale.length) {
  console.error(`write-redirects would emit ${stale.length} retired D-1 redirects`);
  process.exit(1);
}
fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
console.log(`wrote ${redirects.length} redirects to vercel.json`);
