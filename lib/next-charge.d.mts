export type NextChargeRun = {
  run: number;
  packs: string[];
  note?: string;
};

export type NextChargeChannel = {
  name: string;
  runs: NextChargeRun[];
};

export type NextChargeCharger = {
  name: string;
  channels: NextChargeChannel[];
};

export type NextChargePort = {
  pack: string;
  /** L1, L2, L3, R1, R2, or R3. Omitted ports fill that order. */
  port?: string;
  note?: string;
};

export type NextChargeBoard = {
  series: string;
  /** Board A through Board D. Optional. At most four boards. */
  name?: string;
  ports: NextChargePort[];
  notes: string[];
};

export type AssignedPort = {
  id: "L1" | "L2" | "L3" | "R1" | "R2" | "R3";
  pack?: string;
  note?: string;
};

export type NextChargeAlone = {
  pack: string;
  reason: string;
};

export type NextChargeHold = {
  pack: string;
  reason: string;
  returns: string;
};

export type NextChargePlan = {
  as_of: string;
  based_on_session: string;
  status_calls_link: string;
  storage: { chargers: NextChargeCharger[] };
  parallel: { boards: NextChargeBoard[]; charge_alone: NextChargeAlone[] };
  dont_connect: NextChargeHold[];
};

export const BOARD_PORT_IDS: readonly ["L1", "L2", "L3", "R1", "R2", "R3"];
export const BOARD_NAMES: readonly ["Board A", "Board B", "Board C", "Board D"];
export function assignPorts(ports: NextChargePort[], where: string): AssignedPort[];
export function readRunAtOnce(root?: string): number;
export function validateNextCharge(
  doc: unknown,
  packs: ReadonlyMap<string, string>,
  runAtOnce: number,
): void;
export function loadNextCharge(root?: string): NextChargePlan;
export function checkNextCharge(root?: string): NextChargePlan;
