export const BOARD_PORT_IDS: readonly string[];
export const BOARD_NAMES: readonly string[];

export type NextChargeDocument = {
  schema: "next_charge/v2";
  as_of_session: string;
  as_of_date_pt: string;
  active_set: string;
  /** Present when the sheet is locked to this active set. */
  locked?: boolean;
  locked_reason?: string;
  active_set_reason: string;
  alternate_set: string;
  storage_runs: StorageRun[];
  parallel_boards: ParallelBoard[];
  charge_alone: ChargeAloneItem[];
  watch: WatchItem[];
  sets: Record<string, ChargeSet>;
  do_not_connect: DoNotConnectItem[];
  notes: string[];
};

export type ChargeSet = {
  series: string[];
  last_storage_session: string;
  storage_runs: StorageRun[];
  parallel_boards: ParallelBoard[];
  charge_alone: ChargeAloneItem[];
  watch: WatchItem[];
  join_status?: JoinStatus[];
};

export type StorageRun = {
  charger: string;
  channel: string;
  order: string[];
  /** Present when that channel's queue has a recorded mode. */
  mode?: string;
};

export type WatchItem = {
  label: string;
  uid: string;
  note: string;
};

export type JoinStatus = {
  label: string;
  uid: string;
  storage_nights: number;
  clean_nights_in_a_row: number;
  joins_board: boolean;
  status: string;
  rule: string;
};

export type ParallelBoard = {
  series: string;
  packs: string[];
  current: "normal" | "reduced";
  conditions: string[];
  last_rule_b_V: number;
  last_rule_b_call: string;
  last_rule_b_session: string;
  /** Packs this Rule B figure covers. When present, each label is on this board. */
  last_rule_b_over?: string[];
};

export type ChargeAloneItem = {
  label: string;
  uid: string;
  reason: string;
  until: string;
  /** Largest rest offset from that pack's board, in volts. Present only with last_offset_side. */
  last_offset_max_V?: number;
  /** Which side of the board that offset sits on. */
  last_offset_side?: "below" | "above";
};

export type DoNotConnectItem = {
  label: string;
  uid: string;
  pool: string;
  reason: string;
  return_date: string;
};

export type StorageSummaryLine = {
  run: number;
  line: string;
};

export type StorageChargerView = {
  charger: string;
  channels: {
    channel: string;
    runs: { run: number; label: string }[];
  }[];
};

export type LaidPort = {
  id: string;
  label?: string;
};

export type LaidSeries = ParallelBoard & {
  boards: { name: string; ports: LaidPort[] }[];
};

export function chargeSetId(name: string): string;
export function storageSummary(runs: StorageRun[]): StorageSummaryLine[];
export function storageChargers(runs: StorageRun[]): StorageChargerView[];
export function assignPorts(labels: string[]): LaidPort[];
export function layoutParallelBoards(boards: ParallelBoard[]): LaidSeries[];
export function validateNextCharge(
  doc: NextChargeDocument,
  packs: Map<string, { uid: string; series: string }>,
): NextChargeDocument;
export function loadNextCharge(root?: string): NextChargeDocument;
export function checkNextCharge(root?: string): NextChargeDocument;
