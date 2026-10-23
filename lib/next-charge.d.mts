export const BOARD_PORT_IDS: readonly string[];
export const BOARD_NAMES: readonly string[];

export type NextChargeDocument = {
  schema: "next_charge/v2";
  /** "v6" when this is the page view built from a next_charge/v3 file. */
  rules: "v5" | "v6" | "v7";
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
  /** D-pool packs that charge on their own. Omitted when the sheet has none. */
  individual?: IndividualItem[];
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

export type CheckFirst = {
  label: string;
  uid: string;
  last_rest_V: number;
  last_offset_max_V: number;
  last_offset_side: "below" | "above";
  note: string;
};

export type OutlookRuleB = {
  value_v: number;
  packs: string[];
  basis: string;
  session: string;
  limit_v: number;
  call: "GO" | "CHECK FIRST";
  check_first: CheckFirst[];
  value_without_check_first_v: number | null;
  packs_without_check_first: string[] | null;
  /** Rules v5 IR board match (next-night outlook, not a board result). */
  ir_match: IrMatch;
};

export type IrMatchPack = {
  label: string;
  avg_mohm: number | null;
  session: string | null;
  pct_off: number | null;
  nights_checked: number;
  nights_over_check_pct: number;
  nights_over_alone_pct: number;
  flag: "ok" | "check first" | "charge alone";
};

export type IrMatch = {
  basis: string;
  session: string;
  board_median_mohm: number | null;
  check_first_pct: number;
  charge_alone_pct: number;
  nights_needed: number;
  of_last_nights: number;
  packs: IrMatchPack[];
  check_first: string[];
  charge_alone: string[];
  call: "GO" | "CHECK FIRST" | "CHARGE ALONE";
};

export type ParallelBoard = {
  series: string;
  packs: string[];
  current: "normal" | "reduced";
  conditions: string[];
  rest_check_limit_V: number;
  /** Recorded board-night spread, in volts. Null when this series has no board night yet. */
  last_rule_b_V: number | null;
  last_rule_b_call: string | null;
  last_rule_b_session: string | null;
  /** Packs charged together on the recorded board night. Empty when last_rule_b_V is null. */
  last_rule_b_over: string[];
  last_rule_b_basis: string;
  /** Latest-rest outlook for the next night. Not a recorded board result. */
  outlook_rule_b: OutlookRuleB;
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

export type IndividualItem = {
  label: string;
  uid: string;
  pool: string;
  status: string;
  note: string;
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
/** Returns the v4 document (checkNextCharge validates the file, its fixtures and the page view). */
export function checkNextCharge(root?: string): NextChargeV4;

// ---- next_charge/v4 (Rules v7): run order and per-charger file counts only, no log numbers. No D series. ----
export type ChargerName = "DX8-1" | "DX8-2";
export type ChannelNumber = 1 | 2;
/** "DX8-1 Channel 1" ... "DX8-2 Channel 2" */
export type ChannelKey = string;

export type HomeChannelRow = {
  label: string;
  /** null when the slot is empty */
  uid: string | null;
  series: "C1" | "C2" | "C3" | "C4";
  slot: number;
  charger: ChargerName;
  channel: ChannelNumber;
  /** pulled = fire risk: not charged, slot skipped like an empty slot, nothing reordered. */
  state: "active" | "empty" | "pulled";
  /** Plain reason when state is not active; else null or a short note. */
  note: string | null;
};

export type PlannerRules = {
  series_order: ["C1", "C2", "C3", "C4"];
  channel_start_order: [1, 2];
  skip_empty: true;
  reorder: false;
  include_states: ["active"];
  steps: string[];
};

export type PlannerPlan = {
  channels: Record<ChannelKey, string[]>;
  /** Per charger, each round as [Channel 1 pack, Channel 2 pack]; null once that channel has run out. */
  rounds: Record<ChargerName, [string | null, string | null][]>;
  /** Log files per charger (one per pack). */
  files: Record<ChargerName, number>;
};

export type PlannerFixture = PlannerPlan & {
  id: string;
  name: string | null;
  flown_series: string[];
  /** Only on the made-up test case. */
  fixture_only?: string;
  fixture_states?: Record<string, HomeChannelRow["state"]>;
};

export type IrMatchV4 = {
  basis: string;
  session: string;
  board_median_mohm: number | null;
  note_pct: number;
  strong_note_pct: number;
  nights_needed: number;
  of_last_nights: number;
  packs: {
    label: string;
    avg_mohm: number | null;
    session: string | null;
    pct_off: number | null;
    nights_checked: number;
    nights_over_25_pct: number;
    nights_over_35_pct: number;
    flag: "ok" | "over 25%" | "over 35%";
  }[];
  /** Labels flagged; a performance note only. */
  notes: string[];
};

/** Same-position cells more than 0.10 V apart in the first log line (advisory: may be under 90 min after a flight). */
export type CellCheck = {
  session: string | null;
  limit_mv: 100;
  basis: string;
  pairs: { labels: [string, string]; cell: number; diff_mv: number }[];
  labels: string[];
};

export type ParallelBoardV4 = Omit<ParallelBoard, "current" | "outlook_rule_b"> & {
  cell_check_limit_V: number;
  outlook_rule_b: Omit<OutlookRuleB, "ir_match"> & { ir_match: IrMatchV4; cell_check: CellCheck };
};

export type SelfDischargeOpen = {
  test_id: string;
  label: string;
  uid: string;
  suspect_cell: number;
  storage_end_date: string;
  storage_end_mV: number[];
  completes_from: string;
};

export type NoteItem = { label: string; uid: string; note: string };

export type NextChargeV4 = {
  schema: "next_charge/v4" | "next_charge/v4.1";
  rules: "v7";
  as_of_session: string;
  as_of_date_pt: string;
  measurement: { rest_rule: string; ir_rule: string; from_logs: string[]; not_from_logs: string[] };
  home_channels: HomeChannelRow[];
  planner_rules: PlannerRules;
  start_order: { rule: string; mapping: string };
  planner_fixtures: PlannerFixture[];
  parallel_boards: ParallelBoardV4[];
  /** Fire risk: out of rotation, not charged; matches the pulled home_channels rows. */
  pulled: { label: string; uid: string; reason: string }[];
  /** Next board night only (measured single-cell IR step); stays in rotation. */
  charge_alone: ChargeAloneItem[];
  /** Advisories from the logs: check resting voltage before connecting. Never a status change. */
  check_before_connecting: NoteItem[];
  watch: NoteItem[];
  /** Never a pull or charge-alone reason. */
  performance_notes: NoteItem[];
  self_discharge_checks: {
    pull_rule: string;
    pull_relative_mv: 50;
    pull_window_h: [48, 72];
    pull_any_cell_mv: 100;
    pull_any_cell_h: 24;
    how_we_check: string;
    longer_gaps: string;
    performance_grade: string;
    open: SelfDischargeOpen[];
  };
  notes: string[];
  /** Absent or null omits the card. The object is a suggestion and does not drive the planner. */
  suggested_next?: SuggestedNext | null;
};

export type SuggestedChannel = {
  charger: "DX8-1" | "DX8-2";
  /** Full label, for example "DX8-1 Channel 1". */
  channel: string;
  packs: string[];
};

export type SuggestedAdvisory = {
  pack: string;
  text: string;
  chip: string;
  tone: "caution" | "off";
  anchor: "check-before-connecting" | "pulled" | "charge-alone";
};

export type SuggestedPlan = {
  channels: SuggestedChannel[];
  advisories: SuggestedAdvisory[];
};

export type SuggestedSeriesRow = {
  series: string;
  packs: number;
  lifetime_storage_cycles: number;
  avg_cycles_per_pack: number;
  last_flown: string | null;
  eligible: boolean;
  skip_reason: string | null;
};

export type SuggestedAlt = {
  pick: [string, string];
  reason: string;
  plan_if_flown: SuggestedPlan;
};

export type SuggestedNext = {
  basis: "lifetime_storage_cycles_per_pack";
  suggestion_only: true;
  status: "ok";
  as_of_date: string;
  pick: [string, string];
  reason: string;
  sets: SuggestedSeriesRow[];
  plan_if_flown: SuggestedPlan;
  alt_pick: SuggestedAlt | null;
};

export const PLANNER_SERIES: readonly string[];
export const PLANNER_CHANNELS: readonly [ChargerName, ChannelNumber][];
export function channelName(charger: ChargerName, channel: ChannelNumber): ChannelKey;
export function homeChannel(series: string, slot: number): [ChargerName, ChannelNumber];
export function planRuns(rows: HomeChannelRow[], rules: PlannerRules, flown: string[]): PlannerPlan;
export function validateNextChargeV4(doc: NextChargeV4, packs: Map<string, { uid: string; series: string }>): NextChargeV4;
/** Transitional v2-shaped view (set A and set B) for the current page; watch = watch + check_before_connecting. */
export function pageView(doc: NextChargeV4): NextChargeDocument;
export function loadNextChargeV4(root?: string): NextChargeV4;
