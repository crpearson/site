import { spawnSync } from "node:child_process";
import { renameSync } from "node:fs";

// Next.js static export rejects a root middleware.js and does not run it.
// Hide the Vercel Routing Middleware file only while `next build` runs.
const src = "middleware.js";
const hidden = "middleware.js.__next_build";

renameSync(src, hidden);
let status = 1;
try {
  const result = spawnSync("npx", ["next", "build"], { stdio: "inherit" });
  status = result.status ?? 1;
} finally {
  renameSync(hidden, src);
}
process.exit(status);
