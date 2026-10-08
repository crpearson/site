import metaDoc from "@/data/meta.json";
import registryDoc from "@/data/pack-registry.json";
import seriesDoc from "@/data/packs-timeseries.json";
import sessionsDoc from "@/data/sessions.json";
import statusDoc from "@/data/status.json";
import { FLEET_COLOR, packColor } from "@/lib/color";
import { shortSession } from "@/lib/format";
import type { Band, Category, ChartSeries, Guide, PackStatus } from "@/lib/types";

export const PACK_IDS = [
  "C1-P1",
  "C1-P2",
  "C1-P3",
  "C1-P4",
  "C1-P5",
  "C1-P6",
  "C2-P1",
  "C2-P2",
  "C2-P3",
  "C2-P4",
  "C2-P5",
  "C2-P6",
] as const;

export type PackId = (typeof PACK_IDS)[number];

type SeriesPoint = {
  session: string;
  cells: number[];
  avg: number;
  spread: number;
  floor: number;
  imbalance: number | null;
  rest: number | null;
};

type StatusEntry = {
  status: PackStatus;
  reason: string;
  call_date: string;
  detail?: string;
};

type SessionRow = {
  id: string;
  fleets: string[];
  pack_count: number;
  partial: boolean;
  rest_delta: Record<string, { full_set_delta_V: number; n: number }>;
};

const statusPacks = statusDoc.packs as Record<string, StatusEntry>;
const seriesFile = seriesDoc as Record<
  string,
  {
    session: string;
    cells_ir_mohm: number[];
    avg_ir_mohm: number;
    spread_mohm: number;
    start_floor_mV: number;
    start_imbalance_mV: number | null;
    rest_V: number | null;
  }[]
>;

const sessions = sessionsDoc.sessions as SessionRow[];

const EXPECTED: Record<PackId, { status: PackStatus; call: string }> = {
  "C1-P1": { status: "OFF", call: "2026-09-27" },
  "C1-P2": { status: "OK", call: "2026-09-27" },
  "C1-P3": { status: "Caution", call: "2026-09-27" },
  "C1-P4": { status: "Caution", call: "2026-09-27" },
  "C1-P5": { status: "OFF", call: "2026-09-27" },
  "C1-P6": { status: "OK", call: "2026-09-27" },
  "C2-P1": { status: "OK", call: "2026-09-30" },
  "C2-P2": { status: "Caution", call: "2026-09-30" },
  "C2-P3": { status: "OK", call: "2026-09-30" },
  "C2-P4": { status: "OK", call: "2026-09-30" },
  "C2-P5": { status: "OK", call: "2026-09-30" },
  "C2-P6": { status: "OK", call: "2026-09-30" },
};

function pointsFor(id: PackId): SeriesPoint[] {
  const rows = seriesFile[id];
  if (!rows) throw new Error(`Missing series for ${id}`);
  return rows.map((row) => ({
    session: row.session,
    cells: row.cells_ir_mohm,
    avg: row.avg_ir_mohm,
    spread: row.spread_mohm,
    floor: row.start_floor_mV,
    imbalance: row.start_imbalance_mV,
    rest: row.rest_V,
  }));
}

function assertStore() {
  if (metaDoc.row_count !== 156 || metaDoc.session_count !== 14) {
    throw new Error(
      `Expected 156 rows and 14 sessions, got ${metaDoc.row_count}/${metaDoc.session_count}`,
    );
  }
  const measured = PACK_IDS.reduce((sum, id) => sum + pointsFor(id).length, 0);
  if (measured !== 156) {
    throw new Error(`Expected 156 series points, got ${measured}`);
  }
  const s413 = pointsFor("C1-P1").find((row) => row.session === "S413");
  if (!s413 || s413.cells.join(",") !== "569,543,524,538,552,545") {
    throw new Error("C1-P1 S413 IR spot check failed");
  }
  const c2 = pointsFor("C2-P2").find((row) => row.session === "2026-09-30");
  if (!c2 || c2.cells[2] !== 514) {
    throw new Error("C2-P2 2026-09-30 Cell3 spot check failed");
  }
  for (const id of PACK_IDS) {
    const entry = statusPacks[id];
    const expected = EXPECTED[id];
    if (!entry || entry.status !== expected.status || entry.call_date !== expected.call) {
      throw new Error(`Status call mismatch for ${id}`);
    }
    if (entry.reason.length === 0) throw new Error(`Empty reason for ${id}`);
  }
  if (statusDoc.call_date_c1 !== "2026-09-27" || statusDoc.call_date_c2 !== "2026-09-30") {
    throw new Error("Fleet call dates drifted from the status file");
  }
}

assertStore();

export const siteMeta = {
  lastIngest: metaDoc.last_ingest,
  rowCount: metaDoc.row_count,
  sessionCount: metaDoc.session_count,
  source: metaDoc.data_source,
  ingestNote: metaDoc.ingest_note,
  sessions: metaDoc.sessions,
  gaps: statusDoc.gaps,
  metricsAvailable: metaDoc.metrics_available,
  metricsMissing: metaDoc.metrics_not_available,
  callDateC1: statusDoc.call_date_c1,
  callDateC2: statusDoc.call_date_c2,
  unassignedNote: metaDoc.unassigned_note,
};

export const thresholds = statusDoc.thresholds;

const spreadRule = thresholds.intra_pack_spread_mohm;
const restRule = thresholds.inter_pack_rest_delta_v;

export const ruleAGuides: Guide[] = [
  { y: spreadRule.go_lt, label: `Go < ${spreadRule.go_lt}`, color: "#3ddc97" },
  {
    y: spreadRule.pull_gte,
    label: `Pull ≥ ${spreadRule.pull_gte}`,
    color: "#ff5c7a",
  },
];

export const ruleABands: Band[] = [
  {
    from: spreadRule.caution_lo,
    to: spreadRule.caution_hi,
    color: "rgba(245, 185, 66, 0.18)",
  },
  {
    from: spreadRule.pull_gte,
    to: 1000,
    color: "rgba(255, 92, 122, 0.12)",
  },
];

export const ruleBGuides: Guide[] = [
  {
    y: restRule.go_lte,
    label: `Go ≤ ${restRule.go_lte.toFixed(2)}`,
    color: "#3ddc97",
  },
  {
    y: restRule.hard_stop_gt,
    label: `Hard stop > ${restRule.hard_stop_gt.toFixed(2)}`,
    color: "#ff5c7a",
  },
];

export const ruleBBands: Band[] = [
  {
    from: restRule.caution_lo,
    to: restRule.caution_hi,
    color: "rgba(196, 161, 255, 0.2)",
  },
  {
    from: restRule.hard_stop_gt,
    to: 100,
    color: "rgba(255, 92, 122, 0.12)",
  },
];

export const floorGuide: Guide[] = [
  {
    y: thresholds.floor_eye_mv,
    label: `${thresholds.floor_eye_mv} mV watch`,
    color: "#79b8ff",
  },
];

export const floorBands: Band[] = [
  {
    from: 0,
    to: thresholds.floor_eye_mv,
    color: "rgba(121, 184, 255, 0.1)",
  },
];

export const categories: Category[] = sessions.map((session) => ({
  id: session.id,
  label: shortSession(session.id),
  partial: session.partial,
}));

function bySession(id: PackId): Map<string, SeriesPoint> {
  return new Map(pointsFor(id).map((point) => [point.session, point]));
}

function align(
  id: PackId,
  pick: (point: SeriesPoint) => number | null,
): (number | null)[] {
  const map = bySession(id);
  return categories.map((category) => {
    const point = map.get(category.id);
    return point ? pick(point) : null;
  });
}

function padded(values: number[], ratio = 0.08): [number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return [min - span * ratio, max + span * ratio];
}

export type StatusRow = {
  id: PackId;
  fleet: "C1" | "C2";
  status: PackStatus;
  reason: string;
  callDate: string;
  detail?: string;
  latestSession: string;
  avg: number;
  spread: number;
  floor: number;
  imbalance: number | null;
  rest: number | null;
  cells: number[];
  color: string;
  avgSeries: (number | null)[];
};

export function statusRows(): StatusRow[] {
  return PACK_IDS.map((id) => {
    const entry = statusPacks[id];
    const latest = pointsFor(id)[pointsFor(id).length - 1];
    return {
      id,
      fleet: id.startsWith("C2") ? "C2" : "C1",
      status: entry.status,
      reason: entry.reason,
      callDate: entry.call_date,
      detail: entry.detail,
      latestSession: latest.session,
      avg: latest.avg,
      spread: latest.spread,
      floor: latest.floor,
      imbalance: latest.imbalance,
      rest: latest.rest,
      cells: latest.cells,
      color: packColor(id),
      avgSeries: align(id, (point) => point.avg),
    };
  });
}

export function headline() {
  const rows = statusRows();
  const mean = rows.reduce((sum, row) => sum + row.avg, 0) / rows.length;
  const last = (fleet: "C1" | "C2") =>
    [...sessions].reverse().find((session) => session.fleets.includes(fleet))?.id ??
    "—";
  return {
    ok: rows.filter((row) => row.status === "OK"),
    caution: rows.filter((row) => row.status === "Caution"),
    off: rows.filter((row) => row.status === "OFF"),
    mean,
    lastC1: last("C1"),
    lastC2: last("C2"),
  };
}

export type PackSeries = {
  id: PackId;
  color: string;
  status: PackStatus;
  avg: (number | null)[];
  spread: (number | null)[];
  floor: (number | null)[];
  cells: (number | null)[][];
};

export type FleetModel = {
  categories: Category[];
  irDomain: [number, number];
  meanDomain: [number, number];
  spreadDomain: [number, number];
  floorDomain: [number, number];
  restDomain: [number, number];
  mean: { id: "C1" | "C2"; color: string; values: (number | null)[] }[];
  fleets: {
    id: "C1" | "C2";
    packs: PackSeries[];
    rest: (number | null)[];
  }[];
};

function fleetMean(packs: PackSeries[]): (number | null)[] {
  return categories.map((_, index) => {
    const values = packs
      .map((pack) => pack.avg[index])
      .filter((value): value is number => value != null);
    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  });
}

export function fleetModel(): FleetModel {
  const fleets = (["C1", "C2"] as const).map((fleet) => {
    const packs: PackSeries[] = PACK_IDS.filter((id) => id.startsWith(fleet)).map(
      (id) => ({
        id,
        color: packColor(id),
        status: statusPacks[id].status,
        avg: align(id, (point) => point.avg),
        spread: align(id, (point) => point.spread),
        floor: align(id, (point) => point.floor),
        cells: [0, 1, 2, 3, 4, 5].map((cell) =>
          align(id, (point) => point.cells[cell] ?? null),
        ),
      }),
    );
    const rest = categories.map((category) => {
      const session = sessions.find((row) => row.id === category.id);
      return session?.rest_delta[fleet]?.full_set_delta_V ?? null;
    });
    return { id: fleet, packs, rest };
  });

  const allIr = fleets.flatMap((fleet) =>
    fleet.packs.flatMap((pack) => [...pack.avg, ...pack.cells.flat()]),
  );
  const allSpread = fleets.flatMap((fleet) => fleet.packs.flatMap((pack) => pack.spread));
  const allFloor = fleets.flatMap((fleet) => fleet.packs.flatMap((pack) => pack.floor));
  const allRest = fleets.flatMap((fleet) => fleet.rest);
  const nums = (values: (number | null)[]) =>
    values.filter((value): value is number => value != null);

  const irNums = nums(allIr);
  const floorNums = nums(allFloor);
  const restNums = nums(allRest);
  const meanValues = fleets.flatMap((fleet) => fleetMean(fleet.packs));
  const spreadMax = Math.max(64, ...nums(allSpread));

  return {
    categories,
    irDomain: padded(irNums, 0.06),
    meanDomain: padded(nums(meanValues), 0.14),
    spreadDomain: [0, spreadMax],
    floorDomain: padded([...floorNums, thresholds.floor_eye_mv], 0.12),
    restDomain: [0, Math.max(0.8, Math.max(...restNums) * 1.12)],
    mean: fleets.map((fleet) => ({
      id: fleet.id,
      color: FLEET_COLOR[fleet.id],
      values: fleetMean(fleet.packs),
    })),
    fleets,
  };
}

export function seriesOf(
  packs: PackSeries[],
  pick: "avg" | "spread" | "floor",
): ChartSeries[] {
  return packs.map((pack) => ({
    id: pack.id,
    label: pack.id,
    color: pack.color,
    values: pack[pick],
  }));
}

export type PackView = {
  id: PackId;
  fleet: "C1" | "C2";
  row: StatusRow;
  brand: string;
  seriesName: string;
  capacityMah: number;
  connector: string;
  note: string | null;
  points: SeriesPoint[];
  categories: Category[];
  cellSeries: ChartSeries[];
  spreadSeries: ChartSeries[];
  floorSeries: ChartSeries[];
  irDomain: [number, number];
  spreadDomain: [number, number];
  floorDomain: [number, number];
  history: { session: string; label: string; values: number[] }[];
};

type RegistryPack = {
  id: string;
  fleet: string;
  brand_id: string;
  notes: string | null;
};

type RegistryBrand = {
  id: string;
  brand: string;
  series: string;
  capacity_mah: number;
  connector: string;
};

export function getPack(id: string): PackView | null {
  if (!PACK_IDS.includes(id as PackId)) return null;
  const packId = id as PackId;
  const registry = (registryDoc.packs as RegistryPack[]).find((pack) => pack.id === packId);
  const brand = (registryDoc.brands as RegistryBrand[]).find(
    (item) => item.id === registry?.brand_id,
  );
  const points = pointsFor(packId);
  const row = statusRows().find((item) => item.id === packId);
  if (!row || !brand) return null;
  const cells = points.flatMap((point) => point.cells);
  const spreads = points.map((point) => point.spread);
  const floors = points.map((point) => point.floor);
  return {
    id: packId,
    fleet: row.fleet,
    row,
    brand: brand.brand,
    seriesName: brand.series,
    capacityMah: brand.capacity_mah,
    connector: brand.connector,
    note: registry?.notes ?? null,
    points,
    categories,
    cellSeries: [0, 1, 2, 3, 4, 5].map((index) => ({
      id: `c${index + 1}`,
      label: `Cell ${index + 1}`,
      color: packColor(`P${index + 1}`),
      values: align(packId, (point) => point.cells[index] ?? null),
    })),
    spreadSeries: [
      {
        id: packId,
        label: packId,
        color: packColor(packId),
        values: align(packId, (point) => point.spread),
      },
    ],
    floorSeries: [
      {
        id: packId,
        label: "Start floor",
        color: "#79b8ff",
        values: align(packId, (point) => point.floor),
      },
    ],
    irDomain: padded(cells, 0.1),
    spreadDomain: [0, Math.max(64, ...spreads)],
    floorDomain: padded([...floors, thresholds.floor_eye_mv], 0.15),
    history: points.map((point) => ({
      session: point.session,
      label: shortSession(point.session),
      values: point.cells,
    })),
  };
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

export function nextBoards() {
  return statusDoc.next_parallel;
}

export function ruleABand(spread: number): "Go" | "Caution" | "Pull" {
  if (spread >= spreadRule.pull_gte) return "Pull";
  if (spread >= spreadRule.caution_lo) return "Caution";
  return "Go";
}

export function isPackId(id: string): id is PackId {
  return PACK_IDS.includes(id as PackId);
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
