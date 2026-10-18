export const PLANNER_SERIES: readonly string[];
export const PLANNER_CHANNELS: readonly (readonly ["DX8-1" | "DX8-2", 1 | 2])[];

export type PlanRow = {
  label: string;
  series: string;
  slot: number;
  charger: "DX8-1" | "DX8-2";
  channel: 1 | 2;
  state: string;
};

export type PlanRules = {
  series_order: readonly string[];
  channel_start_order: readonly number[];
  include_states: readonly string[];
};

export type PlanResult = {
  channels: Record<string, string[]>;
  rounds: Record<string, [string | null, string | null][]>;
  files: Record<string, number>;
};

export function channelName(charger: "DX8-1" | "DX8-2", channel: 1 | 2): string;
export function planRuns(rows: readonly PlanRow[], rules: PlanRules, flown: readonly string[], dFlown: boolean): PlanResult;
