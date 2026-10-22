/**
 * Resolve `@/` and extensionless TypeScript imports so the optional snapshot
 * script can load lib/fleet.ts. Not used by the site build.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exts = [".ts", ".tsx", ".mjs", ".js", ".json"];

function withExtension(fileUrl) {
  const file = fileURLToPath(fileUrl);
  if (path.extname(file)) return fileUrl;
  for (const ext of exts) {
    if (fs.existsSync(file + ext)) return pathToFileURL(file + ext).href;
  }
  return fileUrl;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    specifier = withExtension(pathToFileURL(path.join(root, specifier.slice(2))).href);
  } else if (specifier.startsWith("file:")) {
    specifier = withExtension(specifier);
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".json")) {
    const data = fs.readFileSync(fileURLToPath(url), "utf8");
    return { format: "module", source: `export default ${data};\n`, shortCircuit: true };
  }
  return nextLoad(url, context);
}
