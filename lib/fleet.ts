import fs from "node:fs";
import path from "node:path";
import metaDoc from "@/data/meta.json";
import nextDoc from "@/data/v2/next.json";
import registryDoc from "@/data/pack-registry.json";
import sessionsDoc from "@/data/sessions.json";
import statusDoc from "@/data/status.json";
import { missBridges } from "@/lib/bridges";
import { packColor, seriesColor } from "@/lib/color";
import { parseCsv } from "@/lib/csv";
import { shortSession } from "@/lib/format";
import { lampTone, type LampTone } from "@/lib/lamp";
import type { Band, Category, ChartSeries, Guide } from "@/lib/types";

type Measurement = {
  session: string;
  label: string;
  uid: string;
  series: string;
  cells: number[];
  avg: number;
  spread: number;
  floor: number | null;
  imbalance: number | null;
  rest: number | null;
  chargeMode: string;
  note: string;
};

type PackRec = {
  uid: string;
  label: string;
  series: string;
  brand: string;
  model: string;
  cells: number;
  capacityMah: number;
  chargeMode: string;
  retired: string;
  purchaseDate: string;
  priceUsd: string;
  vendor: string;
  notes: string;
};

type PackEvent = {
  date: string;
  uid: string;
  event: string;
  from: string;
  to: string;
  reason: string;
};

type StatusCall = {
  date: string;
  uid: string;
  label: string;
  status: string;
  reason: string;
  source: string;
  session: string;
};

const dataDir = path.join(process.cwd(), "data");

function readCsv(relative: string): Record<string, string>[] {
  return parseCsv(fs.readFileSync(path.join(dataDir, relative), "utf8"));
}

function num(value: string): number | null {
  if (value == null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function timeKey(token: string): [number, string, number] {
  const eve = token.endsWith("-eve");
  const day = eve ? token.slice(0, -4) : token;
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) return [1, day, eve ? 1 : 0];
  const session = token.match(/^S(\d+)$/);
  if (session) return [0, session[1].padStart(6, "0"), 0];
  return [2, token, 0];
}

function compareTime(a: string, b: string): number {
  const left = timeKey(a);
  const right = timeKey(b);
  if (left[0] !== right[0]) return left[0] - right[0];
  if (left[1] !== right[1]) return left[1] < right[1] ? -1 : 1;
  return left[2] - right[2];
}

const packs: PackRec[] = readCsv("v2/packs.csv").map((row) => ({
  uid: row.pack_uid,
  label: row.label,
  series: row.series,
  brand: row.brand,
  model: row.model,
  cells: Number(row.cells),
  capacityMah: Number(row.capacity_mAh),
  chargeMode: row.charge_mode,
  retired: row.retired.trim(),
  purchaseDate: row.purchase_date.trim(),
  priceUsd: row.price_usd.trim(),
  vendor: row.vendor.trim(),
  notes: row.notes,
}));

const events: PackEvent[] = readCsv("v2/pack_events.csv").map((row) => ({
  date: row.date,
  uid: row.pack_uid,
  event: row.event,
  from: row.from_label,
  to: row.to_label,
  reason: row.reason,
}));

function sessionFromSource(source: string, date: string): string {
  const raw = source.match(/session=([^;]+)/)?.[1]?.trim() ?? "";
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2}(?:-eve)?)\b/);
  if (iso) return iso[1];
  const sid = raw.match(/^(S\d+)\b/);
  if (sid) return sid[1];
  if (/^\d{4}-\d{2}-\d{2}(?:-eve)?$/.test(date) || /^S\d+$/.test(date)) return date;
  return raw || date;
}

const calls: StatusCall[] = readCsv("v2/status_calls.csv").map((row) => ({
  date: row.date,
  uid: row.pack_uid,
  label: row.label_at_time,
  status: row.status,
  reason: row.reason,
  source: row.source,
  session: sessionFromSource(row.source, row.date),
}));

const storeRows = readCsv("store.csv");
const v2Rows = readCsv("v2/ir_store_v2.public.csv");
const storeByKey = new Map(storeRows.map((row) => [`${row.session}\t${row.pack}`, row]));

const measurements: Measurement[] = v2Rows.map((row) => {
  const store = storeByKey.get(`${row.session}\t${row.pack}`);
  return {
    session: row.session,
    label: row.label_at_time,
    uid: row.pack_uid,
    series: row.series_at_time,
    cells: [1, 2, 3, 4, 5, 6].map((index) => Number(row[`c${index}`])),
    avg: Number(row.avg),
    spread: Number(row.spread),
    floor: num(store?.start_floor_mV || row.start_floor_mV),
    imbalance: num(store?.start_imbalance_mV ?? ""),
    rest: num(store?.rest_V ?? ""),
    chargeMode: row.charge_mode_at_time,
    note: row.note,
  };
});

const sessionMeta = sessionsDoc.sessions as {
  id: string;
  partial: boolean;
}[];

const sessionOrder = metaDoc.sessions as string[];

function packByUid(uid: string): PackRec | undefined {
  return packs.find((pack) => pack.uid === uid);
}

function eventsFor(uid: string): PackEvent[] {
  return events.filter((event) => event.uid === uid).sort((a, b) => compareTime(a.date, b.date));
}

function labelAsOf(uid: string, session: string): string | null {
  let label: string | null = null;
  for (const event of eventsFor(uid)) {
    if (compareTime(event.date, session) > 0) break;
    if (event.to) label = event.to;
  }
  return label;
}

export function blank(value: string): string {
  return value.trim() ? value : "—";
}

export function movedEvent(uid: string): PackEvent | undefined {
  return eventsFor(uid).find((event) => event.event === "move");
}

export function isExcludedFromHeadline(uid: string): boolean {
  const pack = packByUid(uid);
  return Boolean(pack?.retired) || Boolean(movedEvent(uid));
}

export function badgeFor(uid: string): string | null {
  const pack = packByUid(uid);
  if (!pack) return null;
  if (pack.retired) return `Retired ${pack.retired}`;
  const move = movedEvent(uid);
  if (move) return `Moved to ${move.to} ${move.date}`;
  return null;
}

export function callsFor(uid: string): StatusCall[] {
  return calls
    .filter((call) => call.uid === uid)
    .sort((a, b) => compareTime(a.session, b.session) || compareTime(a.date, b.date));
}

export function latestCall(uid: string): StatusCall | undefined {
  const list = callsFor(uid);
  return list[list.length - 1];
}

function pointsFor(uid: string): Measurement[] {
  const order = new Map(sessionOrder.map((id, index) => [id, index]));
  return measurements
    .filter((row) => row.uid === uid)
    .sort((a, b) => (order.get(a.session) ?? 999) - (order.get(b.session) ?? 999));
}

const EXPECTED_LATEST: Record<string, string> = {
  "CNHL-2026-001": "D pool / no parallel",
  "CNHL-2026-002": "GO",
  "CNHL-2026-003": "CAUTION",
  "CNHL-2026-004": "CAUTION onboard",
  "CNHL-2026-005": "Watch",
  "CNHL-2026-006": "GO",
  "CNHL-2026-007": "GO",
  "CNHL-2026-008": "CAUTION floor EYE",
  "CNHL-2026-009": "GO",
  "CNHL-2026-010": "GO",
  "CNHL-2026-011": "GO",
  "CNHL-2026-012": "GO",
};

function assertStore() {
  if (measurements.length !== 156 || storeRows.length !== 156) {
    throw new Error(`Expected 156 measurements, got v2=${measurements.length} store=${storeRows.length}`);
  }
  const s413 = measurements.find((row) => row.uid === "CNHL-2026-001" && row.session === "S413");
  if (!s413 || s413.cells.join(",") !== "569,543,524,538,552,545") {
    throw new Error("CNHL-2026-001 S413 IR spot check failed");
  }
  const c2 = measurements.find((row) => row.label === "C2-P2" && row.session === "2026-09-30");
  if (!c2 || c2.cells[2] !== 514) {
    throw new Error("C2-P2 2026-09-30 Cell3 spot check failed");
  }
  for (const [uid, status] of Object.entries(EXPECTED_LATEST)) {
    const call = latestCall(uid);
    if (!call || call.status !== status) {
      throw new Error(`Latest status for ${uid} is ${call?.status ?? "missing"}`);
    }
  }
  if (packs.some((pack) => pack.label === "C1-P1")) {
    throw new Error("C1-P1 should be an empty slot");
  }
  if (labelAsOf("CNHL-2026-001", "2026-09-30") !== "C1-P1") {
    throw new Error("CNHL-2026-001 should still be C1-P1 on 2026-09-30");
  }
  if (labelAsOf("CNHL-2026-001", "2026-10-08") !== "D-1") {
    throw new Error("CNHL-2026-001 should be D-1 on 2026-10-08");
  }
}

assertStore();

export const siteMeta = {
  lastIngest: metaDoc.last_ingest,
  rowCount: metaDoc.row_count,
  sessionCount: metaDoc.session_count,
  source: metaDoc.data_source,
  ingestNote: metaDoc.ingest_note,
  sessions: metaDoc.sessions as string[],
  gaps: statusDoc.gaps as string[],
  metricsAvailable: metaDoc.metrics_available,
  metricsMissing: metaDoc.metrics_not_available,
  unassignedNote: metaDoc.unassigned_note,
};

export const thresholds = statusDoc.thresholds;
const spreadRule = thresholds.intra_pack_spread_mohm;
const restRule = thresholds.inter_pack_rest_delta_v;

export const ruleAGuides: Guide[] = [
  { y: spreadRule.go_lt, label: `Go < ${spreadRule.go_lt}`, color: "#3ddc97" },
  { y: spreadRule.pull_gte, label: `Pull ≥ ${spreadRule.pull_gte}`, color: "#ff5c7a" },
];

export const ruleABands: Band[] = [
  { from: spreadRule.caution_lo, to: spreadRule.caution_hi, color: "rgba(245, 185, 66, 0.18)" },
  { from: spreadRule.pull_gte, to: 1000, color: "rgba(255, 92, 122, 0.12)" },
];

export const ruleBGuides: Guide[] = [
  { y: restRule.go_lte, label: `Go ≤ ${restRule.go_lte.toFixed(2)}`, color: "#3ddc97" },
  { y: restRule.hard_stop_gt, label: `Hard stop > ${restRule.hard_stop_gt.toFixed(2)}`, color: "#ff5c7a" },
];

export const ruleBBands: Band[] = [
  { from: restRule.caution_lo, to: restRule.caution_hi, color: "rgba(196, 161, 255, 0.2)" },
  { from: restRule.hard_stop_gt, to: 100, color: "rgba(255, 92, 122, 0.12)" },
];

export const floorGuide: Guide[] = [
  { y: thresholds.floor_eye_mv, label: `${thresholds.floor_eye_mv} mV watch`, color: "#79b8ff" },
];

export const floorBands: Band[] = [
  { from: 0, to: thresholds.floor_eye_mv, color: "rgba(121, 184, 255, 0.1)" },
];

export const categories: Category[] = sessionMeta.map((session) => ({
  id: session.id,
  label: shortSession(session.id),
  partial: session.partial,
}));

/**
 * Span id while the pack is in service. Null before commission and from a
 * retirement date onward. Each move starts the next span, so a dotted join
 * stays inside one label and does not cross the move.
 */
function serviceSpans(uid: string): (string | null)[] {
  const pack = packByUid(uid);
  const list = eventsFor(uid);
  const commission = list.find((event) => event.event === "commission");
  const moves = list.filter((event) => event.event === "move");
  const retired = pack?.retired.trim() ?? "";
  return categories.map((category) => {
    if (!commission || compareTime(category.id, commission.date) < 0) return null;
    if (retired && compareTime(category.id, retired) >= 0) return null;
    let span = 0;
    for (const move of moves) {
      if (compareTime(category.id, move.date) >= 0) span += 1;
    }
    return String(span);
  });
}

function loggedNights(uid: string): boolean[] {
  const have = new Set(pointsFor(uid).map((row) => row.session));
  return categories.map((category) => have.has(category.id));
}

function lineMeta(uid: string): { service: (string | null)[]; logged: boolean[] } {
  return { service: serviceSpans(uid), logged: loggedNights(uid) };
}

function alignUid(uid: string, pick: (row: Measurement) => number | null): (number | null)[] {
  const map = new Map(pointsFor(uid).map((row) => [row.session, row]));
  return categories.map((category) => {
    const row = map.get(category.id);
    return row ? pick(row) : null;
  });
}

function padded(values: number[], ratio = 0.08): [number, number] {
  if (values.length === 0) return [0, 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return [min - span * ratio, max + span * ratio];
}

function nums(values: (number | null)[]): number[] {
  return values.filter((value): value is number => value != null);
}

const SERIES_ORDER = ["C1", "C2", "D", "C3", "C4"];

export function seriesIds(): string[] {
  const present = new Set(packs.map((pack) => pack.series));
  return [...present].sort((a, b) => {
    const ai = SERIES_ORDER.indexOf(a);
    const bi = SERIES_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

function labelNumber(label: string): number {
  const match = label.match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

export function slotLabels(): string[] {
  const labels = new Set<string>();
  for (const pack of packs) labels.add(pack.label);
  for (const event of events) {
    if (event.from) labels.add(event.from);
    if (event.to) labels.add(event.to);
  }
  for (const row of measurements) labels.add(row.label);
  return [...labels].sort((a, b) => a.localeCompare(b) || labelNumber(a) - labelNumber(b));
}

export function packUids(): string[] {
  return packs.map((pack) => pack.uid);
}

export function slotsForSeries(series: string): string[] {
  return slotLabels()
    .filter((label) => label === series || label.startsWith(`${series}-`))
    .sort((a, b) => labelNumber(a) - labelNumber(b) || a.localeCompare(b));
}

export type StatusRow = {
  uid: string;
  label: string;
  series: string;
  status: string;
  tone: LampTone;
  reason: string;
  callDate: string;
  session: string;
  latestSession: string;
  avg: number;
  spread: number;
  floor: number | null;
  imbalance: number | null;
  rest: number | null;
  cells: number[];
  color: string;
  avgSeries: (number | null)[];
  excluded: boolean;
  badge: string | null;
  chargeMode: string;
};

export function statusRows(): StatusRow[] {
  const ordered = [...packs].sort((a, b) => {
    const series = seriesIds().indexOf(a.series) - seriesIds().indexOf(b.series);
    if (series !== 0) return series;
    return labelNumber(a.label) - labelNumber(b.label);
  });
  return ordered.map((pack) => {
    const call = latestCall(pack.uid);
    const points = pointsFor(pack.uid);
    const latest = points[points.length - 1];
    if (!call || !latest) throw new Error(`Missing call or measurement for ${pack.uid}`);
    return {
      uid: pack.uid,
      label: pack.label,
      series: pack.series,
      status: call.status,
      tone: lampTone(call.status),
      reason: call.reason,
      callDate: call.date,
      session: call.session,
      latestSession: latest.session,
      avg: latest.avg,
      spread: latest.spread,
      floor: latest.floor,
      imbalance: latest.imbalance,
      rest: latest.rest,
      cells: latest.cells,
      color: packColor(pack.label),
      avgSeries: alignUid(pack.uid, (row) => row.avg),
      excluded: isExcludedFromHeadline(pack.uid),
      badge: badgeFor(pack.uid),
      chargeMode: pack.chargeMode,
    };
  });
}

export function headline() {
  const rows = statusRows().filter((row) => !row.excluded);
  const mean = rows.reduce((sum, row) => sum + row.avg, 0) / rows.length;
  return {
    ok: rows.filter((row) => row.tone === "ok"),
    caution: rows.filter((row) => row.tone === "caution"),
    off: rows.filter((row) => row.tone === "off"),
    pool: statusRows().filter((row) => row.tone === "pool"),
    mean,
    counted: rows.length,
  };
}

export type SlotTile = {
  label: string;
  empty: boolean;
  uid: string | null;
  status: string | null;
  tone: LampTone | null;
  avg: number | null;
  spread: number | null;
  floor: number | null;
  avgSeries: (number | null)[];
  service?: (string | null)[];
  logged?: boolean[];
  color: string;
  badge: string | null;
  excluded: boolean;
};

export type SeriesBlock = {
  id: string;
  asOf: string;
  lastMeasured: string;
  individual: boolean;
  slots: SlotTile[];
};

function lastMeasured(series: string): string {
  const rows = measurements.filter((row) => row.series === series);
  if (rows.length === 0) return "no storage rows in this series yet";
  return rows.reduce((latest, row) => (compareTime(row.session, latest) > 0 ? row.session : latest), rows[0].session);
}

function asOf(series: string): string {
  const members = packs.filter((pack) => pack.series === series);
  const dates = members
    .map((pack) => latestCall(pack.uid)?.session)
    .filter((value): value is string => Boolean(value));
  if (dates.length === 0) return "—";
  return dates.reduce((latest, value) => (compareTime(value, latest) > 0 ? value : latest));
}

export function seriesBlocks(): SeriesBlock[] {
  const rows = statusRows();
  return seriesIds().map((series) => {
    const members = packs.filter((pack) => pack.series === series);
    const individual = members.length > 0 && members.every((pack) => pack.chargeMode === "individual");
    const slots = slotsForSeries(series).map((label) => {
      const pack = packs.find((item) => item.label === label);
      const row = pack ? rows.find((item) => item.uid === pack.uid) : undefined;
      const meta = pack ? lineMeta(pack.uid) : null;
      return {
        label,
        empty: !pack,
        uid: pack?.uid ?? null,
        status: row?.status ?? null,
        tone: row?.tone ?? null,
        avg: row?.avg ?? null,
        spread: row?.spread ?? null,
        floor: row?.floor ?? null,
        avgSeries: pack ? alignUid(pack.uid, (point) => point.avg) : [],
        service: meta?.service,
        logged: meta?.logged,
        color: packColor(label),
        badge: pack ? badgeFor(pack.uid) : null,
        excluded: pack ? isExcludedFromHeadline(pack.uid) : false,
      };
    });
    return {
      id: series,
      asOf: asOf(series),
      lastMeasured: lastMeasured(series),
      individual: individual || series === "D",
      slots,
    };
  });
}

export function restDelta(session: string, series: string): number | null {
  const rows = measurements.filter(
    (row) =>
      row.session === session &&
      row.series === series &&
      row.chargeMode === "parallel" &&
      row.rest != null,
  );
  if (rows.length < 2) return null;
  const rests = rows.map((row) => row.rest as number);
  return Math.round((Math.max(...rests) - Math.min(...rests)) * 1000) / 1000;
}

/**
 * Rest-Δ for one series-night. No rows means the series did not run. Rows
 * without two parallel rests means the series ran and Rule B is N/A.
 */
export function restNight(session: string, series: string): { value: number | null; na: boolean } {
  const ran = measurements.some((row) => row.session === session && row.series === series);
  const value = restDelta(session, series);
  if (!ran) return { value: null, na: false };
  if (value == null) return { value: null, na: true };
  return { value, na: false };
}

export type PackSeries = {
  id: string;
  uid: string;
  color: string;
  tone: LampTone;
  avg: (number | null)[];
  spread: (number | null)[];
  floor: (number | null)[];
  cells: (number | null)[][];
  service: (string | null)[];
  logged: boolean[];
};

export type FleetModel = {
  categories: Category[];
  irDomain: [number, number];
  meanDomain: [number, number];
  spreadDomain: [number, number];
  floorDomain: [number, number];
  restDomain: [number, number];
  mean: { id: string; color: string; values: (number | null)[] }[];
  fleets: {
    id: string;
    packs: PackSeries[];
    rest: (number | null)[];
    restNa: boolean[];
    individual: boolean;
  }[];
};

function seriesPacks(series: string): PackSeries[] {
  const uids = [...new Set(measurements.filter((row) => row.series === series).map((row) => row.uid))];
  return uids.map((uid) => {
    const pack = packByUid(uid);
    const call = latestCall(uid);
    const meta = lineMeta(uid);
    const label =
      pack && pack.series !== series ? `${pack.label} (was ${series})` : (pack?.label ?? uid);
    return {
      id: label,
      uid,
      color: packColor(pack?.label ?? uid),
      tone: call ? lampTone(call.status) : "pool",
      avg: alignUid(uid, (row) => row.avg),
      spread: alignUid(uid, (row) => row.spread),
      floor: alignUid(uid, (row) => row.floor),
      cells: [0, 1, 2, 3, 4, 5].map((index) => alignUid(uid, (row) => row.cells[index] ?? null)),
      service: meta.service,
      logged: meta.logged,
    };
  });
}

function fleetMean(packsInSeries: PackSeries[]): (number | null)[] {
  return categories.map((_, index) => {
    const values = packsInSeries
      .map((pack) => pack.avg[index])
      .filter((value): value is number => value != null);
    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  });
}

export function fleetModel(): FleetModel {
  const fleets = seriesIds().map((series) => {
    const members = packs.filter((pack) => pack.series === series);
    const nights = categories.map((category) => restNight(category.id, series));
    return {
      id: series,
      packs: seriesPacks(series),
      rest: nights.map((night) => night.value),
      restNa: nights.map((night) => night.na),
      individual: members.length > 0 && members.every((pack) => pack.chargeMode === "individual"),
    };
  });
  const measured = fleets.filter((fleet) => fleet.packs.length > 0);
  const allIr = measured.flatMap((fleet) => fleet.packs.flatMap((pack) => [...pack.avg, ...pack.cells.flat()]));
  const allSpread = measured.flatMap((fleet) => fleet.packs.flatMap((pack) => pack.spread));
  const allFloor = measured.flatMap((fleet) => fleet.packs.flatMap((pack) => pack.floor));
  const allRest = measured.flatMap((fleet) => fleet.rest);
  const meanValues = measured.flatMap((fleet) => fleetMean(fleet.packs));
  const restNums = nums(allRest);
  const restTop = restNums.length ? Math.max(...restNums) : 0.6;
  return {
    categories,
    irDomain: padded(nums(allIr), 0.06),
    meanDomain: padded(nums(meanValues), 0.14),
    spreadDomain: [0, Math.max(64, ...nums(allSpread))],
    floorDomain: padded([...nums(allFloor), thresholds.floor_eye_mv], 0.12),
    restDomain: [0, Math.max(0.8, restTop * 1.12)],
    mean: measured.map((fleet) => ({
      id: fleet.id,
      color: seriesColor(fleet.id),
      values: fleetMean(fleet.packs),
    })),
    fleets,
  };
}

export function seriesOf(rows: PackSeries[], pick: "avg" | "spread" | "floor"): ChartSeries[] {
  return rows.map((row) => ({
    id: row.uid,
    label: row.id,
    color: row.color,
    values: row[pick],
    service: row.service,
    logged: row.logged,
  }));
}

export type Occupancy = {
  uid: string;
  start: string;
  end: string | null;
};

export function occupancy(label: string): Occupancy[] {
  const ranges: Occupancy[] = [];
  for (const pack of packs) {
    let current: string | null = null;
    let since: string | null = null;
    for (const event of eventsFor(pack.uid)) {
      if (current === label && event.to && event.to !== label) {
        ranges.push({ uid: pack.uid, start: since ?? event.date, end: event.date });
      }
      if (event.to === label && current !== label) since = event.date;
      if (event.to) current = event.to;
    }
    if (current === label && since) ranges.push({ uid: pack.uid, start: since, end: null });
  }
  return ranges.sort((a, b) => compareTime(a.start, b.start));
}

export function lineage(uid: string): string | null {
  const move = movedEvent(uid);
  if (!move?.from) return null;
  return `was ${move.from} until ${move.date}`;
}

export type PackNight =
  | { session: string; partial: boolean; kind: "measured"; point: Measurement }
  | { session: string; partial: boolean; kind: "not-charged"; label: string; bridged: boolean };

function packNights(uid: string): PackNight[] {
  const { service, logged } = lineMeta(uid);
  const points = pointsFor(uid);
  const bySession = new Map(points.map((point) => [point.session, point]));
  const values = categories.map((category) => bySession.get(category.id)?.avg ?? null);
  const nightIds = categories.map((category) => category.id);
  const bridged = new Set(
    missBridges({ id: uid, label: uid, color: "", values, service, logged }, nightIds).flatMap(
      (bridge) => bridge.nights,
    ),
  );
  const nights: PackNight[] = [];
  categories.forEach((category, index) => {
    const point = bySession.get(category.id);
    if (point) {
      nights.push({ session: category.id, partial: category.partial, kind: "measured", point });
      return;
    }
    if (service[index] == null) return;
    nights.push({
      session: category.id,
      partial: category.partial,
      kind: "not-charged",
      label: labelAsOf(uid, category.id) ?? "—",
      bridged: bridged.has(category.id),
    });
  });
  return nights;
}

export type PackView = {
  uid: string;
  label: string;
  series: string;
  chargeMode: string;
  brand: string;
  model: string;
  capacityMah: number;
  purchaseDate: string;
  priceUsd: string;
  vendor: string;
  notes: string;
  badge: string | null;
  lineage: string | null;
  excluded: boolean;
  ruleB: string | null;
  call: StatusCall;
  calls: StatusCall[];
  events: PackEvent[];
  nights: PackNight[];
  row: StatusRow;
  points: Measurement[];
  categories: Category[];
  cellSeries: ChartSeries[];
  spreadSeries: ChartSeries[];
  floorSeries: ChartSeries[];
  irDomain: [number, number];
  spreadDomain: [number, number];
  floorDomain: [number, number];
};

export function getPack(uid: string): PackView | null {
  const pack = packByUid(uid);
  const call = latestCall(uid);
  const row = statusRows().find((item) => item.uid === uid);
  if (!pack || !call || !row) return null;
  const points = pointsFor(uid);
  const meta = lineMeta(uid);
  const cells = points.flatMap((point) => point.cells);
  const spreads = points.map((point) => point.spread);
  const floors = points.map((point) => point.floor).filter((value): value is number => value != null);
  const individual = pack.chargeMode !== "parallel";
  return {
    uid,
    label: pack.label,
    series: pack.series,
    chargeMode: pack.chargeMode,
    brand: pack.brand,
    model: pack.model,
    capacityMah: pack.capacityMah,
    purchaseDate: blank(pack.purchaseDate),
    priceUsd: blank(pack.priceUsd),
    vendor: blank(pack.vendor),
    notes: pack.notes,
    badge: badgeFor(uid),
    lineage: lineage(uid),
    excluded: isExcludedFromHeadline(uid),
    ruleB: individual ? "N/A, charged individually" : null,
    call,
    calls: callsFor(uid),
    events: eventsFor(uid),
    nights: packNights(uid),
    row,
    points,
    categories,
    cellSeries: [0, 1, 2, 3, 4, 5].map((index) => ({
      id: `c${index + 1}`,
      label: `Cell ${index + 1}`,
      color: packColor(`P${index + 1}`),
      values: alignUid(uid, (point) => point.cells[index] ?? null),
      service: meta.service,
      logged: meta.logged,
    })),
    spreadSeries: [
      {
        id: uid,
        label: pack.label,
        color: packColor(pack.label),
        values: alignUid(uid, (point) => point.spread),
        service: meta.service,
        logged: meta.logged,
      },
    ],
    floorSeries: [
      {
        id: "floor",
        label: "Start floor",
        color: "#79b8ff",
        values: alignUid(uid, (point) => point.floor),
        service: meta.service,
        logged: meta.logged,
      },
    ],
    irDomain: padded(cells, 0.1),
    spreadDomain: [0, Math.max(64, ...spreads)],
    floorDomain: padded([...floors, thresholds.floor_eye_mv], 0.15),
  };
}

export type Vacation = {
  date: string;
  to: string;
  uid: string;
};

export function vacationFrom(label: string): Vacation | null {
  const move = events.find((event) => event.event === "move" && event.from === label && event.to);
  if (!move?.to) return null;
  return { date: move.date, to: move.to, uid: move.uid };
}

export type SlotView = {
  label: string;
  series: string;
  current: PackRec | null;
  past: Occupancy[];
  lineage: string | null;
  vacated: Vacation | null;
};

export function getSlot(label: string): SlotView | null {
  if (!slotLabels().includes(label)) return null;
  const current = packs.find((pack) => pack.label === label) ?? null;
  const past = occupancy(label).filter((range) => range.end || range.uid !== current?.uid);
  const move = events.find((event) => event.to === label && event.event === "move");
  return {
    label,
    series: label.split("-")[0],
    current,
    past,
    lineage: move?.from ? `was ${move.from} until ${move.date}` : null,
    vacated: current ? null : vacationFrom(label),
  };
}

export type PackRoute =
  | { type: "pack"; uid: string; alias: boolean }
  | { type: "slot"; label: string; alias: boolean };

export function resolvePackRoute(id: string): PackRoute | null {
  const uid = packUids().find((item) => item.toLowerCase() === id.toLowerCase());
  if (uid) return { type: "pack", uid, alias: uid !== id };
  const label = slotLabels().find((item) => item.toLowerCase() === id.toLowerCase());
  if (label) return { type: "slot", label, alias: label !== id };
  return null;
}

export function packRouteIds(): string[] {
  const ids = new Set<string>();
  for (const uid of packUids()) {
    ids.add(uid);
    ids.add(uid.toLowerCase());
  }
  for (const label of slotLabels()) {
    ids.add(label);
    ids.add(label.toLowerCase());
  }
  return [...ids];
}

export type BrandCard = {
  id: string;
  brand: string;
  series: string;
  cells: number;
  capacityMah: number;
  chemistry: string;
  connector: string;
  pricePack: number;
  priceAh: number;
  priceChecked: string;
  priceSource: string;
  priceNote?: string;
  ownedFleets: string[];
};

export function brandCards(): BrandCard[] {
  return registryDoc.brands.map((brand) => ({
    id: brand.id,
    brand: brand.brand,
    series: brand.series,
    cells: brand.cells,
    capacityMah: brand.capacity_mah,
    chemistry: brand.chemistry,
    connector: brand.connector,
    pricePack: brand.price_usd_per_pack,
    priceAh: brand.price_usd_per_ah,
    priceChecked: brand.price_checked,
    priceSource: brand.price_source,
    priceNote: "price_note" in brand ? brand.price_note : undefined,
    ownedFleets: [...brand.owned_fleets],
  }));
}

export type ChargerInfo = {
  id: string;
  fleet: string;
  model: string;
  fw?: string;
  hw?: string;
  fleetLock: boolean;
  note?: string;
};

export function chargers(): ChargerInfo[] {
  const table = registryDoc.chargers as Record<
    string,
    {
      fleet: string;
      model: string;
      fw?: string;
      hw?: string;
      fleet_lock: boolean;
      note?: string;
    }
  >;
  return Object.entries(table).map(([id, charger]) => ({
    id,
    fleet: charger.fleet,
    model: charger.model,
    fw: charger.fw,
    hw: charger.hw,
    fleetLock: charger.fleet_lock,
    note: charger.note,
  }));
}

export function nextParallel() {
  return nextDoc;
}

export function ruleABand(spread: number): "Go" | "Caution" | "Pull" {
  if (spread >= spreadRule.pull_gte) return "Pull";
  if (spread >= spreadRule.caution_lo) return "Caution";
  return "Go";
}

export const metricLabels: Record<string, string> = {
  per_cell_ir_mohm: "Per-cell IR (mΩ)",
  pack_avg_ir_mohm: "Pack-average IR (mΩ)",
  intra_pack_spread_mohm: "Intra-pack spread (mΩ)",
  start_floor_mV: "Start floor (mV)",
  arrival_imbalance_mv: "Arrival imbalance (mV)",
  rest_voltage_for_inter_pack_delta: "Rest voltage for inter-pack delta",
  capacity_in_mah: "Capacity in (mAh)",
  capacity_out_mah: "Capacity out (mAh)",
  cycle_count_from_dx8: "Cycle count from the DX8",
  cost_per_usable_cycle: "Cost per usable cycle",
};

export function ruleBNote(series: string): string | null {
  const block = seriesBlocks().find((item) => item.id === series);
  if (block?.individual) return "N/A, charged individually";
  return null;
}
