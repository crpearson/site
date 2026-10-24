import fs from "node:fs";
import path from "node:path";
import metaDoc from "@/data/meta.json";
import registryDoc from "@/data/pack-registry.json";
import statusDoc from "@/data/status.json";
import { allNotCharged, axisNightVisible, gapPhrase, interiorRingIndices, legendNote, lineSegments, lonePointIndices, missBridges, openEndIndices, readingIndices, seriesNotCharged, solidFrom, type ChartMode } from "@/lib/bridges";
import { packColor, seriesColor } from "@/lib/color";
import { parseCsv } from "@/lib/csv";
import { formatValue, publicProse, publicSession, shortSession, shownWhen } from "@/lib/format";
import { IR_UNIT, scaleStoredIr } from "@/lib/ir";
import { irValidationIsProvisional } from "@/lib/ir-validation.mjs";
import {
  lampTone,
  splitCall,
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
type LabelMap = {
  date: string;
  uid: string;
  label: string;
  series: string;
  appliesTo: string;
  hidden: string[];
};
const labelRegistry: LabelMap[] = readCsv("v2/label_registry.csv").map((row) => ({
  date: row.date,
  uid: row.pack_uid,
  label: row.display_label,
  series: row.display_series,
  appliesTo: row.applies_to,
  hidden: row.hidden_labels.split("|").map((item) => item.trim()).filter(Boolean),
}));
const hiddenPool = /\b(?:the\s+)?D[ -]pool\b/gi;
/** Latest dated registry row for this serial. S-session ids sort before calendar dates. */
function mapOf(uid: string): LabelMap | undefined {
  let latest: LabelMap | undefined;
  for (const item of labelRegistry) {
    if (item.uid !== uid) continue;
    if (!latest || compareTime(item.date, latest.date) > 0) latest = item;
  }
  return latest;
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
  const current = mapOf(pack.uid);
  if (!current) continue;
  // Current slot comes from the latest registry override. Packs with no row keep packs.csv.
  pack.label = current.label;
  pack.series = current.series;
  pack.pool = "";
}

/**
 * Last storage comes from the session manifest, not the IR store. A held IR row
 * still has a storage slot. Slot labels resolve through the label registry
 * (display label and hidden labels, when that row covers the session) and
 * otherwise through the current packs.csv label.
 */
const manifestRows = readCsv("v2/session_manifest.public.csv");

function registryCovers(row: LabelMap, session: string): boolean {
  if (row.appliesTo.trim().toLowerCase() === "all dates") return true;
  const day = session.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? session;
  return row.date === session || row.date === day;
}

function serialForSlot(label: string, session: string): string | null {
  const claimed = new Set<string>();
  for (const row of labelRegistry) {
    if (!registryCovers(row, session)) continue;
    if (row.label === label || row.hidden.includes(label)) claimed.add(row.uid);
  }
  if (claimed.size === 1) return [...claimed][0];
  if (claimed.size > 1) return null;
  return packs.find((pack) => pack.label === label)?.uid ?? null;
}

/** Manifest storage modes. `single-series` counts if it appears; this file uses individual and parallel. */
function manifestIsStorage(session: string, mode: string): boolean {
  if (session.endsWith("-restday0")) return false;
  const normalized = mode.trim().toLowerCase();
  if (normalized === "individual charge" || normalized === "charge-run") return false;
  return normalized === "individual" || normalized === "parallel" || normalized === "single-series";
}

const lastStorageByUid = new Map<string, string>();
for (const row of manifestRows) {
  if (!manifestIsStorage(row.session, row.mode)) continue;
  for (const label of row.slots.split("|").map((item) => item.trim()).filter(Boolean)) {
    const uid = serialForSlot(label, row.session);
    if (!uid) continue;
    const prev = lastStorageByUid.get(uid);
    if (!prev || compareTime(row.session, prev) > 0) lastStorageByUid.set(uid, row.session);
  }
}

export function lastStorageSession(uid: string): string | null {
  return lastStorageByUid.get(uid) ?? null;
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

type HomeChannelRow = { label?: string; series?: string };

/** Series order and slot labels from data/v2/next_charge.json. A new series is a data edit. */
function readChargeLists(): { seriesOrder: string[]; slotLabels: string[] } {
  const doc = JSON.parse(fs.readFileSync(path.join(dataDir, "v2/next_charge.json"), "utf8")) as {
    home_channels?: HomeChannelRow[];
    planner_rules?: { series_order?: unknown };
  };
  const raw = doc.planner_rules?.series_order;
  const listed = Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
  const seen: string[] = [];
  const slotLabels: string[] = [];
  for (const row of doc.home_channels ?? []) {
    if (row.series && !seen.includes(row.series)) seen.push(row.series);
    if (row.label) slotLabels.push(row.label);
  }
  return { seriesOrder: listed.length > 0 ? listed : seen, slotLabels };
}

const chargeLists = readChargeLists();
const SERIES_ORDER = chargeLists.seriesOrder;
const HOME_SLOT_LABELS = chargeLists.slotLabels;

function assertStore() {
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
  const fleet = packs.filter((pack) => !pack.retired);
  if (fleet.length !== HOME_SLOT_LABELS.length || fleet.some((pack) => !HOME_SLOT_LABELS.includes(pack.label))) {
    throw new Error(`the fleet should be ${HOME_SLOT_LABELS.length} packs, one per home-channel slot`);
  }
  if (packs.some((pack) => pack.label.startsWith("D-"))) throw new Error("a D pack is still on the site");
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
  lastStorage: string | null;
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
    lastStorage: lastStorageSession(uid),
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

export type PackRoute = { uid: string; alias: boolean };

/** Serial pages only. A slot label is not a pack URL. */
export function resolvePackRoute(id: string): PackRoute | null {
  const uid = packUids().find((item) => item.toLowerCase() === id.toLowerCase());
  if (!uid) return null;
  return { uid, alias: uid !== id };
}

export function packRouteIds(): string[] {
  const ids = new Set<string>();
  for (const uid of packUids()) {
    ids.add(uid);
    ids.add(uid.toLowerCase());
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
  if (stats.counted !== 24) {
    throw new Error(`Fleet headline counted ${stats.counted}, expected 24 slotted packs`);
  }
  const model = fleetModel();
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
  if (!moved || moved.avg[day] == null) throw new Error("C1-P1 2026-10-09 is missing from the C1 line");
  if (model.fleets.some((fleet) => fleet.id === "D")) throw new Error("series D is still on the site");
  const p4 = c1Fleet?.packs.find((pack) => pack.uid === "CNHL-2026-004");
  if (!p4 || p4.avg[restNightIndex] != null) throw new Error("C1-P4 rest-day row is on a series line");
  if (c1Fleet && c1Fleet.rest[restNightIndex] != null) throw new Error("Rule B plotted the rest-day night");
  {
    const n17 = model.categories.findIndex((category) => category.id === "2026-10-17");
    if (n17 < 0 || model.fleets.some((fleet) => fleet.rest[n17] != null)) throw new Error("a Rule B value is recorded for 2026-10-17");
  }
  const heldNight = model.categories.findIndex((category) => category.id === "2026-10-10");
  if (heldNight < 0) throw new Error("2026-10-10 is missing from the chart");
  const board = nextParallel();
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
  if (!c2Card || c2Card.provisional) {
    throw new Error(`C2-P1 card provisional=${c2Card?.provisional}`);
  }
  if (!c1Card || c1Card.provisional) throw new Error("C1-P3 card is marked provisional");
  const c2Mean = model.mean.find((line) => line.id === "C2");
  if (!c2Mean || c2Mean.service?.[index] == null || c2Mean.values[index] == null) {
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
  if (!c2Rest || c2Rest.restService[index] == null || c2Rest.rest[index] == null) {
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
    const latest = callsFor(row.uid).filter((call) => countsAsStatus(call)).at(-1);
    if (!latest || row.status !== latest.status) {
      throw new Error(`${row.label} card does not show its latest call`);
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
  // Label registry: CNHL-2026-001 is one continuous C1-P1 line on its page and on the C1 chart.
  const p1 = getPack("CNHL-2026-001");
  if (!p1 || p1.label !== "C1-P1" || p1.series !== "C1") throw new Error("missing C1-P1 pack chart");
  if (p1.points.some((point) => point.label !== "C1-P1" || point.series !== "C1")) {
    throw new Error("C1-P1 chart has a reading that is not labeled C1-P1");
  }
  for (const line of [...p1.cellSeries, ...p1.spreadSeries, ...p1.floorSeries]) {
    assertJoined(line, "pack", `C1-P1 ${line.label}`);
    const segments = lineSegments(line, "pack");
    const into09 = segments.find((segment) => segment.to === indexOf("2026-10-09"));
    const into17 = segments.find((segment) => segment.to === indexOf("2026-10-17"));
    const into18 = segments.find((segment) => segment.to === indexOf("2026-10-18"));
    if (!into09 || into09.from !== indexOf("2026-09-27") || !into17 || into17.from !== indexOf("2026-10-09") || !into18 || into18.from !== indexOf("2026-10-17")) {
      throw new Error(`C1-P1 ${line.label} does not join 2026-09-27, 2026-10-09, 2026-10-17 and 2026-10-18`);
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
    if (lonePointIndices(line, "pack").length !== 0) {
      throw new Error(`C3-P2 ${line.label} draws a lone dot`);
    }
    assertJoined(line, "pack", `C3-P2 ${line.label}`);
  }
  const c1FleetPack = model.fleets.find((fleet) => fleet.id === "C1")?.packs.find((pack) => pack.uid === "CNHL-2026-001");
  if (!c1FleetPack || c1FleetPack.avg[indexOf("2026-10-09")] == null) throw new Error("C1-P1 is missing from the C1 series chart");
  {
    const trend = chartLine(c1FleetPack.uid, c1FleetPack.historyAvg, c1FleetPack.service, c1FleetPack.logged, c1FleetPack.rest);
    assertJoined(trend, "aggregate", "C1-P1 series trend");
    const trendSegments = lineSegments(trend, "aggregate");
    const through = trendSegments.find(
      (segment) => segment.from === indexOf("2026-10-09") && segment.to === indexOf("2026-10-17"),
    );
    if (!through || through.style !== "solid") throw new Error("C1 series chart did not join C1-P1's 2026-10-09 and 2026-10-17 readings");
    const into18 = trendSegments.find((segment) => segment.to === indexOf("2026-10-18"));
    if (!into18 || into18.from !== indexOf("2026-10-17") || into18.style !== "solid") {
      throw new Error("C1 series chart did not draw a line from 2026-10-17 to 2026-10-18");
    }
    if (trend.values[indexOf("2026-10-18-charge")] != null) {
      throw new Error("the 2026-10-18 charge run is on the C1 series line");
    }
  }
  for (const [uid, label] of [
    ["CNHL-2026-004", "C1-P4"],
    ["CNHL-2026-008", "C2-P2"],
  ] as const) {
    const pack = getPack(uid);
    if (!pack) throw new Error(`missing ${label}`);
    const charge = indexOf("2026-10-18-charge");
    const storage = indexOf("2026-10-18");
    for (const line of [...pack.cellSeries, ...pack.spreadSeries, ...pack.floorSeries]) {
      if (line.values[charge] != null) throw new Error(`${label} storage line includes the 2026-10-18 charge run`);
      if (line.values[storage] == null) throw new Error(`${label} is missing the 2026-10-18 storage point`);
      const into = lineSegments(line, "pack").find((segment) => segment.to === storage);
      if (!into || lonePointIndices(line, "pack").includes(storage)) {
        throw new Error(`${label} 2026-10-18 storage point is a dot, not a line`);
      }
    }
  }
  for (const pack of packs.filter((item) => item.series === "C1" || item.series === "C2")) {
    const chart = getPack(pack.uid);
    const storage = indexOf("2026-10-18");
    const line = chart?.cellSeries[0];
    const into = line ? lineSegments(line, "pack").find((segment) => segment.to === storage) : undefined;
    if (!line || line.values[storage] == null || !into || lonePointIndices(line, "pack").includes(storage)) {
      throw new Error(`${pack.label} 2026-10-18 storage point is not joined to its line`);
    }
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
    if (at09 == null) throw new Error(`C1 mean on 2026-10-09 is ${at09}`);
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

/**
 * Exact numbers from the current data snapshot. `scripts/check-snapshot.mjs`
 * sets CHECK_SNAPSHOT and loads this module. The site build does not.
 */
function assertSnapshot() {
  if (measurements.length !== 261 || v4Rows.length !== 261) {
    throw new Error(`Expected 261 measurements, got ${measurements.length}`);
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
  if (packByUid("CNHL-2026-004")?.chargeCount !== 16 || packByUid("CNHL-2026-008")?.chargeCount !== 16) {
    throw new Error("C1-P4 and C2-P2 charge_count should be 16 (2026-10-18 charge run and storage night)");
  }
  if (packByUid("CNHL-2026-005")?.chargeCount !== 18 || packByUid("CNHL-2026-012")?.chargeCount !== 18) {
    throw new Error("C1-P5 and C2-P6 charge_count should be 18");
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
    latestOperational("CNHL-2026-012")?.session !== "2026-10-18" ||
    latestOperational("CNHL-2026-005")?.session !== "2026-10-18" ||
    latestOperational("CNHL-2026-007")?.session !== "2026-10-18"
  ) {
    throw new Error("2026-10-18 storage rows are the latest readings");
  }
  {
    const night = measurements.filter((row) => row.session === "2026-10-18");
    const want = "C1-P1,C1-P2,C1-P3,C1-P4,C1-P5,C1-P6,C2-P1,C2-P2,C2-P3,C2-P4,C2-P5,C2-P6";
    if (night.length !== 12 || night.some((row) => isNonStorage(row.sessionType) || row.series !== row.label.slice(0, 2)) || night.map((row) => row.label).sort().join(",") !== want) {
      throw new Error(`2026-10-18 storage night is ${night.map((row) => row.label).sort().join(",")}`);
    }
    const p1 = night.find((row) => row.uid === "CNHL-2026-001");
    if (!p1 || p1.label !== "C1-P1" || p1.series !== "C1" || p1.avg.toFixed(3) !== "2.733") throw new Error("CNHL-2026-001 2026-10-18 row should be C1-P1 on C1, 2.733 mΩ");
  }
  {
    // 2026-10-23 C3+C4 storage night: 12 single-pack runs on the home channels; the C4-P4 row is held (Cell 6 IR 0.4 mΩ, under the 0.5 mΩ bound).
    const night = measurements.filter((row) => row.session === "2026-10-23");
    const want = "C3-P1,C3-P2,C3-P3,C3-P4,C3-P5,C3-P6,C4-P1,C4-P2,C4-P3,C4-P5,C4-P6";
    if (night.length !== 11 || night.some((row) => isNonStorage(row.sessionType) || row.series !== row.label.slice(0, 2)) || night.map((row) => row.label).sort().join(",") !== want) {
      throw new Error(`2026-10-23 storage night is ${night.map((row) => row.label).sort().join(",")}`);
    }
    const c3p1 = night.find((row) => row.uid === "CNHL-2026-013");
    if (!c3p1 || c3p1.label !== "C3-P1" || c3p1.avg.toFixed(3) !== "2.750") throw new Error("CNHL-2026-013 2026-10-23 row should be C3-P1, 2.750 mΩ");
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
  const freshLabels = [...new Set(freshStorage.map((row) => row.label))].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
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
    const count = label === "C3-P2" ? 4 : 5;
    const latest = label === "C4-P4" ? "2026-10-17" : "2026-10-23";
    if (!pack || pack.chargeCount !== count || pack.chargeMode !== "parallel" || pack.purchaseDate !== "2026-10-13") {
      throw new Error(`${label} should be charge count ${count}, parallel, purchased 2026-10-13`);
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
  const expectedLatest: Record<string, string> = {
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
  for (const [uid, status] of Object.entries(expectedLatest)) {
    const call = latestCall(uid);
    if (!call || call.status !== status) throw new Error(`Latest status for ${uid} is ${call?.status ?? "missing"}`);
  }
  if (packs.find((pack) => pack.label === "C1-P1")?.uid !== "CNHL-2026-001") {
    throw new Error("C1-P1 should be CNHL-2026-001");
  }
  if (labelAsOf("CNHL-2026-001", "2026-09-30") !== "C1-P1") throw new Error("CNHL-2026-001 should still be C1-P1 on 2026-09-30");
  for (const day of ["2026-10-08", "2026-10-09", "2026-10-16", "2026-10-17", "2026-10-18"]) {
    if (labelAsOf("CNHL-2026-001", day) !== "C1-P1") throw new Error(`CNHL-2026-001 should be C1-P1 on ${day}`);
  }
  if (movedEvent("CNHL-2026-001")) throw new Error("CNHL-2026-001 should have no move on the site");

  const stats = headline();
  if (stats.mean.toFixed(3) !== "2.773" || stats.counted !== 24) {
    throw new Error(`Fleet mean is ${stats.mean} over ${stats.counted}, expected 2.773 mΩ over 24 slotted packs`);
  }
  const rows = statusRows();
  const c1p4 = rows.find((row) => row.label === "C1-P4");
  if (!c1p4 || c1p4.latestSession !== "2026-10-18" || c1p4.avg.toFixed(3) !== "2.650" || c1p4.spread.toFixed(2) !== "1.20" || c1p4.sr !== 15.9 || c1p4.floor !== 3612 || c1p4.lowGap !== 87) {
    throw new Error(`C1-P4 card is ${c1p4?.latestSession} ${c1p4?.avg} ${c1p4?.spread} ${c1p4?.sr} ${c1p4?.floor} ${c1p4?.lowGap}`);
  }
  const c2p2 = rows.find((row) => row.label === "C2-P2");
  if (!c2p2 || c2p2.latestSession !== "2026-10-18" || c2p2.avg.toFixed(3) !== "3.133" || c2p2.sr !== 18.8 || c2p2.floor !== 3706 || c2p2.lowGap !== 21) {
    throw new Error(`C2-P2 card is ${c2p2?.latestSession} ${c2p2?.avg}`);
  }
  const c2Card = rows.find((row) => row.uid === "CNHL-2026-007");
  if (!c2Card || c2Card.latestSession !== "2026-10-18" || c2Card.avg.toFixed(3) !== "2.750" || c2Card.spread.toFixed(1) !== "0.5") {
    throw new Error(`C2-P1 card is ${c2Card?.latestSession} ${c2Card?.avg}`);
  }
  const model = fleetModel();
  const lastOf = (id: string) => {
    const line = model.mean.find((item) => item.id === id);
    return [...(line?.values ?? [])].reverse().find((value) => value != null);
  };
  if (lastOf("C1")?.toFixed(3) !== "2.786") throw new Error(`C1 series mean last is ${lastOf("C1")}`);
  if (lastOf("C2")?.toFixed(3) !== "2.853") throw new Error(`C2 series mean last is ${lastOf("C2")}`);
  if (lastOf("C3")?.toFixed(3) !== "2.728") throw new Error(`C3 series mean last is ${lastOf("C3")}`);
  if (lastOf("C4")?.toFixed(3) !== "2.787") throw new Error(`C4 series mean last is ${lastOf("C4")}`);
  const at = (id: string) => model.categories.findIndex((category) => category.id === id);
  const c1Fleet = model.fleets.find((fleet) => fleet.id === "C1");
  const c2Fleet = model.fleets.find((fleet) => fleet.id === "C2");
  const movedPack = c1Fleet?.packs.find((pack) => pack.uid === "CNHL-2026-001");
  if (movedPack?.avg[at("2026-10-09")]?.toFixed(3) !== "2.767") throw new Error("C1-P1 2026-10-09 value changed");
  const c1Mean = model.mean.find((line) => line.id === "C1");
  if (c1Mean?.values[at("2026-10-09")]?.toFixed(3) !== "2.767") throw new Error(`C1 mean on 2026-10-09 is ${c1Mean?.values[at("2026-10-09")]}`);
  if (c2MeanValue(model, "2026-10-10") !== "2.700") throw new Error("C2 mean on 2026-10-10 changed");
  const c1Rule = [...(c1Fleet?.rest ?? [])].reverse().find((value) => value != null);
  const c2Rule = [...(c2Fleet?.rest ?? [])].reverse().find((value) => value != null);
  if (c1Rule == null || Math.abs(c1Rule - 0.186) > 0.0005) throw new Error(`C1 Rule B last is ${c1Rule}`);
  if (c2Rule == null || Math.abs(c2Rule - 0.23) > 0.0005) throw new Error(`C2 Rule B last is ${c2Rule}`);
  const c1Rest1010 = c1Fleet?.rest[at("2026-10-10")];
  const c1Rest1011 = c1Fleet?.rest[at("2026-10-11")];
  const c2Rest1011 = c2Fleet?.rest[at("2026-10-11")];
  const c2Rest1010 = c2Fleet?.rest[at("2026-10-10")];
  if (c1Rest1010 == null || Math.abs(c1Rest1010 - 0.135) > 0.0005) {
    throw new Error(`C1 Rule B on 2026-10-10 is ${c1Rest1010}`);
  }
  if (c1Rest1011 == null || Math.abs(c1Rest1011 - 0.186) > 0.0005) {
    throw new Error(`C1 Rule B on 2026-10-11 is ${c1Rest1011}`);
  }
  if (c2Rest1011 == null || Math.abs(c2Rest1011 - 0.23) > 0.0005) {
    throw new Error(`C2 Rule B on 2026-10-11 is ${c2Rest1011}`);
  }
  if (c2Rest1010 == null || Math.abs(c2Rest1010 - 0.479) > 0.0005) {
    throw new Error(`C2 Rule B on 2026-10-10 is ${c2Rest1010}`);
  }
  const outlookOnChart = model.fleets.flatMap((fleet) => fleet.rest);
  for (const outlook of [0.384, 0.425, 0.629, 0.43, 0.249]) {
    if (outlookOnChart.some((value) => value != null && Math.abs(value - outlook) < 0.0005)) {
      throw new Error(`a Rule B chart plots the outlook figure ${outlook}`);
    }
  }
  const board = nextParallel();
  const rendered = board.series.map((item) => `${item.series}:${item.labels.join("+")}`).join(" | ");
  if (
    rendered !== "C1:C1-P1+C1-P2+C1-P3+C1-P4+C1-P5+C1-P6 | C2:C2-P1+C2-P2+C2-P3+C2-P4+C2-P5+C2-P6 | C3:C3-P1+C3-P2+C3-P3+C3-P4+C3-P5+C3-P6 | C4:C4-P1+C4-P2+C4-P3+C4-P4+C4-P5+C4-P6" ||
    board.as_of !== "2026-10-23"
  ) {
    throw new Error(`Next parallel rendered as ${board.as_of} ${rendered}`);
  }
  for (const row of rows) {
    if (statusChip(row.status, row.chargeMode) !== "GO") throw new Error(`${row.label} chip is not GO`);
  }
  const c2p6 = rows.find((row) => row.label === "C2-P6");
  const c2p6Calls = callsFor("CNHL-2026-012").filter((call) => call.date === "2026-10-10");
  if (c2p6Calls.length !== 2 || c2p6Calls[0]?.status !== "PARALLEL GO | SERVICE In service" || !c2p6Calls[1]?.status.startsWith("PARALLEL GO (conditional:")) {
    throw new Error("C2-P6 is missing the two 2026-10-10 calls");
  }
  if (!c2p6 || c2p6.status !== "PARALLEL GO: on the C2 board | SERVICE In service" || c2p6.session !== "2026-10-16") {
    throw new Error(`C2-P6 latest call is ${c2p6?.session} ${c2p6?.status}`);
  }
  const c1p5 = rows.find((row) => row.label === "C1-P5");
  if (!c1p5 || c1p5.status !== "PARALLEL GO: on the C1 board | SERVICE In service" || !c1p5.reason.includes("rules v7") || !c1p5.reason.includes("low Cell 4 is a performance note")) {
    throw new Error("C1-P5 card must show the recorded GO");
  }
  const c4p2 = rows.find((item) => item.label === "C4-P2");
  if (!c4p2 || c4p2.status !== "PARALLEL GO: on the C4 board | SERVICE In service" || !c4p2.reason.includes("low Cell 6 on 2026-10-14 and 2026-10-16 is a performance note")) {
    throw new Error(`C4-P2 call is ${c4p2?.session} ${c4p2?.status}`);
  }
  const c4p4 = rows.find((item) => item.label === "C4-P4");
  if (!c4p4 || c4p4.status !== "PARALLEL GO: on the C4 board | SERVICE In service" || !c4p4.reason.startsWith("No change: stays on the C4 board.") || c4p4.session !== "2026-10-16") {
    throw new Error(`C4-P4 call is ${c4p4?.session} ${c4p4?.status}`);
  }
  for (const label of ["C3-P5", "C3-P6"]) {
    const row = rows.find((item) => item.label === label);
    if (!row || row.status !== "PARALLEL GO: on the C3 board | SERVICE In service" || !row.reason.includes("rules v7")) {
      throw new Error(`${label} should stay Go on the C3 board`);
    }
  }
  const packChart = getPack("CNHL-2026-001");
  if (!packChart || packChart.points.length !== 16) throw new Error(`C1-P1 should have 16 readings, has ${packChart?.points.length}`);
  for (const line of [...(packChart?.cellSeries ?? []), ...(packChart?.spreadSeries ?? []), ...(packChart?.floorSeries ?? [])]) {
    if (readingIndices(line).length !== 16) throw new Error(`C1-P1 ${line.label} has ${readingIndices(line).length} readings`);
  }
  const c3p2 = getPack("CNHL-2026-014");
  for (const line of [...(c3p2?.cellSeries ?? []), ...(c3p2?.spreadSeries ?? []), ...(c3p2?.floorSeries ?? [])]) {
    if (readingIndices(line).length !== 3) throw new Error(`C3-P2 ${line.label} should have three readings (2026-10-14, 2026-10-16, 2026-10-23)`);
  }
  const c1p1Slot = getSlot("C1-P1");
  if (!c1p1Slot || c1p1Slot.past.length !== 0) throw new Error(`C1-P1 should have no past occupant, has ${c1p1Slot?.past.length}`);
}

function c2MeanValue(model: FleetModel, session: string): string | undefined {
  const index = model.categories.findIndex((category) => category.id === session);
  const line = model.mean.find((item) => item.id === "C2");
  const value = line?.values[index];
  return value == null ? undefined : value.toFixed(3);
}

if (process.env.CHECK_SNAPSHOT === "1") assertSnapshot();
