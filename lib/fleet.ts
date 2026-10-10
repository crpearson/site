import fs from "node:fs";
import path from "node:path";
import metaDoc from "@/data/meta.json";
import registryDoc from "@/data/pack-registry.json";
import statusDoc from "@/data/status.json";
import { missBridges } from "@/lib/bridges";
import { packColor, seriesColor } from "@/lib/color";
import { parseCsv } from "@/lib/csv";
import { formatValue, shortSession } from "@/lib/format";
import { IR_STORE_IS_DX8_INTEGER, IR_UNIT, scaleStoredIr } from "@/lib/ir";
import { lampTone, splitCall, type LampTone } from "@/lib/lamp";
import { buildNextBoard } from "@/lib/next-board.mjs";
import { calendarDate } from "@/lib/pacific-date.mjs";
import { laryParallelBucket, parallelBucket } from "@/lib/parallel-rules.mjs";
import type { Band, Category, ChartSeries, Guide } from "@/lib/types";

type Measurement = {
  session: string;
  label: string;
  uid: string;
  series: string;
  cells: number[];
  avg: number;
  spread: number;
  sr: number | null;
  floor: number | null;
  floorCell: number | null;
  imbalance: number | null;
  rest: number | null;
  lowGap: number | null;
  starts: number[];
  chargeMode: string;
  sessionType: string;
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
  serviceStatus: string;
  parallelCall: string;
  chargeCount: number;
  pool: string;
  poolSince: string;
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
  order: number;
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
  const rest = token.match(/^(\d{4}-\d{2}-\d{2})-restday0$/);
  if (rest) return [1, rest[1], 2];
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
  serviceStatus: row.status,
  parallelCall: row.parallel_call,
  chargeCount: Number(row.charge_count),
  pool: row.pool.trim(),
  poolSince: row.pool_since.trim(),
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
  const token = raw.split(/\s+/)[0] ?? "";
  if (/^\d{4}-\d{2}-\d{2}-restday0$/.test(token)) return token;
  if (/^\d{4}-\d{2}-\d{2}(?:-eve)?$/.test(token)) return token;
  if (/^S\d+$/.test(token)) return token;
  if (/^\d{4}-\d{2}-\d{2}(?:-eve|-restday0)?$/.test(date) || /^S\d+$/.test(date)) return date;
  return token || date;
}

const calls: StatusCall[] = readCsv("v2/status_calls.csv").map((row, index) => ({
  date: row.date,
  uid: row.pack_uid,
  label: row.label_at_time,
  status: row.status,
  reason: row.reason,
  source: row.source,
  session: sessionFromSource(row.source, row.date),
  order: index,
}));

type RestTest = {
  id: string;
  uid: string;
  label: string;
  cell: string;
  start: string;
  due: string;
  result: string;
  note: string;
  readingDate: string;
};

const restTests: RestTest[] = readCsv("v2/rest_tests.csv")
  .filter((row) => row.result.trim() !== "FILLED-SEE-DAY0-ROW")
  .map((row) => ({
    id: row.test_id,
    uid: row.pack_uid,
    label: row.label,
    cell: row.suspect_cell,
    start: row.start_date,
    due: row.due_date,
    result: row.result.trim() || "pending",
    note: row.note,
    readingDate: row.reading_date.trim(),
  }));

const v4Rows = readCsv("v2/ir_store_v4.public.csv");

const measurements: Measurement[] = v4Rows.map((row) => ({
  session: row.session,
  label: row.label_at_time,
  uid: row.pack_uid,
  series: row.series_at_time,
  cells: [1, 2, 3, 4, 5, 6].map((index) => scaleStoredIr(Number(row[`c${index}_mOhm`]))),
  avg: scaleStoredIr(Number(row.avg_mOhm)),
  spread: scaleStoredIr(Number(row.spread_mOhm)),
  sr: num(row.pack_SR_mOhm),
  floor: num(row.floor_mV),
  floorCell: num(row.floor_cell),
  imbalance: num(row.imbalance_mV),
  rest: num(row.rest_V),
  lowGap: num(row.low_cell_gap_mV),
  starts: [1, 2, 3, 4, 5, 6].map((index) => Number(row[`start_c${index}_mV`])),
  chargeMode: row.charge_mode_at_time,
  sessionType: row.session_type,
  note: row.v4_note,
}));

/** One-off individual rest-test baselines. Not a fleet night for packs that did not run. */
const restBaselineSessions = new Set(
  measurements.filter((row) => row.sessionType === "rest-test-day0").map((row) => row.session),
);

const listedSessions = metaDoc.sessions as string[];
const sessionOrder = [
  ...listedSessions,
  ...[...new Set(measurements.map((row) => row.session))]
    .filter((id) => !listedSessions.includes(id))
    .sort((a, b) => compareTime(a, b)),
];

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
    .sort((a, b) => compareTime(a.session, b.session) || compareTime(a.date, b.date) || a.order - b.order);
}

/** A later factual measurement does not replace the parallel/service call. */
function countsAsStatus(call: StatusCall): boolean {
  return !/^unchanged\b/i.test(call.status.trim());
}

export function latestCall(uid: string): StatusCall | undefined {
  const list = callsFor(uid).filter(countsAsStatus);
  return list[list.length - 1];
}

function ruleHistory(uid: string): Measurement[] {
  return pointsFor(uid).filter((point) => point.sessionType !== "rest-test-day0");
}

function pointsFor(uid: string): Measurement[] {
  const order = new Map(sessionOrder.map((id, index) => [id, index]));
  return measurements
    .filter((row) => row.uid === uid)
    .sort((a, b) => (order.get(a.session) ?? 999) - (order.get(b.session) ?? 999));
}

/** Rest-test day-0 rows stay off the latest card, the means, and Rule B. */
function operationalPoints(uid: string): Measurement[] {
  return pointsFor(uid).filter((point) => point.sessionType !== "rest-test-day0");
}

function latestOperational(uid: string): Measurement | undefined {
  const points = operationalPoints(uid);
  return points[points.length - 1];
}

export function isRestPool(uid: string): boolean {
  return packByUid(uid)?.pool === "Rest";
}

function inRestPool(uid: string, session: string): boolean {
  let since: string | null = null;
  for (const event of eventsFor(uid)) {
    if (compareTime(event.date, session) > 0) break;
    if (event.event === "rest_pool_enter") since = event.date;
    if (event.event === "rest_pool_exit") since = null;
  }
  return since != null;
}

const EXPECTED_LATEST: Record<string, string> = {
  "CNHL-2026-001":
    "PARALLEL OFF (Rest pool) | SERVICE D pool (Watch); rest test RT-001-1, 7-day reading due 2026-10-16; not charged during test",
  "CNHL-2026-002": "PARALLEL GO | SERVICE In service",
  "CNHL-2026-003": "PARALLEL CAUTION; GO after one clean night | SERVICE In service",
  "CNHL-2026-004":
    "PARALLEL OFF (Rest pool) | SERVICE Watch; rest test RT-004-1, 7-day reading due 2026-10-16; not charged during test",
  "CNHL-2026-005": "PARALLEL CAUTION; charged INDIVIDUALLY until one clean night, then GO | SERVICE Watch",
  "CNHL-2026-006": "PARALLEL GO | SERVICE In service",
  "CNHL-2026-007": "PARALLEL GO | SERVICE Watch (IR spread)",
  "CNHL-2026-008":
    "PARALLEL OFF (Rest pool) | SERVICE Watch; rest test RT-008-1, 7-day reading due 2026-10-16; not charged during test",
  "CNHL-2026-009": "PARALLEL GO | SERVICE In service",
  "CNHL-2026-010": "PARALLEL GO | SERVICE In service",
  "CNHL-2026-011": "PARALLEL GO | SERVICE In service",
  "CNHL-2026-012": "PARALLEL GO | SERVICE In service",
};

function assertStore() {
  if (measurements.length !== 159 || v4Rows.length !== 159) {
    throw new Error(`Expected 159 measurements, got ${measurements.length}`);
  }
  if (IR_STORE_IS_DX8_INTEGER) {
    throw new Error("ir_store_v4 is already milliohms. IR_STORE_IS_DX8_INTEGER must stay false.");
  }
  const sample = measurements.find((row) => row.uid === "CNHL-2026-001" && row.session === "2026-10-09");
  if (!sample || sample.cells.map((cell) => cell.toFixed(1)).join(",") !== "3.2,2.9,2.5,2.2,3.0,2.8") {
    throw new Error("D-1 2026-10-09 IR spot check failed");
  }
  if (sample.avg.toFixed(3) !== "2.767" || sample.spread.toFixed(1) !== "1.0") {
    throw new Error("D-1 2026-10-09 average or spread spot check failed");
  }
  const restC2 = measurements.find((row) => row.uid === "CNHL-2026-008" && row.session === "2026-10-09-restday0");
  const restC1 = measurements.find((row) => row.uid === "CNHL-2026-004" && row.session === "2026-10-09-restday0");
  if (!restC2 || restC2.cells.map((cell) => cell.toFixed(1)).join(",") !== "3.3,2.3,3.9,3.4,3.1,2.8") {
    throw new Error("C2-P2 rest-day IR spot check failed");
  }
  if (!restC1 || restC1.cells.map((cell) => cell.toFixed(1)).join(",") !== "3.1,3.4,3.2,3.7,2.8,2.8") {
    throw new Error("C1-P4 rest-day IR spot check failed");
  }
  if (packByUid("CNHL-2026-004")?.chargeCount !== 14 || packByUid("CNHL-2026-008")?.chargeCount !== 14) {
    throw new Error("C1-P4 and C2-P2 charge_count should be 14");
  }
  if (restTests.some((test) => test.uid === "CNHL-2026-003") || restTests.length !== 3) {
    throw new Error("Rest tests should be the three day-0 rows, with no C1-P3 test");
  }
  for (const [uid, status] of Object.entries(EXPECTED_LATEST)) {
    const call = latestCall(uid);
    if (!call || call.status !== status) {
      throw new Error(`Latest status for ${uid} is ${call?.status ?? "missing"}`);
    }
    const pack = packByUid(uid);
    const computed = parallelBucket(
      ruleHistory(uid).map((point) => ({
        spread: point.spread,
        cells: point.cells,
        gap: point.lowGap ?? 0,
        floor: point.floor ?? 0,
        floorCell: point.floorCell ?? 0,
        starts: point.starts,
      })),
      {
        inDPool: pack?.series === "D" || /d pool/i.test(pack?.serviceStatus ?? ""),
        failedRest: restTests.some((test) => test.uid === uid && /fail/i.test(test.result)),
        selfDischargeWatch: /self-discharge/i.test(pack?.serviceStatus ?? ""),
      },
    );
    const recorded = laryParallelBucket(call.status);
    if (/REST POOL/i.test(call.status)) {
      console.log(`rest pool ${uid}: recorded OFF, not a parallel-call disagreement`);
    } else if (/OWNER OVERRIDE/i.test(call.reason)) {
      console.warn(
        `owner override ${uid}: recorded ${recorded}; computed ${computed.call}; not a disagreement. Low-cell gap stays on monitor. Cell 4 has no rest test.`,
      );
    } else if (computed.call !== recorded) {
      console.warn(`parallel call disagreement ${uid}: computed ${computed.call}, recorded ${recorded}`);
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

const loggedThrough =
  sessionOrder.reduce((latest, id) => {
    const day = calendarDate(id);
    return day > latest ? day : latest;
  }, "") || metaDoc.last_ingest;

export const siteMeta = {
  lastIngest: loggedThrough,
  rowCount: measurements.length,
  sessionCount: sessionOrder.length,
  source: metaDoc.data_source,
  ingestNote: metaDoc.ingest_note,
  sessions: metaDoc.sessions as string[],
  gaps: statusDoc.gaps as string[],
  metricsAvailable: metaDoc.metrics_available,
  metricsMissing: metaDoc.metrics_not_available,
  unassignedNote: metaDoc.unassigned_note,
};

export const thresholds = statusDoc.thresholds;
const spreadRule = thresholds.spread_mohm;
const restRule = thresholds.inter_pack_rest_delta_v;

export const ruleAGuides: Guide[] = [
  { y: spreadRule.caution_gte, label: `Caution ≥ ${formatValue("ir", spreadRule.caution_gte)} ${IR_UNIT}`, color: "#f5b942" },
  { y: spreadRule.individual_gte, label: `Individual ≥ ${formatValue("ir", spreadRule.individual_gte)} ${IR_UNIT}`, color: "#ff5c7a" },
];

export const ruleABands: Band[] = [
  { from: spreadRule.caution_gte, to: spreadRule.individual_gte, color: "rgba(245, 185, 66, 0.18)" },
  { from: spreadRule.individual_gte, to: Number.POSITIVE_INFINITY, color: "rgba(255, 92, 122, 0.12)" },
];

export const ruleBGuides: Guide[] = [
  { y: restRule.go_lte, label: `Go ≤ ${restRule.go_lte.toFixed(2)} V`, color: "#3ddc97" },
  { y: restRule.hard_stop_gt, label: `Hard stop > ${restRule.hard_stop_gt.toFixed(2)} V`, color: "#ff5c7a" },
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

const nightCount = new Map<string, number>();
for (const row of measurements) nightCount.set(row.session, (nightCount.get(row.session) ?? 0) + 1);

export const categories: Category[] = sessionOrder.map((id) => ({
  id,
  label: shortSession(id),
  partial: (nightCount.get(id) ?? 0) < 12,
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
    // A rest-test baseline is in span only for the packs that ran. Everyone else
    // is out of scope, so the night draws neither a join nor a ring.
    if (restBaselineSessions.has(category.id)) {
      const ran = measurements.some((row) => row.uid === uid && row.session === category.id);
      return ran ? String(span) : null;
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

function alignUid(
  uid: string,
  pick: (row: Measurement) => number | null,
  series?: string,
): (number | null)[] {
  const map = new Map(pointsFor(uid).map((row) => [row.session, row]));
  return categories.map((category) => {
    const row = map.get(category.id);
    if (!row || row.sessionType === "rest-test-day0") return null;
    if (series && row.series !== series) return null;
    return pick(row);
  });
}

function restFlags(uid: string): boolean[] {
  const map = new Map(pointsFor(uid).map((row) => [row.session, row]));
  return categories.map((category) => {
    if (!inRestPool(uid, category.id)) return false;
    const row = map.get(category.id);
    return !row || row.sessionType === "rest-test-day0";
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

function spreadChartDomain(spreads: number[]): [number, number] {
  const dataMax = Math.max(0, ...spreads);
  const top = Math.max(dataMax, spreadRule.individual_gte);
  return [0, Math.max(0.01, top + Math.max(top, 0.01) * 0.12)];
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
  chargeCount: number;
  sr: number | null;
  lowGap: number | null;
  parallel: string;
  service: string;
  restPool: boolean;
  restDay0: string | null;
  restDue: string | null;
};

export function statusRows(): StatusRow[] {
  const ordered = [...packs].sort((a, b) => {
    const series = seriesIds().indexOf(a.series) - seriesIds().indexOf(b.series);
    if (series !== 0) return series;
    return labelNumber(a.label) - labelNumber(b.label);
  });
  return ordered.map((pack) => {
    const call = latestCall(pack.uid);
    const latest = latestOperational(pack.uid);
    const restTest = restTests.find((test) => test.uid === pack.uid);
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
      chargeCount: pack.chargeCount,
      sr: latest.sr,
      lowGap: latest.lowGap,
      parallel: splitCall(call.status).parallel,
      service: splitCall(call.status).service,
      restPool: pack.pool === "Rest",
      restDay0: pack.pool === "Rest" ? restTest?.readingDate || restTest?.start || pack.poolSince : null,
      restDue: pack.pool === "Rest" ? restTest?.due || null : null,
    };
  });
}

export function restTestsFor(uid: string): RestTest[] {
  return restTests.filter((test) => test.uid === uid);
}

export function allRestTests(): RestTest[] {
  return restTests;
}

export function headline() {
  const slotted = statusRows().filter((row) => !row.excluded);
  const onBoards = slotted.filter((row) => !row.restPool);
  const mean = slotted.reduce((sum, row) => sum + row.avg, 0) / slotted.length;
  return {
    ok: onBoards.filter((row) => row.tone === "ok"),
    caution: onBoards.filter((row) => row.tone === "caution"),
    off: onBoards.filter((row) => row.tone === "off"),
    pool: statusRows().filter((row) => row.tone === "pool"),
    rest: statusRows().filter((row) => row.restPool),
    mean,
    counted: slotted.length,
  };
}

export function chargedIndividually(): string[] {
  return packs.filter((pack) => pack.chargeMode === "individual" && pack.pool !== "Rest").map((pack) => pack.label);
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
  rest?: boolean[];
  color: string;
  badge: string | null;
  excluded: boolean;
  sr: number | null;
  lowGap: number | null;
  latestSession: string | null;
  restPool: boolean;
  restDay0: string | null;
  restDue: string | null;
};

export type SeriesBlock = {
  id: string;
  asOf: string;
  lastMeasured: string;
  individual: boolean;
  slots: SlotTile[];
};

function lastMeasured(series: string): string {
  const rows = measurements.filter((row) => row.series === series && row.sessionType !== "rest-test-day0");
  if (rows.length === 0) return "no storage rows in this series yet";
  return rows.reduce((latest, row) => (compareTime(row.session, latest) > 0 ? row.session : latest), rows[0].session);
}

function asOf(series: string): string {
  const members = packs.filter((pack) => pack.series === series);
  const dates = members
    .map((pack) => latestCall(pack.uid)?.session)
    .filter((value): value is string => Boolean(value));
  if (dates.length === 0) return "—";
  const latest = dates.reduce((value, current) => (compareTime(current, value) > 0 ? current : value));
  return calendarDate(latest) || latest;
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
        rest: pack ? restFlags(pack.uid) : undefined,
        color: packColor(label),
        badge: pack ? badgeFor(pack.uid) : null,
        excluded: pack ? isExcludedFromHeadline(pack.uid) : false,
        sr: row?.sr ?? null,
        lowGap: row?.lowGap ?? null,
        latestSession: row?.latestSession ?? null,
        restPool: row?.restPool ?? false,
        restDay0: row?.restDay0 ?? null,
        restDue: row?.restDue ?? null,
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

function parallelBoardUids(): Set<string> {
  const labels = new Set(buildNextBoard().series.flatMap((board: { labels: string[] }) => board.labels));
  return new Set(packs.filter((pack) => labels.has(pack.label)).map((pack) => pack.uid));
}

export function restDelta(session: string, series: string): number | null {
  const board = parallelBoardUids();
  const rows = measurements.filter(
    (row) =>
      row.session === session &&
      row.series === series &&
      board.has(row.uid) &&
      row.sessionType !== "rest-test-day0" &&
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
  if (restBaselineSessions.has(session)) {
    // Day-0 rest rows are not a parallel charge and are not a Rule B night.
    return { value: null, na: false };
  }
  const board = parallelBoardUids();
  const ran = measurements.some(
    (row) =>
      row.session === session &&
      row.series === series &&
      board.has(row.uid) &&
      row.sessionType !== "rest-test-day0",
  );
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
  rest: boolean[];
};

export type FleetModel = {
  categories: Category[];
  irDomain: [number, number];
  meanDomain: [number, number];
  spreadDomain: [number, number];
  floorDomain: [number, number];
  restDomain: [number, number];
  mean: { id: string; color: string; values: (number | null)[]; service: (string | null)[] }[];
  fleets: {
    id: string;
    packs: PackSeries[];
    rest: (number | null)[];
    restNa: boolean[];
    restService: (string | null)[];
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
      avg: alignUid(uid, (row) => row.avg, series),
      spread: alignUid(uid, (row) => row.spread, series),
      floor: alignUid(uid, (row) => row.floor, series),
      cells: [0, 1, 2, 3, 4, 5].map((index) => alignUid(uid, (row) => row.cells[index] ?? null, series)),
      service: meta.service,
      logged: meta.logged,
      rest: restFlags(uid),
    };
  });
}

function fleetMean(packsInSeries: PackSeries[]): (number | null)[] {
  return categories.map((category, index) => {
    if (restBaselineSessions.has(category.id)) return null;
    const values = packsInSeries
      .map((pack) => pack.avg[index])
      .filter((value): value is number => value != null);
    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  });
}

function seriesScope(): (string | null)[] {
  return categories.map((category) => (restBaselineSessions.has(category.id) ? null : "0"));
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
      restService: categories.map((category) => (restBaselineSessions.has(category.id) ? null : "0")),
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
    spreadDomain: spreadChartDomain(nums(allSpread)),
    floorDomain: padded([...nums(allFloor), thresholds.floor_eye_mv], 0.12),
    restDomain: [0, Math.max(0.8, restTop * 1.12)],
    mean: measured.map((fleet) => ({
      id: fleet.id,
      color: seriesColor(fleet.id),
      values: fleetMean(fleet.packs),
      service: seriesScope(),
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
    rest: row.rest,
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
  | { session: string; partial: boolean; kind: "rest-pool"; label: string }
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
    if (point && point.sessionType !== "rest-test-day0") {
      nights.push({ session: category.id, partial: category.partial, kind: "measured", point });
      return;
    }
    if (inRestPool(uid, category.id)) {
      nights.push({
        session: category.id,
        partial: category.partial,
        kind: "rest-pool",
        label: labelAsOf(uid, category.id) ?? "—",
      });
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
  restDays: Measurement[];
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
  const points = operationalPoints(uid);
  const meta = lineMeta(uid);
  const rest = restFlags(uid);
  const cells = points.flatMap((point) => point.cells);
  const spreads = points.map((point) => point.spread);
  const floors = points.map((point) => point.floor).filter((value): value is number => value != null);
  const individual = pack.chargeMode !== "parallel";
  const resting = pack.pool === "Rest";
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
    ruleB: resting ? "Rest pool, not charged" : individual ? "N/A, charged individually" : null,
    call,
    calls: callsFor(uid),
    events: eventsFor(uid),
    nights: packNights(uid),
    row,
    points,
    restDays: pointsFor(uid).filter((point) => point.sessionType === "rest-test-day0"),
    categories,
    cellSeries: [0, 1, 2, 3, 4, 5].map((index) => ({
      id: `c${index + 1}`,
      label: `Cell ${index + 1}`,
      color: packColor(`P${index + 1}`),
      values: alignUid(uid, (point) => point.cells[index] ?? null),
      service: meta.service,
      logged: meta.logged,
      rest,
    })),
    spreadSeries: [
      {
        id: uid,
        label: pack.label,
        color: packColor(pack.label),
        values: alignUid(uid, (point) => point.spread),
        service: meta.service,
        logged: meta.logged,
        rest,
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
        rest,
      },
    ],
    irDomain: padded(cells, 0.1),
    spreadDomain: spreadChartDomain(spreads),
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
  return buildNextBoard() as {
    as_of: string;
    note: string;
    series: { series: string; labels: string[] }[];
    resting: { label: string; uid: string; day0: string; until: string }[];
  };
}

export function ruleABand(spread: number): "Go" | "Caution" | "Individual" {
  if (spread >= spreadRule.individual_gte) return "Individual";
  if (spread >= spreadRule.caution_gte) return "Caution";
  return "Go";
}

export const metricLabels: Record<string, string> = {
  per_cell_chg_mah: "Charge taken per cell (mAh)",
  pack_avg_chg_mah: "Average charge taken (mAh)",
  intra_pack_spread_chg_mah: "Charge spread (mAh)",
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

function assertDerived() {
  const stats = headline();
  if (stats.mean.toFixed(3) !== "2.893" || stats.counted !== 11) {
    throw new Error(`Fleet mean is ${stats.mean} over ${stats.counted}, expected 2.893 mΩ over 11 slotted packs`);
  }
  const c1p4 = statusRows().find((row) => row.label === "C1-P4");
  if (
    !c1p4 ||
    c1p4.latestSession !== "2026-09-27" ||
    c1p4.avg.toFixed(3) !== "2.875" ||
    c1p4.spread.toFixed(2) !== "0.65" ||
    c1p4.sr !== 17.25 ||
    c1p4.floor !== 3603 ||
    c1p4.lowGap !== 93
  ) {
    throw new Error(`C1-P4 card is ${c1p4?.latestSession} ${c1p4?.avg} ${c1p4?.spread} ${c1p4?.sr} ${c1p4?.floor} ${c1p4?.lowGap}`);
  }
  const c2p2 = statusRows().find((row) => row.label === "C2-P2");
  if (!c2p2 || c2p2.latestSession !== "2026-09-30" || c2p2.avg.toFixed(3) !== "3.217" || c2p2.sr !== 19.3 || c2p2.floor !== 3597 || c2p2.lowGap !== 98) {
    throw new Error(`C2-P2 card is ${c2p2?.latestSession} ${c2p2?.avg}`);
  }
  const model = fleetModel();
  const lastOf = (id: string) => {
    const line = model.mean.find((item) => item.id === id);
    return [...(line?.values ?? [])].reverse().find((value) => value != null);
  };
  const c1Last = lastOf("C1");
  const c2Last = lastOf("C2");
  if (c1Last == null || c1Last.toFixed(3) !== "2.907") throw new Error(`C1 series mean last is ${c1Last}`);
  if (c2Last == null || c2Last.toFixed(3) !== "2.886") throw new Error(`C2 series mean last is ${c2Last}`);
  const c1Fleet = model.fleets.find((fleet) => fleet.id === "C1");
  const day = model.categories.findIndex((category) => category.id === "2026-10-09");
  const restNightIndex = model.categories.findIndex((category) => category.id === "2026-10-09-restday0");
  const moved = c1Fleet?.packs.find((pack) => pack.uid === "CNHL-2026-001");
  if (!moved || moved.avg[day] != null) throw new Error("D-1 2026-10-09 is on the C1 line");
  const d1 = model.fleets.find((fleet) => fleet.id === "D")?.packs.find((pack) => pack.uid === "CNHL-2026-001");
  if (!d1 || d1.avg[day] == null || d1.avg[day].toFixed(3) !== "2.767") throw new Error("D-1 2026-10-09 is missing from series D");
  const p4 = c1Fleet?.packs.find((pack) => pack.uid === "CNHL-2026-004");
  if (!p4 || p4.avg[restNightIndex] != null) throw new Error("C1-P4 rest-day row is on a series line");
  if (c1Fleet && c1Fleet.rest[restNightIndex] != null) throw new Error("Rule B plotted the rest-day night");
  const c1Rule = [...(c1Fleet?.rest ?? [])].reverse().find((value) => value != null);
  const c2Rule = [...(model.fleets.find((fleet) => fleet.id === "C2")?.rest ?? [])].reverse().find((value) => value != null);
  if (c1Rule == null || Math.abs(c1Rule - 0.13) > 0.0005) throw new Error(`C1 Rule B last is ${c1Rule}`);
  if (c2Rule == null || Math.abs(c2Rule - 0.147) > 0.0005) throw new Error(`C2 Rule B last is ${c2Rule}`);
  const board = nextParallel();
  const rendered = board.series.map((item) => `${item.series}:${item.labels.join("+")}`).join(" | ");
  if (rendered !== "C1:C1-P2+C1-P3+C1-P6 | C2:C2-P1+C2-P3+C2-P4+C2-P5+C2-P6" || board.as_of !== "2026-10-09") {
    throw new Error(`Next parallel rendered as ${board.as_of} ${rendered}`);
  }
}

assertDerived();
