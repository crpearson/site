import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { figureHtml, parseProse, type ProseDoc } from "@/lib/prose";

/** Known build states. `flying` is a quad that still gets in the air. `dead-end` is history, not a template. */
export const BUILD_STATUSES = ["flying", "dead-end"] as const;

export type BuildStatus = (typeof BUILD_STATUSES)[number];

const STATUS_LABEL: Record<BuildStatus, string> = {
  flying: "Flying",
  "dead-end": "Dead end",
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type BuildEntry = {
  slug: string;
  title: string;
  date: string;
  updated: string | null;
  status: BuildStatus;
  statusLabel: string;
  size: string;
  iteration: number;
  line: string;
  summary: string;
  cover: string;
  coverAlt: string;
  coverWidth: number;
  coverHeight: number;
  source: string;
  cardNote: string | null;
  doc: ProseDoc;
};

function assertPublicCopy(text: string, where: string) {
  if (/grabcad\.com/i.test(text)) {
    throw new Error(`${where} must not link a GrabCAD profile`);
  }
  if (/clifford pearson|cliff\.pearson/i.test(text)) {
    throw new Error(`${where} must stay on the public name`);
  }
}

function field(data: Record<string, string>, key: string, file: string): string {
  const value = data[key]?.trim();
  if (!value) throw new Error(`${file} is missing front matter ${key}`);
  return value;
}

function parseFrontMatter(raw: string, file: string): { data: Record<string, string>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) throw new Error(`${file} is missing front matter`);
  const data: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const sep = trimmed.indexOf(":");
    if (sep === -1) throw new Error(`${file} has a bad front matter line`);
    const key = trimmed.slice(0, sep).trim();
    let value = trimmed.slice(sep + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }
  return { data, body: raw.slice(match[0].length) };
}

function jpegSize(buffer: Buffer): { width: number; height: number } {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) throw new Error("Build photo is not a JPEG");
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = buffer.readUInt16BE(offset + 2);
    offset += 2 + length;
  }
  throw new Error("Build photo is missing its size");
}

function statusOf(value: string, file: string): BuildStatus {
  if ((BUILD_STATUSES as readonly string[]).includes(value)) return value as BuildStatus;
  throw new Error(`${file} has an unknown status "${value}"`);
}

function plainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

/** History page. It must not grow back into a flying showcase. */
function assertDeadEnd(entry: BuildEntry) {
  if (entry.status !== "dead-end") throw new Error("Apex FETtec page must stay a dead end");
  if (entry.line !== "History / caution") throw new Error("Apex FETtec line must stay history");
  if (!/archival/i.test(entry.coverAlt) || !/not a recommended build/i.test(entry.coverAlt)) {
    throw new Error("Apex FETtec cover must be labeled archival");
  }
  const html = `${entry.doc.introHtml}\n${entry.doc.sections.map((section) => section.html).join("\n")}`;
  const text = plainText(html);
  const required = [
    "This is not a build to copy. It is not a viable Lost Penny Apex. It is history.",
    "design heartache",
    "SoloGood later stretched the thing another way for the DJI O4 Pro — about 4mm over original.",
    "Stupid changes. Myopic decision making.",
    "original ImpulseRC Apex Evo hole spacing and vertical dimensions",
    "I will drop models that follow SoloGood’s stretch.",
    "The attempt still does not fly right (likely micro desyncs from motor wires run under the ESC).",
    "Glow-in-the-dark TPU looks cool and is likely to crack on impact",
    "This page exists so the site does not pretend that path was a success.",
    "Not a signature Apex to buy parts for.",
    "Not iteration-1 of a flying line.",
    "Not advice to run SoloGood’s revised dims.",
    "Archival only — not a recommended build.",
  ];
  for (const phrase of required) {
    if (!text.includes(phrase)) throw new Error(`Apex dead end is missing: ${phrase}`);
  }
  if (!html.includes(`href="${entry.source}"`)) throw new Error("Apex dead end is missing the RotorBuilds link");
  const banned = ["Parts", "Parts I designed", "Bench gear", "Status (2026-11-01)"];
  for (const title of banned) {
    if (entry.doc.sections.some((section) => section.title === title)) {
      throw new Error(`Apex dead end must not include a ${title} section`);
    }
  }
  if (html.includes("<table")) throw new Error("Apex dead end must not include a parts or bench table");
  const photos = entry.doc.sections.find((section) => section.title === "Photos (archival)");
  const images = photos?.html.match(/<img\b/g) ?? [];
  if (!photos || images.length < 1 || images.length > 16) {
    throw new Error("Apex dead end gallery should stay a short archival set");
  }
  if (/Read the build/i.test(text)) throw new Error("Apex dead end must not use a flying build CTA");
}

function loadBuild(file: string): BuildEntry {
  const full = path.join(process.cwd(), "content/builds", file);
  const raw = readFileSync(full, "utf8");
  assertPublicCopy(raw, file);
  const { data, body } = parseFrontMatter(raw, file);
  const slug = field(data, "slug", file);
  if (!SLUG.test(slug) || file !== `${slug}.md`) throw new Error(`${file} slug does not match the filename`);
  const title = field(data, "title", file);
  const date = field(data, "date", file);
  const updated = data.updated?.trim() || null;
  if (!DATE.test(date) || (updated && !DATE.test(updated))) throw new Error(`${file} has a bad date`);
  const status = statusOf(field(data, "status", file), file);
  const size = field(data, "size", file);
  const iteration = Number(field(data, "iteration", file));
  if (!Number.isInteger(iteration) || iteration < 1) throw new Error(`${file} has a bad iteration`);
  const line = field(data, "line", file);
  const summary = field(data, "summary", file);
  const cover = field(data, "cover", file);
  const coverAlt = field(data, "coverAlt", file);
  const source = field(data, "source", file);
  const cardNote = data.cardNote?.trim() || null;
  if (cover !== `/images/builds/${slug}/cover.jpg`) throw new Error(`${file} cover path is wrong`);
  let sourceUrl: URL;
  try {
    sourceUrl = new URL(source);
  } catch {
    throw new Error(`${file} source is not a URL`);
  }
  if (sourceUrl.protocol !== "https:") throw new Error(`${file} source must be https`);
  if (status === "dead-end") {
    if (!/archival/i.test(coverAlt) || !/not a recommended build/i.test(coverAlt)) {
      throw new Error(`${file} cover must be labeled archival, not a recommended build`);
    }
    if (!cardNote) throw new Error(`${file} needs a card note that this is not a viable build`);
  }

  const photoDir = path.join(process.cwd(), "public/images/builds", slug);
  const coverPath = path.join(photoDir, "cover.jpg");
  if (!existsSync(coverPath)) throw new Error(`${file} is missing cover.jpg`);
  const coverSize = jpegSize(readFileSync(coverPath));
  const onDisk = new Set(
    readdirSync(photoDir).filter((name) => name.endsWith(".jpg") && name !== "cover.jpg"),
  );
  const used = new Set<string>();

  const doc = parseProse(body.trim(), {
    errorLabel: "Build",
    image({ file: imageFile, alt }) {
      if (!alt.trim()) throw new Error(`${file} image is missing alt text: ${imageFile}`);
      if (status === "dead-end" && (!/archival/i.test(alt) || !/not a recommended build/i.test(alt))) {
        throw new Error(`${file} photo must be labeled archival, not a recommended build: ${imageFile}`);
      }
      if (!/^\d{2}\.jpg$/.test(imageFile)) throw new Error(`${file} has an unexpected image name: ${imageFile}`);
      const abs = path.join(photoDir, imageFile);
      if (!existsSync(abs)) throw new Error(`${file} is missing ${imageFile}`);
      used.add(imageFile);
      const size = jpegSize(readFileSync(abs));
      return figureHtml(`/images/builds/${slug}/${imageFile}`, {
        alt,
        caption: alt,
        width: size.width,
        height: size.height,
        full: true,
      });
    },
  });

  if (doc.title !== title) throw new Error(`${file} title does not match the H1`);
  if (status === "dead-end") {
    if (!doc.sections.some((section) => section.title.toLowerCase().startsWith("photos"))) {
      throw new Error(`${file} is missing a Photos section`);
    }
  } else if (!doc.sections.some((section) => section.title.toLowerCase().startsWith("status"))) {
    throw new Error(`${file} is missing a Status section`);
  }
  const html = `${doc.introHtml}\n${doc.sections.map((section) => section.html).join("\n")}`;
  if (!html.includes(`href="${source}"`)) throw new Error(`${file} does not link its source`);
  assertPublicCopy(html, file);
  for (const name of onDisk) {
    if (!used.has(name)) throw new Error(`${file} never shows ${name}`);
  }
  for (const name of used) {
    if (!onDisk.has(name)) throw new Error(`${file} shows a photo that is not on disk: ${name}`);
  }

  const entry: BuildEntry = {
    slug,
    title,
    date,
    updated,
    status,
    statusLabel: STATUS_LABEL[status],
    size,
    iteration,
    line,
    summary,
    cover,
    coverAlt,
    coverWidth: coverSize.width,
    coverHeight: coverSize.height,
    source,
    cardNote,
    doc,
  };
  if (slug === "apex-evo-5-fettec") assertDeadEnd(entry);
  return entry;
}

function allBuilds(): BuildEntry[] {
  const dir = path.join(process.cwd(), "content/builds");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md") && name !== "index.md")
    .map((name) => loadBuild(name))
    .sort((a, b) => {
      const aKey = a.updated ?? a.date;
      const bKey = b.updated ?? b.date;
      if (aKey !== bKey) return aKey < bKey ? 1 : -1;
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return a.slug.localeCompare(b.slug);
    });
}

/** Flying (and any future non-history) builds for the card grid. Dead ends stay out. */
export function listBuilds(): BuildEntry[] {
  return allBuilds().filter((build) => build.status !== "dead-end");
}

/** Every build page, including dead ends. */
export function listBuildPages(): BuildEntry[] {
  return allBuilds();
}

export function getBuild(slug: string): BuildEntry | null {
  return allBuilds().find((build) => build.slug === slug) ?? null;
}
