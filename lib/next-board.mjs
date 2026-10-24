import fs from "node:fs";
import path from "node:path";
import { latestCalendarDate } from "./pacific-date.mjs";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") field += char;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((cells) => cells.some((cell) => cell.length));
  return body.map((cells) => Object.fromEntries(header.map((key, index) => [key, cells[index] ?? ""])));
}

function timeKey(token) {
  const rest = token.match(/^(\d{4}-\d{2}-\d{2})-restday0$/);
  if (rest) return [1, rest[1], 2];
  // A charge run is earlier the same calendar day than that day's storage night.
  const charge = token.match(/^(\d{4}-\d{2}-\d{2})-charge$/);
  if (charge) return [1, charge[1], -1];
  const eve = token.endsWith("-eve");
  const day = eve ? token.slice(0, -4) : token;
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) return [1, day, eve ? 1 : 0];
  const session = token.match(/^S(\d+)$/);
  if (session) return [0, session[1].padStart(6, "0"), 0];
  return [2, token, 0];
}

function compareTime(a, b) {
  const left = timeKey(a);
  const right = timeKey(b);
  if (left[0] !== right[0]) return left[0] - right[0];
  if (left[1] !== right[1]) return left[1] < right[1] ? -1 : 1;
  return left[2] - right[2];
}

function sessionOf(source, date) {
  const raw = source.match(/session=([^;]+)/)?.[1]?.trim() ?? "";
  const token = raw.split(/\s+/)[0] ?? "";
  if (/^\d{4}-\d{2}-\d{2}-(?:restday0|charge)$/.test(token)) return token;
  if (/^\d{4}-\d{2}-\d{2}(?:-eve)?$/.test(token) || /^S\d+$/.test(token)) return token;
  if (/^\d{4}-\d{2}-\d{2}(?:-eve|-restday0)?$/.test(date) || /^S\d+$/.test(date)) return date;
  return token || date;
}

function parallelHalf(status) {
  const match = status.match(/^PARALLEL\s+([\s\S]+?)\s+\|\s+SERVICE\s+([\s\S]+)$/i);
  return (match ? match[1] : status).trim();
}

function labelNumber(label) {
  const match = label.match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function read(name) {
  return parseCsv(fs.readFileSync(path.join(process.cwd(), "data/v2", name), "utf8"));
}

export function buildNextBoard() {
  const packs = read("packs.csv");
  const calls = read("status_calls.csv");
  const rests = read("rest_tests.csv").filter((row) => row.result.trim() !== "FILLED-SEE-DAY0-ROW");
  const latest = new Map();
  const grouped = new Map();
  calls.forEach((row, index) => {
    if (/^unchanged\b/i.test(row.status.trim())) return;
    const list = grouped.get(row.pack_uid) ?? [];
    list.push({
      status: row.status,
      label: row.label_at_time,
      session: sessionOf(row.source, row.date),
      date: row.date,
      index,
    });
    grouped.set(row.pack_uid, list);
  });
  for (const [uid, list] of grouped) {
    list.sort((a, b) => compareTime(a.session, b.session) || compareTime(a.date, b.date) || a.index - b.index);
    latest.set(uid, list[list.length - 1]);
  }

  const series = ["C1", "C2", "C3", "C4"].map((id) => ({
    series: id,
    labels: packs
      .filter((pack) => pack.series === id)
      .filter((pack) => pack.pool.trim() !== "Rest")
      .filter((pack) => pack.charge_mode === "parallel")
      .filter((pack) => {
        const call = latest.get(pack.pack_uid);
        const parallel = parallelHalf(call?.status ?? "").toUpperCase();
        if (parallel.includes("INDIVIDUAL-ONLY") || parallel.includes("REST POOL") || /\bOFF\b/.test(parallel)) {
          return false;
        }
        return true;
      })
      .map((pack) => pack.label)
      .sort((a, b) => labelNumber(a) - labelNumber(b) || a.localeCompare(b)),
  }));

  const resting = packs
    .filter((pack) => pack.pool.trim() === "Rest")
    .map((pack) => {
      const test = rests.find((row) => row.pack_uid === pack.pack_uid);
      return {
        label: pack.label,
        uid: pack.pack_uid,
        day0: test?.start_date || pack.pool_since,
        until: test?.due_date || "",
      };
    })
    .sort((a, b) => {
      const rank = (label) => (label.startsWith("D") ? 0 : label.startsWith("C1") ? 1 : 2);
      return rank(a.label) - rank(b.label) || labelNumber(a.label) - labelNumber(b.label);
    });

  const asOf = latestCalendarDate([
    ...calls.flatMap((row) => [row.date, sessionOf(row.source, row.date)]),
    ...read("ir_store_v4.public.csv").map((row) => row.session),
  ]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
    throw new Error(`next parallel as-of date is missing (got ${asOf || "nothing"})`);
  }

  return {
    as_of: asOf,
    note: "Each pack charges on its own, one at a time, on its home channel. Rules v7: a pack is pulled only for fire risk. A pack that fails a board check charges alone that night. Watch and performance notes are only notes. Series do not share a board.",
    series,
    resting,
  };
}
