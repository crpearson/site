import fs from "node:fs";
import path from "node:path";
import metaDoc from "@/data/meta.json";
import registryDoc from "@/data/pack-registry.json";
import statusDoc from "@/data/status.json";
import { allNotCharged, axisNightVisible, gapPhrase, interiorRingIndices, legendNote, lineSegments, lonePointIndices, missBridges, openEndIndices, readingIndices, seriesNotCharged, solidFrom, type ChartMode } from "@/lib/bridges";
import { packColor, seriesColor } from "@/lib/color";
import { parseCsv } from "@/lib/csv";
import { formatValue, occupancyLabel, publicProse, publicSession, shortSession, shownWhen } from "@/lib/format";
import { IR_STORE_IS_DX8_INTEGER, IR_UNIT, scaleStoredIr } from "@/lib/ir";
import { irValidationIsProvisional } from "@/lib/ir-validation.mjs";
import {
  lampTone,
  splitCall,
  isGoWatch,
  statusChip,
  STATUS_CHIPS,
  type LampTone,
  type StatusChipName,
} from "@/lib/lamp";
import { buildNextBoard } from "@/lib/next-board.mjs";
import { loadNextCharge } from "@/lib/next-charge.mjs";
import { calendarDate } from "@/lib/pacific-date.mjs";
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
  provisional: boolean;
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

/**
 * Display label registry (2026-10-17). A row maps a pack to one public label and series for all dates.
 * The stores are untouched (append-only); the site shows the mapped label, drops the move events and
 * status rows that only concern a hidden label, and rewrites hidden-label wording in displayed text.
 */
type LabelMap = { uid: string; label: string; series: string; hidden: string[] };
const labelRegistry: LabelMap[] = readCsv("v2/label_registry.csv").map((row) => ({
  uid: row.pack_uid,
  label: row.display_label,
  series: row.display_series,
  hidden: row.hidden_labels.split("|").map((item) => item.trim()).filter(Boolean),
}));
const hiddenPool = /\b(?:the\s+)?D[ -]pool\b/gi;
function mapOf(uid: string): LabelMap | undefined {
  return labelRegistry.find((item) => item.uid === uid);
}
function shownLabel(uid: string, label: string): string {
  const map = mapOf(uid);
  return map && (map.hidden.includes(label) || /^D-\d+$/.test(label)) ? map.label : label;
}
function shownSeries(uid: string, series: string): string {
  const map = mapOf(uid);
  return map && series === "D" ? map.series : series;
}
function mentionsHidden(uid: string, text: string): boolean {
  const map = mapOf(uid);
  if (!map) return false;
  return map.hidden.some((label) => new RegExp(`\\b${label}\\b`).test(text)) || new RegExp(hiddenPool.source, "i").test(text);
}
function scrubText(uid: string, text: string): string {
  const map = mapOf(uid);
  if (!map) return text;
  let out = text;
  for (const label of map.hidden) out = out.replace(new RegExp(`\\b${label}\\b`, "g"), map.label);
  return out.replace(hiddenPool, "individual charging").replace(/\bseries D\b/g, `series ${map.series}`);
}
for (const pack of packs) {
  pack.notes = scrubText(pack.uid, pack.notes);
  pack.parallelCall = scrubText(pack.uid, pack.parallelCall);
  pack.serviceStatus = scrubText(pack.uid, pack.serviceStatus);
  if (mapOf(pack.uid)) pack.pool = "";
}

const events: PackEvent[] = readCsv("v2/pack_events.csv")
  .map((row) => ({
    date: row.date,
    uid: row.pack_uid,
    event: row.event,
    from: row.from_label ? shownLabel(row.pack_uid, row.from_label) : row.from_label,
    to: row.to_label ? shownLabel(row.pack_uid, row.to_label) : row.to_label,
    reason: scrubText(row.pack_uid, row.reason),
  }))
  // A move between a hidden label and the shown one is not a move on the site.
  .filter((event) => !(event.event === "move" && mapOf(event.uid) && event.from === event.to));

function sessionFromSource(source: string, date: string): string {
  const raw = source.match(/session=([^;]+)/)?.[1]?.trim() ?? "";
  const token = raw.split(/\s+/)[0] ?? "";
  if (/^\d{4}-\d{2}-\d{2}-(?:restday0|charge)$/.test(token)) return token;
  if (/^\d{4}-\d{2}-\d{2}(?:-eve)?$/.test(token)) return token;
  if (/^S\d+$/.test(token)) return token;
  if (/^\d{4}-\d{2}-\d{2}(?:-eve|-restday0)?$/.test(date) || /^S\d+$/.test(date)) return date;
  return token || date;
}

const calls: StatusCall[] = readCsv("v2/status_calls.csv")
  .map((row, index) => ({
    date: row.date,
    uid: row.pack_uid,
    label: row.label_at_time,
    status: row.status,
    reason: row.reason,
    source: row.source,
    session: sessionFromSource(row.source, row.date),
    order: index,
  }))
  // Status rows under a hidden label (or about it) are left off the site; later rows supersede them.
  .filter((call) => !(mapOf(call.uid) && (mapOf(call.uid)!.hidden.includes(call.label) || mentionsHidden(call.uid, `${call.status} ${call.reason}`))))
  .map((call) => ({ ...call, label: shownLabel(call.uid, call.label) }));

type RestTest = {
  id: string;
  uid: string;
  label: string;
  cell: string;
  start: string;
  due: string;
  result: string;
  note: string;
  /** Day-0 baseline date (the storage_end row). */
  readingDate: string;
  /** 7-day reading date, or "" while unread. */
  readDate: string;
  excessMv: string;
};

// One entry per test: the storage_end row is day 0; a later reading row (e.g. 7day) adds the result.
const restTests: RestTest[] = (() => {
  const byId = new Map<string, RestTest>();
  for (const row of readCsv("v2/rest_tests.csv").filter((item) => item.result.trim() !== "FILLED-SEE-DAY0-ROW")) {
    const key = `${row.test_id}|${row.pack_uid}`;
    if (row.reading === "storage_end") {
      byId.set(key, {
        id: row.test_id,
        uid: row.pack_uid,
        label: shownLabel(row.pack_uid, row.label),
        cell: row.suspect_cell,
        start: row.start_date,
        due: row.due_date,
        result: "unread",
        note: scrubText(row.pack_uid, row.note),
        readingDate: row.reading_date.trim(),
        readDate: "",
        excessMv: "",
      });
    } else {
      const test = byId.get(key);
      if (!test) throw new Error(`${row.test_id} ${row.reading} reading has no day-0 row`);
      test.result = row.result.trim() || "unread";
      test.readDate = row.reading_date.trim();
      test.excessMv = row.excess_mV.trim();
      test.note = scrubText(row.pack_uid, row.note);
    }
  }
  return [...byId.values()];
})();

const v4Rows = readCsv("v2/ir_store_v4.public.csv");

// A mapped pack's own charge-run session id is shown as the plain "<date>-charge" night.
const shownSession = (uid: string, session: string) => (mapOf(uid) ? session.replace(/-d\d+-charge$/, "-charge") : session);
const measurements: Measurement[] = v4Rows.map((row) => ({
  session: shownSession(row.pack_uid, row.session),
  label: shownLabel(row.pack_uid, row.label_at_time),
  uid: row.pack_uid,
  series: shownSeries(row.pack_uid, row.series_at_time),
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
  note: scrubText(row.pack_uid, row.v4_note),
  provisional: irValidationIsProvisional(row.ir_validation),
}));

/** Rest-test day 0 and charge runs are not storage nights. */
export function isNonStorage(sessionType: string): boolean {
  return sessionType === "rest-test-day0" || sessionType === "charge-run";
}

/** Sessions that are not storage nights. Not a fleet night for packs that did not run. */
const nonStorageSessions = new Set(
  measurements.filter((row) => isNonStorage(row.sessionType)).map((row) => row.session),
);

export function nonStorageSession(session: string): boolean {
  return nonStorageSessions.has(session);
}

/**
 * The series was charged, but its rows are not in the public file. That night
 * is not labeled "not charged". A recorded reading on either side still joins
 * through it, and no value is invented for the unpublished night. The date tick
 * is hidden when every plotted line is unpublished, and when nothing is plotted.
 * A rest-baseline column is a tick only when a value is drawn there. Empty while
 * every measured series-night is published.
 * A series that truly did not run stays "not charged".
 */
const UNPUBLISHED_SERIES_NIGHTS: { session: string; series: string }[] = [];

export function nightUnpublished(session: string, series: string | null): boolean {
  if (!series) return false;
  return UNPUBLISHED_SERIES_NIGHTS.some((item) => item.session === session && item.series === series);
}

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

function pointsFor(uid: string): Measurement[] {
  const order = new Map(sessionOrder.map((id, index) => [id, index]));
  return measurements
    .filter((row) => row.uid === uid)
    .sort((a, b) => (order.get(a.session) ?? 999) - (order.get(b.session) ?? 999));
}

/** Rest-test day-0 rows stay off the latest card, the means, and Rule B. */
function operationalPoints(uid: string): Measurement[] {
  return pointsFor(uid).filter((point) => !isNonStorage(point.sessionType));
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
  "CNHL-2026-001": "PARALLEL GO: on the C1 board | SERVICE In service (watch)",
  "CNHL-2026-002": "PARALLEL GO | SERVICE In service",
  "CNHL-2026-003": "PARALLEL GO | SERVICE In service",
  "CNHL-2026-004": "PARALLEL GO: on the C1 board | SERVICE In service",
  "CNHL-2026-005": "PARALLEL GO: on the C1 board | SERVICE In service",
  "CNHL-2026-006": "PARALLEL GO | SERVICE In service",
  "CNHL-2026-007": "PARALLEL GO: on the C2 board | SERVICE In service",
  "CNHL-2026-008": "PARALLEL GO: on the C2 board | SERVICE In service",
  "CNHL-2026-009": "PARALLEL GO | SERVICE In service",
  "CNHL-2026-010": "PARALLEL GO | SERVICE In service",
  "CNHL-2026-011": "PARALLEL GO | SERVICE In service",
  "CNHL-2026-012": "PARALLEL GO: on the C2 board | SERVICE In service",
  "CNHL-2026-013": "PARALLEL GO: on the C3 board | SERVICE In service",
  "CNHL-2026-014": "PARALLEL GO: on the C3 board | SERVICE In service",
  "CNHL-2026-015": "PARALLEL GO: on the C3 board | SERVICE In service",
  "CNHL-2026-016": "PARALLEL GO: on the C3 board | SERVICE In service",
  "CNHL-2026-017": "PARALLEL GO: on the C3 board | SERVICE In service",
  "CNHL-2026-018": "PARALLEL GO: on the C3 board | SERVICE In service",
  "CNHL-2026-019": "PARALLEL GO: on the C4 board | SERVICE In service",
  "CNHL-2026-020": "PARALLEL GO: on the C4 board | SERVICE In service",
  "CNHL-2026-021": "PARALLEL GO: on the C4 board | SERVICE In service",
  "CNHL-2026-022": "PARALLEL GO: on the C4 board | SERVICE In service",
  "CNHL-2026-023": "PARALLEL GO: on the C4 board | SERVICE In service",
  "CNHL-2026-024": "PARALLEL GO: on the C4 board | SERVICE In service",
};

function assertStore() {
  if (measurements.length !== 238 || v4Rows.length !== 238) {
    throw new Error(`Expected 238 measurements, got ${measurements.length}`);
  }
  if (IR_STORE_IS_DX8_INTEGER) {
    throw new Error("ir_store_v4 is already milliohms. IR_STORE_IS_DX8_INTEGER must stay false.");
  }
  const sample = measurements.find((row) => row.uid === "CNHL-2026-001" && row.session === "2026-10-09");
  if (!sample || sample.cells.map((cell) => cell.toFixed(1)).join(",") !== "3.2,2.9,2.5,2.2,3.0,2.8") {
    throw new Error("C1-P1 2026-10-09 IR spot check failed");
  }
  if (sample.avg.toFixed(3) !== "2.767" || sample.spread.toFixed(1) !== "1.0") {
    throw new Error("C1-P1 2026-10-09 average or spread spot check failed");
  }
  const restC2 = measurements.find((row) => row.uid === "CNHL-2026-008" && row.session === "2026-10-09-restday0");
  const restC1 = measurements.find((row) => row.uid === "CNHL-2026-004" && row.session === "2026-10-09-restday0");
  if (!restC2 || restC2.cells.map((cell) => cell.toFixed(1)).join(",") !== "3.3,2.3,3.9,3.4,3.1,2.8") {
    throw new Error("C2-P2 rest-day IR spot check failed");
  }
  if (!restC1 || restC1.cells.map((cell) => cell.toFixed(1)).join(",") !== "3.1,3.4,3.2,3.7,2.8,2.8") {
    throw new Error("C1-P4 rest-day IR spot check failed");
  }
  if (packByUid("CNHL-2026-004")?.chargeCount !== 15 || packByUid("CNHL-2026-008")?.chargeCount !== 15) {
    throw new Error("C1-P4 and C2-P2 charge_count should be 15 (2026-10-18 charge run)");
  }
  if (packByUid("CNHL-2026-005")?.chargeCount !== 17 || packByUid("CNHL-2026-012")?.chargeCount !== 17) {
    throw new Error("C1-P5 and C2-P6 charge_count should be 17");
  }
  const chargeRuns = measurements.filter((row) => row.session === "2026-10-11-charge");
  if (
    chargeRuns.length !== 2 ||
    chargeRuns.some((row) => row.sessionType !== "charge-run") ||
    !chargeRuns.some((row) => row.uid === "CNHL-2026-012" && row.label === "C2-P6") ||
    !chargeRuns.some((row) => row.uid === "CNHL-2026-005" && row.label === "C1-P5")
  ) {
    throw new Error("2026-10-11-charge should be C2-P6 and C1-P5 only");
  }
  const storageNight = measurements.filter((row) => row.session === "2026-10-11");
  const storageLabels = storageNight.map((row) => row.label).sort().join(",");
  if (
    storageNight.length !== 9 ||
    storageNight.some((row) => isNonStorage(row.sessionType)) ||
    storageLabels !== "C1-P2,C1-P3,C1-P5,C1-P6,C2-P1,C2-P3,C2-P4,C2-P5,C2-P6"
  ) {
    throw new Error(`2026-10-11 storage night is ${storageLabels}`);
  }
  if (
    latestOperational("CNHL-2026-012")?.session !== "2026-10-17" ||
    latestOperational("CNHL-2026-005")?.session !== "2026-10-17" ||
    latestOperational("CNHL-2026-007")?.session !== "2026-10-17"
  ) {
    throw new Error("2026-10-17 storage rows are the latest readings");
  }
  if (operationalPoints("CNHL-2026-012").some((row) => row.session === "2026-10-11-charge")) {
    throw new Error("the charge run is still in the latest readings");
  }
  const d1Pass = restTests.filter((test) => test.id === "RT-001-1" && test.result === "PASS" && test.readDate === "2026-10-17" && test.readingDate === "2026-10-09");
  if (restTests.some((test) => test.uid === "CNHL-2026-003") || restTests.length !== 3 || d1Pass.length !== 1) {
    throw new Error("Rest tests should be the three tests (day 0 2026-10-09) with RT-001-1 read PASS on 2026-10-17, and no C1-P3 test");
  }
  const freshCharge = measurements.filter((row) => row.session === "2026-10-14-charge");
  const freshStorage = measurements.filter((row) => row.session === "2026-10-14");
  const freshLabels = ["C3-P1", "C3-P2", "C3-P3", "C3-P4", "C3-P5", "C3-P6", "C4-P1", "C4-P2", "C4-P3", "C4-P4", "C4-P5", "C4-P6"];
  if (
    freshCharge.length !== 12 ||
    freshCharge.some((row) => row.sessionType !== "charge-run") ||
    freshStorage.length !== 12 ||
    freshStorage.some((row) => isNonStorage(row.sessionType) || row.series !== row.label.slice(0, 2))
  ) {
    throw new Error("2026-10-14 charge run or storage night is missing");
  }
  const night2 = measurements.filter((row) => row.session === "2026-10-16");
  if (night2.length !== 12 || night2.some((row) => isNonStorage(row.sessionType) || row.series !== row.label.slice(0, 2))) {
    throw new Error("2026-10-16 storage night is missing");
  }
  for (const label of freshLabels) {
    const pack = packs.find((item) => item.label === label);
    const mode = "parallel";
    // 2026-10-17: C3-P2 was charged with no log, so it keeps count 3 and its 2026-10-16 reading.
    const count = label === "C3-P2" ? 3 : 4;
    const latest = label === "C3-P2" ? "2026-10-16" : "2026-10-17";
    if (!pack || pack.chargeCount !== count || pack.chargeMode !== mode || pack.purchaseDate !== "2026-10-13") {
      throw new Error(`${label} should be charge count ${count}, ${mode}, purchased 2026-10-13`);
    }
    if (latestOperational(pack.uid)?.session !== latest) {
      throw new Error(`${label} latest storage night is ${latestOperational(pack.uid)?.session}`);
    }
    if (operationalPoints(pack.uid).some((row) => row.session === "2026-10-14-charge")) {
      throw new Error(`${label} charge run is in the latest readings`);
    }
  }
  if (freshStorage.some((row) => row.series === "C1" || row.series === "C2" || row.series === "D")) {
    throw new Error("2026-10-14 storage mixed C3 or C4 with an older series");
  }
  if (night2.some((row) => row.series === "C1" || row.series === "C2" || row.series === "D")) {
    throw new Error("2026-10-16 storage mixed C3 or C4 with an older series");
  }
  for (const [uid, status] of Object.entries(EXPECTED_LATEST)) {
    const call = latestCall(uid);
    if (!call || call.status !== status) {
      throw new Error(`Latest status for ${uid} is ${call?.status ?? "missing"}`);
    }
  }
  // Rules v7 (2026-10-17): the pack that was D-1 is C1-P1 again (same uid, continuous history).
  if (packs.find((pack) => pack.label === "C1-P1")?.uid !== "CNHL-2026-001" || packs.some((pack) => pack.label.startsWith("D-"))) {
    throw new Error("C1-P1 should be CNHL-2026-001 again, with no D pack");
  }
  if (labelAsOf("CNHL-2026-001", "2026-09-30") !== "C1-P1") {
    throw new Error("CNHL-2026-001 should still be C1-P1 on 2026-09-30");
  }
  // Label registry (2026-10-17): CNHL-2026-001 is shown as C1-P1 on every date, with no move on the site.
  for (const day of ["2026-10-08", "2026-10-09", "2026-10-16", "2026-10-17", "2026-10-18"]) {
    if (labelAsOf("CNHL-2026-001", day) !== "C1-P1") throw new Error(`CNHL-2026-001 should be C1-P1 on ${day}`);
  }
  if (movedEvent("CNHL-2026-001")) throw new Error("CNHL-2026-001 should have no move on the site");
  const hiddenLabel = (text: string) => /\bD-\d\b|\bD[ -]pool\b|\bseries D\b/i.test(text);
  if (
    measurements.some((row) => row.series === "D" || hiddenLabel(row.label) || hiddenLabel(row.note)) ||
    calls.some((call) => hiddenLabel(`${call.label} ${call.status} ${call.reason}`)) ||
    events.some((event) => hiddenLabel(`${event.from} ${event.to} ${event.reason}`)) ||
    restTests.some((test) => hiddenLabel(`${test.label} ${test.note}`)) ||
    packs.some((pack) => pack.series === "D" || hiddenLabel(`${pack.label} ${pack.notes} ${pack.parallelCall} ${pack.serviceStatus}`))
  ) {
    throw new Error("a hidden label or series D is still in the displayed data");
  }
  if (packs.filter((pack) => !pack.retired && /^C[1-4]-P[1-6]$/.test(pack.label)).length !== 24) throw new Error("the fleet should be 24 packs, C1-C4 x 6");
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
  { y: spreadRule.caution_gte, label: `Watch note ≥ ${formatValue("ir", spreadRule.caution_gte)} ${IR_UNIT}`, color: "#f5b942" },
  { y: spreadRule.individual_gte, label: `Watch note, look first ≥ ${formatValue("ir", spreadRule.individual_gte)} ${IR_UNIT}`, color: "#79b8ff" },
];

export const ruleABands: Band[] = [
  { from: spreadRule.caution_gte, to: spreadRule.individual_gte, color: "rgba(245, 185, 66, 0.18)" },
  { from: spreadRule.individual_gte, to: Number.POSITIVE_INFINITY, color: "rgba(121, 184, 255, 0.1)" },
];

export const ruleBGuides: Guide[] = [
  { y: restRule.go_lte, label: `Go ≤ ${restRule.go_lte.toFixed(2)} V`, color: "#3ddc97" },
];

export const ruleBBands: Band[] = [];

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
 * Span id while this uid is in service. Null before commission and from a
 * retirement date onward. A move does not start a new span: the pack is one
 * serial, and its readings stay on one line through every label.
 */
function serviceSpans(uid: string): (string | null)[] {
  const pack = packByUid(uid);
  const list = eventsFor(uid);
  const commission = list.find((event) => event.event === "commission");
  const retired = pack?.retired.trim() ?? "";
  return categories.map((category) => {
    if (!commission || compareTime(category.id, commission.date) < 0) return null;
    if (retired && compareTime(category.id, retired) >= 0) return null;
    // Rest-test day 0 and charge runs are not storage nights. The column is a
    // hole, so a later storage reading still joins the earlier one.
    if (nonStorageSessions.has(category.id)) return null;
    // Unpublished series rows are not a skipped charge. Readings on either side still join.
    if (nightUnpublished(category.id, seriesOfLabel(labelAsOf(uid, category.id)))) return null;
    return "0";
  });
}

function loggedNights(uid: string): boolean[] {
  const have = new Set(pointsFor(uid).map((row) => row.session));
  return categories.map((category) => have.has(category.id));
}

/** Nights the pack note says were charged with no charger log. No IR value is invented. */
function noLogNights(uid: string): boolean[] {
  const notes = packByUid(uid)?.notes ?? "";
  const dates = new Set<string>();
  for (const match of notes.matchAll(/(\d{4}-\d{2}-\d{2}):\s*charged,\s*no log/gi)) {
    dates.add(match[1]);
  }
  return categories.map((category) => dates.has(category.id) || dates.has(calendarDate(category.id)));
}

function lineMeta(uid: string): { service: (string | null)[]; logged: boolean[]; nolog: boolean[] } {
  return { service: serviceSpans(uid), logged: loggedNights(uid), nolog: noLogNights(uid) };
}

function alignUid(
  uid: string,
  pick: (row: Measurement) => number | null,
  series?: string,
): (number | null)[] {
  const map = new Map(pointsFor(uid).map((row) => [row.session, row]));
  return categories.map((category) => {
    const row = map.get(category.id);
    if (!row || isNonStorage(row.sessionType)) return null;
    if (series && row.series !== series) return null;
    return pick(row);
  });
}

function alignProvisional(uid: string, series?: string): boolean[] {
  const map = new Map(pointsFor(uid).map((row) => [row.session, row]));
  return categories.map((category) => {
    const row = map.get(category.id);
    if (!row || isNonStorage(row.sessionType)) return false;
    if (series && row.series !== series) return false;
    return row.provisional;
  });
}

function restFlags(uid: string): boolean[] {
  const map = new Map(pointsFor(uid).map((row) => [row.session, row]));
  return categories.map((category) => {
    if (!inRestPool(uid, category.id)) return false;
    const row = map.get(category.id);
    return !row || isNonStorage(row.sessionType);
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

const SERIES_ORDER = ["C1", "C2", "C3", "C4"];

export function seriesIds(): string[] {
  // Rules v7: a series that has no packs now (the D pool) stays while it has history, so moved packs keep their line.
  const present = new Set([...packs.map((pack) => pack.series), ...measurements.filter((row) => !isNonStorage(row.sessionType)).map((row) => row.series)]);
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
  provisional: boolean;
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
      provisional: latest.provisional,
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
  chargeMode: string | null;
  provisional: boolean;
  reason: string | null;
};

export type SeriesBlock = {
  id: string;
  asOf: string;
  lastMeasured: string;
  individual: boolean;
  slots: SlotTile[];
};

function lastMeasured(series: string): string {
  const rows = measurements.filter((row) => row.series === series && !isNonStorage(row.sessionType));
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
  return calendarDate(latest) || "undated";
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
        chargeMode: pack?.chargeMode ?? null,
        provisional: row?.provisional ?? false,
        reason: row?.reason ?? null,
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

function recordedBoard(session: string, series: string) {
  const doc = loadNextCharge();
  for (const set of Object.values(doc.sets)) {
    const board = set.parallel_boards.find(
      (item) =>
        item.series === series &&
        item.last_rule_b_session === session &&
        typeof item.last_rule_b_V === "number",
    );
    if (board) return board;
  }
  return null;
}

function parallelBoardUids(): Set<string> {
  const labels = new Set(buildNextBoard().series.flatMap((board: { labels: string[] }) => board.labels));
  return new Set(packs.filter((pack) => labels.has(pack.label)).map((pack) => pack.uid));
}

export function restDelta(session: string, series: string): number | null {
  const recorded = recordedBoard(session, series);
  if (recorded && typeof recorded.last_rule_b_V === "number") {
    return recorded.last_rule_b_V;
  }
  const board = parallelBoardUids();
  const rows = measurements.filter(
    (row) =>
      row.session === session &&
      row.series === series &&
      board.has(row.uid) &&
      !isNonStorage(row.sessionType) &&
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
  if (nonStorageSessions.has(session)) {
    // Day-0 rest rows are not a parallel charge and are not a Rule B night.
    return { value: null, na: false };
  }
  const recorded = recordedBoard(session, series);
  const board = parallelBoardUids();
  const ran = recorded
    ? measurements.some(
        (row) =>
          row.session === session &&
          row.series === series &&
          recorded.last_rule_b_over.includes(row.label) &&
          !isNonStorage(row.sessionType),
      )
    : measurements.some(
        (row) =>
          row.session === session &&
          row.series === series &&
          board.has(row.uid) &&
          !isNonStorage(row.sessionType),
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
  /** Series-local readings. The series mean uses these and ignores other labels. */
  avg: (number | null)[];
  spread: (number | null)[];
  floor: (number | null)[];
  cells: (number | null)[][];
  /** Every storage reading for this uid, including nights under an earlier label. */
  historyAvg: (number | null)[];
  historySpread: (number | null)[];
  historyFloor: (number | null)[];
  historyCells: (number | null)[][];
  service: (string | null)[];
  logged: boolean[];
  nolog: boolean[];
  rest: boolean[];
  unpublished: boolean[];
  provisional: boolean[];
};

export type FleetModel = {
  categories: Category[];
  irDomain: [number, number];
  meanDomain: [number, number];
  spreadDomain: [number, number];
  floorDomain: [number, number];
  restDomain: [number, number];
  mean: {
    id: string;
    color: string;
    values: (number | null)[];
    service: (string | null)[];
    unpublished: boolean[];
    provisional: boolean[];
  }[];
  fleets: {
    id: string;
    packs: PackSeries[];
    rest: (number | null)[];
    restNa: boolean[];
    restService: (string | null)[];
    unpublished: boolean[];
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
      historyAvg: alignUid(uid, (row) => row.avg),
      historySpread: alignUid(uid, (row) => row.spread),
      historyFloor: alignUid(uid, (row) => row.floor),
      historyCells: [0, 1, 2, 3, 4, 5].map((index) => alignUid(uid, (row) => row.cells[index] ?? null)),
      service: meta.service,
      logged: meta.logged,
      nolog: meta.nolog,
      rest: restFlags(uid),
      unpublished: unpublishedForSeries(series),
      provisional: alignProvisional(uid),
    };
  });
}

function fleetMean(packsInSeries: PackSeries[]): (number | null)[] {
  return categories.map((category, index) => {
    if (nonStorageSessions.has(category.id)) return null;
    const values = packsInSeries
      .map((pack) => pack.avg[index])
      .filter((value): value is number => value != null);
    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  });
}

function meanIsProvisional(packsInSeries: PackSeries[]): boolean[] {
  return categories.map((category, index) => {
    if (nonStorageSessions.has(category.id)) return false;
    return packsInSeries.some((pack) => pack.avg[index] != null && pack.provisional[index]);
  });
}

function unpublishedForSeries(series: string): boolean[] {
  return categories.map((category) => nightUnpublished(category.id, series));
}

function unpublishedForUid(uid: string): boolean[] {
  return categories.map((category) => nightUnpublished(category.id, seriesOfLabel(labelAsOf(uid, category.id))));
}

function seriesOfLabel(label: string | null): string | null {
  if (!label) return null;
  return seriesIds().find((id) => label === id || label.startsWith(`${id}-`)) ?? null;
}

/** Nights a series has at least one pack. Null before it exists and after it is empty. */
function seriesInService(series: string): (string | null)[] {
  return categories.map((category) => {
    if (nonStorageSessions.has(category.id)) return null;
    if (nightUnpublished(category.id, series)) return null;
    const members = packs.filter((pack) => seriesOfLabel(labelAsOf(pack.uid, category.id)) === series);
    if (members.length === 0) return null;
    const measured = measurements.some(
      (row) => row.session === category.id && row.series === series && !isNonStorage(row.sessionType),
    );
    // Rest pool is not a skipped charge. A series whose packs are all resting,
    // with no public row, stays off the mean and Rule B lines.
    if (!measured && members.every((pack) => inRestPool(pack.uid, category.id))) return null;
    return "0";
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
      restService: seriesInService(series),
      unpublished: unpublishedForSeries(series),
      individual: members.length > 0 && members.every((pack) => pack.chargeMode === "individual"),
    };
  });
  const measured = fleets.filter((fleet) => fleet.packs.length > 0);
  const allIr = measured.flatMap((fleet) =>
    fleet.packs.flatMap((pack) => [...pack.historyAvg, ...pack.historyCells.flat()]),
  );
  const allSpread = measured.flatMap((fleet) => fleet.packs.flatMap((pack) => pack.historySpread));
  const allFloor = measured.flatMap((fleet) => fleet.packs.flatMap((pack) => pack.historyFloor));
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
      service: seriesInService(fleet.id),
      unpublished: unpublishedForSeries(fleet.id),
      provisional: meanIsProvisional(fleet.packs),
    })),
    fleets,
  };
}

export function seriesOf(rows: PackSeries[], pick: "avg" | "spread" | "floor"): ChartSeries[] {
  return rows.map((row) => ({
    id: row.uid,
    label: row.id,
    color: row.color,
    values: pick === "avg" ? row.historyAvg : pick === "spread" ? row.historySpread : row.historyFloor,
    service: row.service,
    logged: row.logged,
    nolog: row.nolog,
    rest: row.rest,
    unpublished: row.unpublished,
    provisional: pick === "floor" ? undefined : row.provisional,
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
  | { session: string; partial: boolean; kind: "not-charged"; label: string; bridged: boolean }
  | { session: string; partial: boolean; kind: "charged-no-log"; label: string };

function packNights(uid: string): PackNight[] {
  const { service, logged, nolog } = lineMeta(uid);
  const points = pointsFor(uid);
  const bySession = new Map(points.map((point) => [point.session, point]));
  const values = categories.map((category) => {
    const point = bySession.get(category.id);
    if (!point || isNonStorage(point.sessionType)) return null;
    return point.avg;
  });
  const nightIds = categories.map((category) => category.id);
  const bridged = new Set(
    missBridges({ id: uid, label: uid, color: "", values, service, logged }, nightIds).flatMap(
      (bridge) => bridge.nights,
    ),
  );
  const nights: PackNight[] = [];
  categories.forEach((category, index) => {
    const point = bySession.get(category.id);
    if (point && isNonStorage(point.sessionType)) return;
    if (point) {
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
    if (nolog[index]) {
      nights.push({
        session: category.id,
        partial: category.partial,
        kind: "charged-no-log",
        label: labelAsOf(uid, category.id) ?? "—",
      });
      return;
    }
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
  chargeRuns: Measurement[];
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
  const provisional = alignProvisional(uid);
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
    chargeRuns: pointsFor(uid).filter((point) => point.sessionType === "charge-run"),
    categories,
    cellSeries: [0, 1, 2, 3, 4, 5].map((index) => ({
      id: `c${index + 1}`,
      label: `Cell ${index + 1}`,
      color: packColor(`P${index + 1}`),
      values: alignUid(uid, (point) => point.cells[index] ?? null),
      service: meta.service,
      logged: meta.logged,
      nolog: meta.nolog,
      rest,
      unpublished: unpublishedForUid(uid),
      provisional,
    })),
    spreadSeries: [
      {
        id: uid,
        label: pack.label,
        color: packColor(pack.label),
        values: alignUid(uid, (point) => point.spread),
        service: meta.service,
        logged: meta.logged,
        nolog: meta.nolog,
        rest,
        unpublished: unpublishedForUid(uid),
        provisional,
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
        nolog: meta.nolog,
        rest,
        unpublished: unpublishedForUid(uid),
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

export function ruleABand(spread: number): "Go" | "Caution" | "Watch" {
  if (spread >= spreadRule.individual_gte) return "Watch";
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
  if (stats.mean.toFixed(3) !== "2.669" || stats.counted !== 24) {
    throw new Error(`Fleet mean is ${stats.mean} over ${stats.counted}, expected 2.669 mΩ over 24 slotted packs`);
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
  if (c1Last == null || c1Last.toFixed(3) !== "2.600") throw new Error(`C1 series mean last is ${c1Last}`);
  if (c2Last == null || c2Last.toFixed(3) !== "2.617") throw new Error(`C2 series mean last is ${c2Last}`);
  const c3Last = lastOf("C3");
  const c4Last = lastOf("C4");
  if (c3Last == null || c3Last.toFixed(3) !== "2.802") throw new Error(`C3 series mean last is ${c3Last}`);
  if (c4Last == null || c4Last.toFixed(3) !== "2.483") throw new Error(`C4 series mean last is ${c4Last}`);
  const night1 = model.categories.findIndex((category) => category.id === "2026-10-14");
  const night2 = model.categories.findIndex((category) => category.id === "2026-10-16");
  const c3Fleet = model.fleets.find((item) => item.id === "C3");
  const c4Fleet = model.fleets.find((item) => item.id === "C4");
  if (night1 < 0 || c3Fleet?.rest[night1] != null || c4Fleet?.rest[night1] != null) {
    throw new Error("C3 or C4 has a Rule B value on the first storage night");
  }
  if (night2 < 0 || c3Fleet?.rest[night2] != null || c4Fleet?.rest[night2] != null) {
    throw new Error(`C3 or C4 has a Rule B value on 2026-10-16 (${c3Fleet?.rest[night2]}, ${c4Fleet?.rest[night2]})`);
  }
  const charge14 = model.categories.findIndex((category) => category.id === "2026-10-14-charge");
  const c3MeanLine = model.mean.find((line) => line.id === "C3");
  const c4MeanLine = model.mean.find((line) => line.id === "C4");
  if (charge14 < 0 || c3MeanLine?.values[charge14] != null || c4MeanLine?.values[charge14] != null) {
    throw new Error("a 2026-10-14 charge-run row is in a C3 or C4 series mean");
  }
  const c1Fleet = model.fleets.find((fleet) => fleet.id === "C1");
  const day = model.categories.findIndex((category) => category.id === "2026-10-09");
  const restNightIndex = model.categories.findIndex((category) => category.id === "2026-10-09-restday0");
  const moved = c1Fleet?.packs.find((pack) => pack.uid === "CNHL-2026-001");
  // Label registry: C1-P1's 2026-10-09 reading is on the C1 line; there is no series D.
  if (!moved || moved.avg[day] == null || moved.avg[day]!.toFixed(3) !== "2.767") throw new Error("C1-P1 2026-10-09 is missing from the C1 line");
  if (model.fleets.some((fleet) => fleet.id === "D")) throw new Error("series D is still on the site");
  const p4 = c1Fleet?.packs.find((pack) => pack.uid === "CNHL-2026-004");
  if (!p4 || p4.avg[restNightIndex] != null) throw new Error("C1-P4 rest-day row is on a series line");
  if (c1Fleet && c1Fleet.rest[restNightIndex] != null) throw new Error("Rule B plotted the rest-day night");
  const c1Rule = [...(c1Fleet?.rest ?? [])].reverse().find((value) => value != null);
  const c2Rule = [...(model.fleets.find((fleet) => fleet.id === "C2")?.rest ?? [])].reverse().find((value) => value != null);
  // 2026-10-17 was per-pack storage runs (no board connection), so no Rule B is recorded for it.
  if (c1Rule == null || Math.abs(c1Rule - 0.186) > 0.0005) throw new Error(`C1 Rule B last is ${c1Rule}`);
  if (c2Rule == null || Math.abs(c2Rule - 0.23) > 0.0005) throw new Error(`C2 Rule B last is ${c2Rule}`);
  {
    const n17 = model.categories.findIndex((category) => category.id === "2026-10-17");
    if (n17 < 0 || model.fleets.some((fleet) => fleet.rest[n17] != null)) throw new Error("a Rule B value is recorded for 2026-10-17");
  }
  const heldNight = model.categories.findIndex((category) => category.id === "2026-10-10");
  if (heldNight < 0 || c1Fleet?.rest[heldNight] == null || Math.abs(c1Fleet.rest[heldNight] - 0.135) > 0.0005) {
    throw new Error(`C1 Rule B on 2026-10-10 is ${c1Fleet?.rest[heldNight]}`);
  }
  const storageIndex = model.categories.findIndex((category) => category.id === "2026-10-11");
  const c2Fleet = model.fleets.find((fleet) => fleet.id === "C2");
  if (storageIndex < 0 || c1Fleet?.rest[storageIndex] == null || Math.abs(c1Fleet.rest[storageIndex] - 0.186) > 0.0005) {
    throw new Error(`C1 Rule B on 2026-10-11 is ${c1Fleet?.rest[storageIndex]}`);
  }
  if (c2Fleet?.rest[storageIndex] == null || Math.abs(c2Fleet.rest[storageIndex] - 0.23) > 0.0005) {
    throw new Error(`C2 Rule B on 2026-10-11 is ${c2Fleet?.rest[storageIndex]}`);
  }
  const outlookOnChart = [c1Fleet, c2Fleet, c3Fleet, c4Fleet].flatMap((fleet) => fleet?.rest ?? []);
  for (const outlook of [0.384, 0.425, 0.629, 0.43, 0.249]) {
    if (outlookOnChart.some((value) => value != null && Math.abs(value - outlook) < 0.0005)) {
      throw new Error(`a Rule B chart plots the outlook figure ${outlook}`);
    }
  }
  const board = nextParallel();
  const rendered = board.series.map((item) => `${item.series}:${item.labels.join("+")}`).join(" | ");
  if (
    rendered !==
      "C1:C1-P1+C1-P2+C1-P3+C1-P4+C1-P5+C1-P6 | C2:C2-P1+C2-P2+C2-P3+C2-P4+C2-P5+C2-P6 | C3:C3-P1+C3-P2+C3-P3+C3-P4+C3-P5+C3-P6 | C4:C4-P1+C4-P2+C4-P3+C4-P4+C4-P5+C4-P6" ||
    board.as_of !== "2026-10-18"
  ) {
    throw new Error(`Next parallel rendered as ${board.as_of} ${rendered}`);
  }
  for (const label of ["C1-P1", "C1-P4", "C2-P2", "C3-P5", "C3-P6", "C4-P2"]) {
    if (!board.series.some((item) => item.labels.includes(label))) throw new Error(`${label} is missing from its board`);
  }
  if (board.series.some((item) => item.labels.some((label) => label.startsWith("D-")))) throw new Error("a D label is on a next parallel board");
  assertUnpublishedNight(model, heldNight);
  assertStatusChips();
  assertRingWindows(model);
  assertGapGeometry(model);
}

function assertAxisMechanism() {
  const held = (id: string, extra: Partial<ChartSeries> = {}): ChartSeries => ({
    id,
    label: id,
    color: "#888",
    values: [null],
    service: [null],
    unpublished: [true],
    ...extra,
  });
  if (axisNightVisible([held("out"), held("rest", { rest: [true] })], 0)) {
    throw new Error("axis tick stayed visible when every line was unpublished");
  }
  if (!axisNightVisible([held("value", { values: [1], service: ["0"] })], 0)) {
    throw new Error("a value on an unpublished line must keep the axis tick");
  }
  if (!axisNightVisible([held("skip", { service: ["0"], logged: [false] })], 0)) {
    throw new Error("a real skip on an unpublished line must keep the axis tick");
  }
  if (!axisNightVisible([held("na", { service: ["0"], na: [true] })], 0)) {
    throw new Error("N/A on an unpublished line must keep the axis tick");
  }
  if (!axisNightVisible([held("out"), held("published", { values: [1], service: ["0"], unpublished: [false] })], 0)) {
    throw new Error("a published line must keep the axis tick");
  }
  const nothingPlotted: ChartSeries = {
    id: "hole",
    label: "hole",
    color: "#888",
    values: [null],
    service: [null],
    unpublished: [false],
  };
  if (axisNightVisible([nothingPlotted], 0, "2026-10-09-restday0")) {
    throw new Error("a rest-baseline column with nothing plotted must hide the axis tick");
  }
  const restOnly: ChartSeries = {
    id: "rest",
    label: "rest",
    color: "#888",
    values: [null],
    service: ["0"],
    rest: [true],
  };
  if (!axisNightVisible([restOnly], 0, "2026-10-10")) {
    throw new Error("a rest-pool night must keep its axis tick");
  }
  if (axisNightVisible([restOnly], 0, "2026-10-09-restday0")) {
    throw new Error("a rest-baseline column must hide its tick when no value is plotted");
  }
  if (!axisNightVisible([{ ...nothingPlotted, values: [1], service: ["0"] }], 0, "2026-10-09-restday0")) {
    throw new Error("a value on the rest-baseline column must keep the axis tick");
  }
}

function assertUnpublishedNight(model: FleetModel, index: number) {
  const night = "2026-10-10";
  assertAxisMechanism();
  if (UNPUBLISHED_SERIES_NIGHTS.length !== 0 || nightUnpublished(night, "C2") || nightUnpublished(night, "C1")) {
    throw new Error("2026-10-10 is published for C1 and C2");
  }
  for (let rowIndex = 0; rowIndex < v4Rows.length; rowIndex += 1) {
    const row = v4Rows[rowIndex];
    const measurement = measurements[rowIndex];
    if (!measurement || measurement.provisional !== irValidationIsProvisional(row.ir_validation)) {
      throw new Error(`provisional flag does not follow ir_validation on ${row.session}/${row.pack_uid}`);
    }
  }
  const c2Rows = measurements.filter((row) => row.session === night && row.series === "C2");
  const c1Rows = measurements.filter((row) => row.session === night && row.series === "C1");
  if (c2Rows.length !== 5 || c2Rows.some((row) => row.provisional)) {
    throw new Error("C2 2026-10-10 IR is validated and must not be marked provisional");
  }
  if (c1Rows.length !== 4 || c1Rows.some((row) => row.provisional)) {
    throw new Error("C1 2026-10-10 IR must stay validated");
  }
  if (measurements.some((row) => row.provisional)) {
    throw new Error("a plotted row is provisional though ir_validation does not say so");
  }
  const c2Card = statusRows().find((row) => row.uid === "CNHL-2026-007");
  const c1Card = statusRows().find((row) => row.uid === "CNHL-2026-003");
  if (!c2Card || c2Card.provisional || c2Card.latestSession !== "2026-10-17" || c2Card.avg.toFixed(3) !== "2.617" || c2Card.spread.toFixed(1) !== "0.9") {
    throw new Error(`C2-P1 card is ${c2Card?.latestSession} ${c2Card?.avg} provisional=${c2Card?.provisional}`);
  }
  if (!c1Card || c1Card.provisional) throw new Error("C1-P3 card is marked provisional");
  const c2Mean = model.mean.find((line) => line.id === "C2");
  if (!c2Mean || c2Mean.service?.[index] == null || c2Mean.values[index] == null || c2Mean.values[index].toFixed(3) !== "2.700") {
    throw new Error(`C2 mean on 2026-10-10 is ${c2Mean?.values[index]}`);
  }
  if (c2Mean.provisional[index]) throw new Error("C2 series mean on 2026-10-10 is marked provisional");
  const c1Mean = model.mean.find((line) => line.id === "C1");
  if (!c1Mean || c1Mean.provisional[index]) throw new Error("C1 series mean on 2026-10-10 is marked provisional");
  const chargeIndex = model.categories.findIndex((category) => category.id === "2026-10-11-charge");
  if (chargeIndex < 0 || c1Mean.values[chargeIndex] != null || c2Mean.values[chargeIndex] != null) {
    throw new Error("a charge-run row is in a series mean");
  }
  if (ringNights(chartLine("C2", c2Mean.values, c2Mean.service)).includes(night)) {
    throw new Error("C2 mean has a not-charged ring on 2026-10-10");
  }
  const c2Rest = model.fleets.find((fleet) => fleet.id === "C2");
  if (!c2Rest || c2Rest.restService[index] == null || c2Rest.rest[index] == null || Math.abs(c2Rest.rest[index] - 0.479) > 0.0005) {
    throw new Error(`C2 Rule B on 2026-10-10 is ${c2Rest?.rest[index]}`);
  }
  if (ringNights(chartLine("C2", c2Rest.rest, c2Rest.restService, undefined, undefined, c2Rest.restNa)).includes(night)) {
    throw new Error("C2 Rule B has a not-charged ring on 2026-10-10");
  }
  for (const uid of ["CNHL-2026-007", "CNHL-2026-009", "CNHL-2026-010", "CNHL-2026-011", "CNHL-2026-012"]) {
    const listed = packNights(uid).find((item) => item.session === night);
    if (!listed || listed.kind !== "measured" || listed.point.provisional) {
      throw new Error(`${uid} 2026-10-10 row is missing or still marked provisional`);
    }
    const meta = lineMeta(uid);
    if (meta.service[index] == null) throw new Error(`${uid} is out of service on 2026-10-10`);
    const chart = chartLine(uid, alignUid(uid, (row) => row.avg), meta.service, meta.logged, restFlags(uid));
    if (ringNights(chart).includes(night) || seriesNotCharged(chart, index)) {
      throw new Error(`${uid} is marked not charged on 2026-10-10`);
    }
  }
  const resting = packNights("CNHL-2026-008").find((item) => item.session === night);
  if (!resting || resting.kind !== "rest-pool") throw new Error("C2-P2 2026-10-10 should stay Rest pool");
  const nightIds = model.categories.map((category) => category.id);
  for (const pick of ["avg", "spread", "floor"] as const) {
    const lines = seriesOf(c2Rest.packs, pick);
    if (allNotCharged(lines, nightIds).includes(night) || gapPhrase(lines, nightIds, index).includes("Not charged")) {
      throw new Error(`C2 ${pick} chart calls 2026-10-10 not charged`);
    }
    if (!axisNightVisible(lines, index)) {
      throw new Error(`C2 ${pick} chart hid the published 2026-10-10 axis tick`);
    }
  }
  const skipNight = model.categories.findIndex((category) => category.id === "2026-09-26");
  const c2Avg = seriesOf(c2Rest.packs, "avg");
  if (skipNight < 0 || !axisNightVisible(c2Avg, skipNight)) {
    throw new Error("C2 pack chart hid 2026-09-26, a real not-charged night");
  }
  const meanLines: ChartSeries[] = model.mean.map((line) => ({
    id: line.id,
    label: line.id,
    color: line.color,
    values: line.values,
    service: line.service,
    unpublished: line.unpublished,
    provisional: line.provisional,
  }));
  if (!axisNightVisible(meanLines, index) || !axisNightVisible(meanLines.filter((line) => line.id === "C2"), index)) {
    throw new Error("2026-10-10 axis tick is hidden on a chart that has C2's published mean");
  }
  const ruleLines: ChartSeries[] = model.fleets
    .filter((fleet) => fleet.rest.some((value) => value != null))
    .map((fleet) => ({
      id: fleet.id,
      label: fleet.id,
      color: "#888",
      values: fleet.rest,
      na: fleet.restNa,
      service: fleet.restService,
      unpublished: fleet.unpublished,
    }));
  if (!axisNightVisible(ruleLines, index) || !axisNightVisible(ruleLines.filter((line) => line.id === "C2"), index)) {
    throw new Error("2026-10-10 axis tick is hidden on a chart that has C2 Rule B");
  }
  const c1Pack = getPack("CNHL-2026-003");
  const c2Pack = getPack("CNHL-2026-007");
  if (!c1Pack || !axisNightVisible(c1Pack.cellSeries, index) || c1Pack.cellSeries.some((line) => line.provisional?.[index])) {
    throw new Error("C1-P3 chart hid 2026-10-10 or marked validated IR provisional");
  }
  if (
    !c2Pack ||
    !axisNightVisible([...c2Pack.cellSeries, ...c2Pack.spreadSeries, ...c2Pack.floorSeries], index) ||
    c2Pack.cellSeries.some((line) => line.provisional?.[index]) ||
    c2Pack.spreadSeries.some((line) => line.provisional?.[index]) ||
    c2Pack.floorSeries.some((line) => line.provisional?.[index])
  ) {
    throw new Error("C2-P1 chart hid 2026-10-10 or marked validated IR provisional");
  }
}

const EXPECTED_CHIPS: Record<string, StatusChipName> = {
  "C1-P1": "GO",
  "C1-P2": "GO",
  "C1-P3": "GO",
  "C1-P4": "GO",
  "C1-P5": "GO",
  "C1-P6": "GO",
  "C2-P1": "GO",
  "C2-P2": "GO",
  "C2-P3": "GO",
  "C2-P4": "GO",
  "C2-P5": "GO",
  "C2-P6": "GO",
  "C3-P1": "GO",
  "C3-P2": "GO",
  "C3-P3": "GO",
  "C3-P4": "GO",
  "C3-P5": "GO",
  "C3-P6": "GO",
  "C4-P1": "GO",
  "C4-P2": "GO",
  "C4-P3": "GO",
  "C4-P4": "GO",
  "C4-P5": "GO",
  "C4-P6": "GO",
};

function assertStatusChips() {
  const rows = statusRows();
  if (rows.length !== 24) throw new Error(`Expected 24 packs for status chips, got ${rows.length}`);
  const seen = new Map<string, StatusChipName>();
  for (const row of rows) {
    const chip = statusChip(row.status, row.chargeMode);
    if (!STATUS_CHIPS.includes(chip) || seen.has(row.label)) {
      throw new Error(`${row.label} did not map to exactly one status chip`);
    }
    seen.set(row.label, chip);
    if (EXPECTED_CHIPS[row.label] !== chip) {
      throw new Error(`${row.label} chip is ${chip}, expected ${EXPECTED_CHIPS[row.label]}`);
    }
  }
  if (statusChip("PARALLEL GO | SERVICE Watch (IR spread)") !== "GO") {
    throw new Error("Parallel Go must outrank a service Watch note");
  }
  if (statusChip("SERVICE D pool (Watch)") !== "WATCH") {
    throw new Error("D pool or Watch with no parallel action must be WATCH");
  }
  if (statusChip("PARALLEL OFF (Rest pool) | SERVICE D pool (Watch)", "individual") !== "REST") {
    throw new Error("Rest pool must outrank D pool and charging alone");
  }
  const c2p6 = rows.find((row) => row.label === "C2-P6");
  const c2p6Calls = callsFor("CNHL-2026-012").filter((call) => call.date === "2026-10-10");
  if (
    c2p6Calls.length !== 2 ||
    c2p6Calls[0]?.status !== "PARALLEL GO | SERVICE In service" ||
    !c2p6Calls[1]?.status.startsWith("PARALLEL GO (conditional:")
  ) {
    throw new Error("C2-P6 is missing the two 2026-10-10 calls");
  }
  const c2p6Latest = callsFor("CNHL-2026-012").filter((call) => countsAsStatus(call)).at(-1);
  if (
    !c2p6 ||
    !c2p6Latest ||
    c2p6.status !== c2p6Latest.status ||
    c2p6.status !== "PARALLEL GO: on the C2 board | SERVICE In service" ||
    c2p6.session !== "2026-10-16"
  ) {
    throw new Error(`C2-P6 latest call is ${c2p6?.session} ${c2p6?.status}`);
  }
  if (statusChip(c2p6.status, c2p6.chargeMode) !== "GO") {
    throw new Error("C2-P6 Go must stay the one word GO");
  }
  const c1p5 = rows.find((row) => row.label === "C1-P5");
  const c1p5Tile = seriesBlocks()
    .flatMap((block) => block.slots)
    .find((slot) => slot.label === "C1-P5");
  if (
    !c1p5 ||
    !c1p5Tile ||
    c1p5Tile.reason !== c1p5.reason ||
    c1p5.status !== "PARALLEL GO: on the C1 board | SERVICE In service" ||
    !c1p5.reason.includes("rules v7") ||
    !c1p5.reason.includes("low Cell 4 is a performance note") ||
    statusChip(c1p5.status, c1p5.chargeMode) !== "GO"
  ) {
    throw new Error("C1-P5 card must show the recorded GO");
  }
  const c4p2 = rows.find((item) => item.label === "C4-P2");
  if (
    !c4p2 ||
    c4p2.status !== "PARALLEL GO: on the C4 board | SERVICE In service" ||
    !c4p2.reason.includes("low Cell 6 on 2026-10-14 and 2026-10-16 is a performance note") ||
    statusChip(c4p2.status, c4p2.chargeMode) !== "GO"
  ) {
    throw new Error(`C4-P2 call is ${c4p2?.session} ${c4p2?.status}`);
  }
  const c4p4 = rows.find((item) => item.label === "C4-P4");
  if (
    !c4p4 ||
    c4p4.status !== "PARALLEL GO: on the C4 board | SERVICE In service" ||
    !c4p4.reason.startsWith("No change: stays on the C4 board.") ||
    c4p4.session !== "2026-10-16" ||
    statusChip(c4p4.status, c4p4.chargeMode) !== "GO"
  ) {
    throw new Error(`C4-P4 call is ${c4p4?.session} ${c4p4?.status}`);
  }
  for (const label of ["C3-P5", "C3-P6"]) {
    const row = rows.find((item) => item.label === label);
    if (
      !row ||
      row.status !== "PARALLEL GO: on the C3 board | SERVICE In service" ||
      !row.reason.includes("rules v7") ||
      statusChip(row.status, row.chargeMode) !== "GO"
    ) {
      throw new Error(`${label} should stay Go on the C3 board`);
    }
  }
  if (
    statusChip("PARALLEL Go (watch) — INDIVIDUAL until the join rule completes | SERVICE New (watch)", "individual") !== "GO"
  ) {
    throw new Error("Go (watch) must stay GO when the pack charges alone");
  }
}

function chartLine(
  label: string,
  values: (number | null)[],
  service?: (string | null)[],
  logged?: boolean[],
  rest?: boolean[],
  na?: boolean[],
): ChartSeries {
  return { id: label, label, color: "#888", values, service, logged, rest, na };
}

function ringNights(series: ChartSeries): string[] {
  return openEndIndices(series).map((index) => categories[index].id);
}

function assertJoined(series: ChartSeries, mode: ChartMode, label: string) {
  const readings = readingIndices(series);
  const segments = lineSegments(series, mode);
  if (segments.length !== Math.max(0, readings.length - 1)) {
    throw new Error(`${label} has ${readings.length} readings and ${segments.length} segments`);
  }
  if (openEndIndices(series, mode).length !== 0) {
    throw new Error(`${label} still draws a hollow ring`);
  }
  const lone = lonePointIndices(series, mode);
  if (readings.length <= 1) {
    if (lone.length !== readings.length) throw new Error(`${label} lone marker does not match its single reading`);
    return;
  }
  if (lone.length !== 0) throw new Error(`${label} draws a lone dot beside a line`);
  for (let index = 1; index < readings.length; index += 1) {
    const segment = segments[index - 1];
    if (!segment || segment.from !== readings[index - 1] || segment.to !== readings[index]) {
      throw new Error(`${label} broke between readings ${readings[index - 1]} and ${readings[index]}`);
    }
  }
}

function assertNoInteriorRing(series: ChartSeries, label: string) {
  const bad = interiorRingIndices(series, "pack");
  if (bad.length === 0) return;
  const nights = bad.map((index) => categories[index]?.id ?? String(index)).join(", ");
  throw new Error(`${label} ring on ${nights} sits before a later real point in the same span`);
}

function assertAggregateQuiet(series: ChartSeries, nightIds: string[], label: string) {
  const dotted = missBridges(series, nightIds, "aggregate");
  if (dotted.length !== 0) {
    throw new Error(`${label} has a dotted join in aggregate mode`);
  }
  const rings = openEndIndices(series, "aggregate");
  if (rings.length !== 0) {
    throw new Error(`${label} has a ring in aggregate mode`);
  }
}

function assertGapGeometry(model: FleetModel) {
  const sample: ChartSeries = {
    id: "sample",
    label: "sample",
    color: "#888",
    values: [null, 1, null, null, 2, null],
    service: ["0", "0", "0", null, "0", "0"],
  };
  const sampleRings = openEndIndices(sample);
  if (sampleRings.length !== 0 || interiorRingIndices(sample).length !== 0) {
    throw new Error("a skipped night before the first reading or after the last was ringed");
  }
  const sampleBridge = missBridges(sample, ["a", "b", "c", "d", "e", "f"]);
  if (sampleBridge.length !== 1 || sampleBridge[0].from !== 1 || sampleBridge[0].to !== 4) {
    throw new Error("dotted join did not cross a genuine skip and a span hole");
  }
  if (solidFrom(sample, 4, "pack") !== -1) throw new Error("a pack line crossed a night with no reading");
  if (solidFrom(sample, 4, "aggregate") !== 1) {
    throw new Error("an aggregate line did not run solid through a skipped night");
  }
  if (missBridges(sample, ["a", "b", "c", "d", "e", "f"], "aggregate").length !== 0) {
    throw new Error("an aggregate line drew a dotted join");
  }
  if (openEndIndices(sample, "aggregate").length !== 0) {
    throw new Error("an aggregate line drew a ring");
  }
  const movedSpan: ChartSeries = {
    id: "moved",
    label: "moved",
    color: "#888",
    values: [1, null, 2],
    service: ["0", "0", "1"],
  };
  if (solidFrom(movedSpan, 2, "aggregate") !== 0 || missBridges(movedSpan, ["a", "b", "c"], "aggregate").length !== 0) {
    throw new Error("an aggregate line broke across a move");
  }
  if (solidFrom(movedSpan, 2, "pack") !== -1 || missBridges(movedSpan, ["a", "b", "c"], "pack").length !== 1) {
    throw new Error("a pack line did not draw a dotted join across a move when the night between was not charged");
  }
  const holeOnly: ChartSeries = {
    id: "hole",
    label: "hole",
    color: "#888",
    values: [1, null, 2],
    service: ["0", null, "0"],
  };
  if (solidFrom(holeOnly, 2) !== 0) throw new Error("a solid line broke across a span hole");
  if (missBridges(holeOnly, ["a", "b", "c"]).length !== 0) {
    throw new Error("a span hole with readings on both sides was drawn dotted");
  }
  const held: ChartSeries = {
    id: "held",
    label: "held",
    color: "#888",
    values: [1, null, 2],
    service: ["0", null, "0"],
    unpublished: [false, true, false],
  };
  if (
    solidFrom(held, 2, "pack") !== 0 ||
    solidFrom(held, 2, "aggregate") !== 0 ||
    missBridges(held, ["a", "b", "c"], "pack").length !== 0 ||
    missBridges(held, ["a", "b", "c"], "aggregate").length !== 0
  ) {
    throw new Error("an unpublished night broke the line between two readings");
  }

  const nightIds = model.categories.map((category) => category.id);
  const indexOf = (id: string) => {
    const index = nightIds.indexOf(id);
    if (index < 0) throw new Error(`missing night ${id}`);
    return index;
  };
  const fromV4 = (session: string, series: string): number | null => {
    const rows = measurements.filter(
      (row) => row.session === session && row.series === series && !isNonStorage(row.sessionType),
    );
    if (rows.length === 0) return null;
    return rows.reduce((sum, row) => sum + row.avg, 0) / rows.length;
  };
  const meanLine = (id: string): ChartSeries => {
    const line = model.mean.find((item) => item.id === id);
    if (!line) throw new Error(`missing ${id} series mean`);
    return {
      id,
      label: id,
      color: line.color,
      values: line.values,
      service: line.service,
      unpublished: line.unpublished,
    };
  };
  for (const series of ["C1", "C2", "C3", "C4"]) {
    const line = meanLine(series);
    nightIds.forEach((night, index) => {
      const expected = fromV4(night, series);
      const actual = line.values[index];
      if (expected == null) {
        if (actual != null) throw new Error(`${series} mean plotted ${actual} on ${night}, which has no v4 reading`);
        return;
      }
      if (actual == null || Math.abs(actual - expected) > 0.0005) {
        throw new Error(`${series} mean on ${night} is ${actual}, v4 mean is ${expected}`);
      }
    });
    assertAggregateQuiet(line, nightIds, `${series} mean`);
  }

  const c1 = meanLine("C1");
  const c2 = meanLine("C2");
  const packJoined = (series: ChartSeries, from: string, to: string) =>
    missBridges(series, nightIds, "pack").some((bridge) => nightIds[bridge.from] === from && nightIds[bridge.to] === to);
  // C1-P1's 2026-10-09 reading is a C1 mean point (label registry), so the C1 mean runs 2026-09-27, 2026-10-09, 2026-10-10.
  if (solidFrom(c1, indexOf("2026-10-10"), "aggregate") !== indexOf("2026-10-09") || solidFrom(c1, indexOf("2026-10-09"), "aggregate") !== indexOf("2026-09-27")) {
    throw new Error("C1 mean does not solid-join 2026-09-27, 2026-10-09 and 2026-10-10");
  }
  if (solidFrom(c2, indexOf("2026-10-10"), "aggregate") !== indexOf("2026-09-30")) {
    throw new Error("C2 mean does not solid-join 2026-09-30 to 2026-10-10");
  }
  if (solidFrom(c2, indexOf("2026-09-30"), "aggregate") !== indexOf("2026-09-27")) {
    throw new Error("C2 mean must solid-join 2026-09-27 to 2026-09-30");
  }
  if (packJoined(c1, "2026-09-27", "2026-10-09") && solidFrom(c1, indexOf("2026-10-09"), "pack") !== -1) {
    throw new Error("pack mode solid-joined a genuine skip on the C1 mean shape");
  }
  if (!packJoined(c1, "2026-09-27", "2026-10-09") || solidFrom(c1, indexOf("2026-10-09"), "pack") !== -1) {
    throw new Error("pack mode lost the dotted join across a genuine skip");
  }
  for (const line of [c1, c2]) {
    if (lonePointIndices(line, "aggregate").includes(indexOf("2026-10-10"))) {
      throw new Error(`${line.id} mean draws 2026-10-10 as an isolated dot`);
    }
  }
  const meanLegend = legendNote([c1, c2], nightIds, "aggregate");
  if (meanLegend != null && /not charged/i.test(meanLegend)) {
    throw new Error("aggregate legend still says not charged");
  }

  const meanLines = ["C1", "C2"].map((id) => meanLine(id));
  const restIndex = indexOf("2026-10-09-restday0");
  if (axisNightVisible(meanLines, restIndex, "2026-10-09-restday0")) {
    throw new Error("10-09r is an axis tick on the series mean chart");
  }
  if (!axisNightVisible(meanLines, indexOf("2026-10-09"), "2026-10-09")) {
    throw new Error("2026-10-09 lost its axis tick on the series mean chart");
  }
  if (!axisNightVisible(meanLines, indexOf("2026-10-10"), "2026-10-10")) {
    throw new Error("2026-10-10 lost its axis tick on the series mean chart");
  }

  for (const fleet of model.fleets) {
    const rule = chartLine(fleet.id, fleet.rest, fleet.restService, undefined, undefined, fleet.restNa);
    assertAggregateQuiet(rule, nightIds, `${fleet.id} Rule B`);
    if (axisNightVisible([rule], restIndex, "2026-10-09-restday0")) {
      throw new Error(`${fleet.id} Rule B shows a 10-09r axis tick`);
    }
    const ruleLegend = legendNote([rule], nightIds, "aggregate");
    if (ruleLegend != null && /not charged/i.test(ruleLegend)) {
      throw new Error(`${fleet.id} Rule B legend says not charged`);
    }
    for (const pack of fleet.packs) {
      for (const values of [pack.historyAvg, pack.historySpread, pack.historyFloor, ...pack.historyCells]) {
        const chart = chartLine(`${fleet.id} ${pack.uid}`, values, pack.service, pack.logged, pack.rest);
        assertAggregateQuiet(chart, nightIds, `${fleet.id} ${pack.uid} fleet chart`);
        assertNoInteriorRing(chart, `${fleet.id} ${pack.uid}`);
        assertJoined(chart, "aggregate", `${fleet.id} ${pack.uid} fleet chart`);
      }
    }
  }
  const c1p2 = getPack("CNHL-2026-002");
  const c2p1 = getPack("CNHL-2026-007");
  if (!c1p2 || !c2p1) throw new Error("missing C1-P2 or C2-P1 pack chart");
  const c1PackLine = c1p2.cellSeries[0];
  const c2PackLine = c2p1.cellSeries[0];
  if (!c1PackLine || !packJoined(c1PackLine, "2026-09-27", "2026-10-10")) {
    throw new Error("C1-P2 pack chart lost the dotted join from 2026-09-27 to 2026-10-10");
  }
  if (!c2PackLine || !packJoined(c2PackLine, "2026-09-30", "2026-10-10")) {
    throw new Error("C2-P1 pack chart lost the dotted join from 2026-09-30 to 2026-10-10");
  }
  if (solidFrom(c1PackLine, indexOf("2026-10-10"), "pack") !== -1) {
    throw new Error("C1-P2 pack chart solid-joined a night it was not charged");
  }
  for (const line of [...c1p2.cellSeries, ...c1p2.spreadSeries, ...c1p2.floorSeries, ...c2p1.cellSeries, ...c2p1.spreadSeries, ...c2p1.floorSeries]) {
    assertNoInteriorRing(line, line.id);
    assertJoined(line, "pack", line.id);
  }
  // Label registry: CNHL-2026-001 is one continuous C1-P1 line (15 readings) on its page and on the C1 chart.
  const p1 = getPack("CNHL-2026-001");
  if (!p1 || p1.label !== "C1-P1" || p1.series !== "C1") throw new Error("missing C1-P1 pack chart");
  if (p1.points.length !== 15 || p1.points.some((point) => point.label !== "C1-P1" || point.series !== "C1")) {
    throw new Error(`C1-P1 should have 15 C1-P1 readings, has ${p1.points.length}`);
  }
  for (const line of [...p1.cellSeries, ...p1.spreadSeries, ...p1.floorSeries]) {
    assertJoined(line, "pack", `C1-P1 ${line.label}`);
    if (readingIndices(line).length !== 15) throw new Error(`C1-P1 ${line.label} has ${readingIndices(line).length} readings`);
    const segments = lineSegments(line, "pack");
    if (segments.length !== 14) throw new Error(`C1-P1 ${line.label} has ${segments.length} segments, expected 14`);
    const into09 = segments.find((segment) => segment.to === indexOf("2026-10-09"));
    const into17 = segments.find((segment) => segment.to === indexOf("2026-10-17"));
    if (!into09 || into09.from !== indexOf("2026-09-27") || !into17 || into17.from !== indexOf("2026-10-09")) {
      throw new Error(`C1-P1 ${line.label} does not join 2026-09-27, 2026-10-09 and 2026-10-17`);
    }
  }
  const c3p2 = getPack("CNHL-2026-014");
  const noLogNight = c3p2?.nights.find((night) => night.session === "2026-10-17");
  if (!c3p2 || !noLogNight || noLogNight.kind !== "charged-no-log") {
    throw new Error("C3-P2 2026-10-17 should read as charged with no log");
  }
  if (allNotCharged([...c3p2.cellSeries, ...c3p2.spreadSeries, ...c3p2.floorSeries], nightIds).includes("2026-10-17")) {
    throw new Error("C3-P2 chart still captions 2026-10-17 as not charged");
  }
  for (const line of [...c3p2.cellSeries, ...c3p2.spreadSeries, ...c3p2.floorSeries]) {
    if (seriesNotCharged(line, indexOf("2026-10-17"))) throw new Error(`C3-P2 ${line.label} marks 2026-10-17 not charged`);
    if (openEndIndices(line, "pack").length !== 0) throw new Error(`C3-P2 ${line.label} draws a not-charged ring`);
    if (readingIndices(line).length !== 2 || lonePointIndices(line, "pack").length !== 0) {
      throw new Error(`C3-P2 ${line.label} should stay two joined readings`);
    }
    assertJoined(line, "pack", `C3-P2 ${line.label}`);
  }
  const c1FleetPack = model.fleets.find((fleet) => fleet.id === "C1")?.packs.find((pack) => pack.uid === "CNHL-2026-001");
  if (!c1FleetPack || c1FleetPack.avg[indexOf("2026-10-09")] == null) throw new Error("C1-P1 is missing from the C1 series chart");
  {
    const trend = chartLine(c1FleetPack.uid, c1FleetPack.historyAvg, c1FleetPack.service, c1FleetPack.logged, c1FleetPack.rest);
    assertJoined(trend, "aggregate", "C1-P1 series trend");
    const through = lineSegments(trend, "aggregate").find(
      (segment) => segment.from === indexOf("2026-10-09") && segment.to === indexOf("2026-10-17"),
    );
    if (!through || through.style !== "solid") throw new Error("C1 series chart did not join C1-P1's 2026-10-09 and 2026-10-17 readings");
  }
}

/** Every plotted line joins its recorded readings. Hollow rings are not drawn. */
function assertRingWindows(model: FleetModel) {
  for (const line of model.mean) {
    const chart = chartLine(line.id, line.values, line.service);
    assertJoined(chart, "aggregate", `${line.id} mean`);
    assertNoInteriorRing(chart, `${line.id} mean`);
    if (ringNights(chart).length !== 0) throw new Error(`${line.id} mean still draws a hollow ring`);
  }

  if (model.mean.some((line) => line.id === "D")) throw new Error("series D mean is still on the site");
  {
    const c1Mean = model.mean.find((line) => line.id === "C1");
    const at09 = c1Mean?.values[categories.findIndex((category) => category.id === "2026-10-09")];
    if (at09 == null || at09.toFixed(3) !== "2.767") throw new Error(`C1 mean on 2026-10-09 is ${at09}`);
  }

  for (const fleet of model.fleets) {
    const restChart = chartLine(fleet.id, fleet.rest, fleet.restService, undefined, undefined, fleet.restNa);
    assertJoined(restChart, "aggregate", `${fleet.id} Rule B`);
    assertNoInteriorRing(restChart, `${fleet.id} Rule B`);
    for (const pack of fleet.packs) {
      const lines = [pack.historyAvg, pack.historySpread, pack.historyFloor, ...pack.historyCells];
      for (const values of lines) {
        const chart = chartLine(`${fleet.id} ${pack.uid}`, values, pack.service, pack.logged, pack.rest);
        assertJoined(chart, "aggregate", `${fleet.id} ${pack.uid}`);
        if (ringNights(chart).length !== 0) {
          throw new Error(`${fleet.id} ${pack.uid} still draws a hollow ring`);
        }
      }
    }
  }

  for (const pack of packs) {
    const meta = lineMeta(pack.uid);
    const rest = restFlags(pack.uid);
    const lines = [
      alignUid(pack.uid, (row) => row.avg),
      alignUid(pack.uid, (row) => row.spread),
      alignUid(pack.uid, (row) => row.floor),
      alignUid(pack.uid, (row) => row.cells[0] ?? null),
    ];
    for (const values of lines) {
      const chart = chartLine(pack.uid, values, meta.service, meta.logged, rest);
      assertJoined(chart, "pack", pack.uid);
      if (ringNights(chart).length !== 0) throw new Error(`${pack.uid} still draws a hollow ring`);
    }
  }
  // Label registry: C1-P1 has one occupant for its whole history, so no past occupant span.
  const c1p1Slot = getSlot("C1-P1");
  if (!c1p1Slot || c1p1Slot.past.length !== 0) throw new Error(`C1-P1 should have no past occupant, has ${c1p1Slot?.past.length}`);
  if (getSlot("D-1")) throw new Error("a D-1 slot is still on the site");
  if (publicSession("S263") !== "undated" || shownWhen("S413", "2026-09-22") !== "2026-09-22") {
    throw new Error("session id leaked into a date label");
  }
  if (/\bS\d{3}\b/.test(publicProse("spreads (S263/S358/S413), same shape as S386"))) {
    throw new Error("prose still shows a session id");
  }
}

function assertCellJoinsFollowPack() {
  const service = ["0", "0", "0"];
  const hole = lineSegments(chartLine("hole", [1, null, 2], service, [true, true, true]), "pack");
  const full = lineSegments(chartLine("full", [1, 1.2, 2], service, [true, true, true]), "pack");
  const skipped = lineSegments(chartLine("skip", [1, null, 2], service, [true, false, true]), "pack");
  if (hole.length !== 1 || hole[0].style !== "solid") {
    throw new Error(`a missing cell on a charged night changed the join: ${hole.map((segment) => segment.style).join(",")}`);
  }
  if (full.length !== 2 || full.some((segment) => segment.style !== "solid")) {
    throw new Error(`pack-charged joins were ${full.map((segment) => segment.style).join(",")}`);
  }
  if (skipped.length !== 1 || skipped[0].style !== "dotted") {
    throw new Error(`an uncharged night stayed ${skipped.map((segment) => segment.style).join(",")}`);
  }
  for (const pack of packs) {
    const view = getPack(pack.uid);
    if (!view) continue;
    const signatures = view.cellSeries.map((line) =>
      lineSegments(line, "pack")
        .map((segment) => `${segment.from}-${segment.to}-${segment.style}`)
        .join(" "),
    );
    if (new Set(signatures).size !== 1) {
      throw new Error(`${pack.uid} per-cell charts disagree on join style`);
    }
  }
}

assertCellJoinsFollowPack();
assertDerived();
