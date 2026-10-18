import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PLANNER_CHANNELS, PLANNER_SERIES, channelName, planRuns } from "./plan-runs.mjs";

export { PLANNER_CHANNELS, PLANNER_SERIES, channelName, planRuns };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SCHEMA = "next_charge/v2";
const FILE_SHA256 = "29a95a910d4f10015e6590dd3f1d6ade838ab48a1541979562816ade54530ecd";
const DELTA_V_MAX = 2;
const PACK_REST_V = [15, 26.5];

export const BOARD_PORT_IDS = ["L1", "L2", "L3", "R1", "R2", "R3"];
export const BOARD_NAMES = ["Board A", "Board B", "Board C", "Board D"];

const TOP_KEYS = [
  "schema",
  "rules",
  "as_of_session",
  "as_of_date_pt",
  "active_set",
  "active_set_reason",
  "alternate_set",
  "storage_runs",
  "parallel_boards",
  "charge_alone",
  "watch",
  "sets",
  "do_not_connect",
  "notes",
];

const PLAN_KEYS = ["storage_runs", "parallel_boards", "charge_alone", "watch"];

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

function fail(message) {
  throw new Error(`next_charge.json: ${message}`);
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, keys, where, optional = []) {
  if (!isObject(value)) fail(`${where} must be an object`);
  const present = Object.keys(value);
  const allowed = new Set([...keys, ...optional]);
  for (const key of keys) {
    if (!present.includes(key)) fail(`${where} is missing ${key}`);
  }
  for (const key of present) {
    if (!allowed.has(key)) fail(`${where} has unknown key ${key}`);
  }
}

function text(value, where) {
  if (typeof value !== "string" || value.trim() === "") fail(`${where} must be a non-empty string`);
  return value;
}

function date(value, where) {
  const raw = text(value, where);
  if (!DATE.test(raw)) fail(`${where} must be YYYY-MM-DD`);
  return raw;
}

function stringList(value, where) {
  if (!Array.isArray(value)) fail(`${where} must be an array`);
  return value.map((item, index) => text(item, `${where}[${index}]`));
}

function at(prefix, name) {
  return prefix ? `${prefix}.${name}` : name;
}

function readPacks(root) {
  const rows = parseCsv(fs.readFileSync(path.join(root, "data/v2/packs.csv"), "utf8"));
  const packs = new Map();
  for (const row of rows) {
    if (!row.label || !row.pack_uid) continue;
    packs.set(row.label, { uid: row.pack_uid, series: row.series });
  }
  return packs;
}

function requirePack(label, packs, where) {
  const pack = packs.get(label);
  if (!pack) fail(`${where} unknown pack ${label}`);
  return pack;
}

/** "C3+C4" is stored as the sets key "C3_C4". */
export function chargeSetId(name) {
  if (typeof name !== "string" || !/^[A-Za-z0-9]+(?:\+[A-Za-z0-9]+)+$/.test(name)) {
    fail(`set name ${JSON.stringify(name)} is not a plus-joined id`);
  }
  return name.replaceAll("+", "_");
}

/**
 * One pack per channel per run. Run n is order[n - 1]. The summary line names
 * the charger when it changes and then only the channel.
 */
export function storageSummary(runs) {
  const max = runs.reduce((count, run) => Math.max(count, run.order.length), 0);
  const summary = [];
  for (let index = 0; index < max; index += 1) {
    const bits = [];
    let charger = "";
    for (const run of runs) {
      const label = run.order[index];
      if (!label) continue;
      const head = run.charger === charger ? "" : `${run.charger} `;
      bits.push(`${head}${run.channel} ${label}`);
      charger = run.charger;
    }
    summary.push({ run: index + 1, line: bits.join(" · ") });
  }
  return summary;
}

export function storageChargers(runs) {
  const chargers = [];
  for (const run of runs) {
    let charger = chargers.find((item) => item.charger === run.charger);
    if (!charger) {
      charger = { charger: run.charger, channels: [] };
      chargers.push(charger);
    }
    charger.channels.push({
      channel: run.channel,
      runs: run.order.map((label, index) => ({ run: index + 1, label })),
    });
  }
  return chargers;
}

export function assignPorts(labels) {
  if (labels.length > BOARD_PORT_IDS.length) fail("a board drawing has more than 6 packs");
  return BOARD_PORT_IDS.map((id, index) => {
    const label = labels[index];
    return label ? { id, label } : { id };
  });
}

/** Packs fill L1, L2, L3, R1, R2, R3. Pack 7 starts the next letter, through Board D. */
export function layoutParallelBoards(boards) {
  let letter = 0;
  return boards.map((board) => {
    const groups = [];
    if (board.packs.length === 0) groups.push([]);
    for (let index = 0; index < board.packs.length; index += BOARD_PORT_IDS.length) {
      groups.push(board.packs.slice(index, index + BOARD_PORT_IDS.length));
    }
    if (groups.length === 0) groups.push([]);
    const drawn = groups.map((group) => {
      if (letter >= BOARD_NAMES.length) fail("needs more than 4 parallel boards");
      const name = BOARD_NAMES[letter];
      letter += 1;
      return { name, ports: assignPorts(group) };
    });
    return { ...board, boards: drawn };
  });
}

function readStorage(runs, packs, prefix) {
  const whereList = at(prefix, "storage_runs");
  if (!Array.isArray(runs)) fail(`${whereList} must be an array`);
  const labels = new Set();
  for (const [index, run] of runs.entries()) {
    const where = `${whereList}[${index}]`;
    exactKeys(run, ["charger", "channel", "order"], where, ["mode"]);
    text(run.charger, `${where}.charger`);
    text(run.channel, `${where}.channel`);
    if ("mode" in run) text(run.mode, `${where}.mode`);
    const order = stringList(run.order, `${where}.order`);
    if (order.length === 0) fail(`${where}.order is empty`);
    for (const label of order) {
      requirePack(label, packs, where);
      if (labels.has(label)) fail(`duplicate pack ${label} in storage`);
      labels.add(label);
    }
  }
  return labels;
}

function voltNumber(value, where) {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(`${where} must be a number of volts`);
}

function voltDelta(value, where) {
  voltNumber(value, where);
  if (value < 0 || value > DELTA_V_MAX) fail(`${where}=${value} is outside 0–${DELTA_V_MAX} V`);
}

function voltLimit(value, where) {
  voltNumber(value, where);
  if (!(value > 0 && value <= DELTA_V_MAX)) fail(`${where}=${value} is outside 0–${DELTA_V_MAX} V`);
}

function voltPack(value, where) {
  voltNumber(value, where);
  if (value < PACK_REST_V[0] || value > PACK_REST_V[1]) {
    fail(`${where}=${value} is outside ${PACK_REST_V[0]}–${PACK_REST_V[1]} V`);
  }
}

function readRecordedRuleB(board, where) {
  text(board.last_rule_b_basis, `${where}.last_rule_b_basis`);
  const over = stringList(board.last_rule_b_over, `${where}.last_rule_b_over`);
  const recorded = board.last_rule_b_V !== null;
  if (recorded) {
    voltDelta(board.last_rule_b_V, `${where}.last_rule_b_V`);
    text(board.last_rule_b_call, `${where}.last_rule_b_call`);
    text(board.last_rule_b_session, `${where}.last_rule_b_session`);
    if (over.length === 0) fail(`${where}.last_rule_b_over is empty`);
  } else {
    if (board.last_rule_b_call !== null || board.last_rule_b_session !== null) {
      fail(`${where}.last_rule_b_call and last_rule_b_session must be null when there is no recorded board night`);
    }
    if (over.length !== 0) fail(`${where}.last_rule_b_over must be empty when there is no recorded board night`);
  }
  return over;
}

function readOutlook(outlook, packs, board, where) {
  const spot = `${where}.outlook_rule_b`;
  if (!isObject(outlook)) fail(`${spot} must be an object`);
  exactKeys(
    outlook,
    [
      "value_v",
      "packs",
      "basis",
      "session",
      "limit_v",
      "call",
      "check_first",
      "value_without_check_first_v",
      "packs_without_check_first",
      "ir_match",
    ],
    spot,
  );
  voltDelta(outlook.value_v, `${spot}.value_v`);
  voltLimit(outlook.limit_v, `${spot}.limit_v`);
  text(outlook.basis, `${spot}.basis`);
  text(outlook.session, `${spot}.session`);
  if (outlook.call !== "GO" && outlook.call !== "CHECK FIRST") {
    fail(`${spot}.call must be GO or CHECK FIRST`);
  }
  const labels = stringList(outlook.packs, `${spot}.packs`);
  if (labels.length === 0) fail(`${spot}.packs is empty`);
  const seen = new Set();
  for (const label of labels) {
    if (!board.packs.includes(label)) fail(`${spot}.packs lists ${label}, which is not on this board`);
    if (seen.has(label)) fail(`${spot}.packs repeats ${label}`);
    seen.add(label);
  }
  const checked = readCheckFirst(outlook.check_first, packs, board, spot);
  const bare = outlook.check_first.length === 0;
  if (bare) {
    if (outlook.call !== "GO") fail(`${spot}.call must be GO when check_first is empty`);
    if (outlook.value_without_check_first_v !== null || outlook.packs_without_check_first !== null) {
      fail(`${spot} value_without_check_first_v and packs_without_check_first must be null when check_first is empty`);
    }
  } else {
    if (outlook.call !== "CHECK FIRST") fail(`${spot}.call must be CHECK FIRST when check_first is set`);
    voltDelta(outlook.value_without_check_first_v, `${spot}.value_without_check_first_v`);
    const without = stringList(outlook.packs_without_check_first, `${spot}.packs_without_check_first`);
    if (without.length === 0) fail(`${spot}.packs_without_check_first is empty`);
    const uncovered = new Set();
    for (const label of without) {
      if (!labels.includes(label)) fail(`${spot}.packs_without_check_first lists ${label}, which is not in the outlook`);
      if (checked.has(label)) fail(`${spot}.packs_without_check_first still includes ${label}`);
      if (uncovered.has(label)) fail(`${spot}.packs_without_check_first repeats ${label}`);
      uncovered.add(label);
    }
  }
}

const IR_FLAGS = ["ok", "check first", "charge alone"];
const IR_CALLS = ["GO", "CHECK FIRST", "CHARGE ALONE"];

function irMohm(value, spot, allowNull) {
  if (value === null && allowNull) return;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0.5 || value > 15) {
    fail(`${spot} must be ${allowNull ? "null or " : ""}milliohms in 0.5–15 mΩ`);
  }
}

function irPctOff(value, spot) {
  if (value === null) return;
  if (typeof value !== "number" || !Number.isFinite(value) || value < -100 || value > 1000) {
    fail(`${spot} must be null or a percent in -100–1000 %`);
  }
}

function irThresholdPct(value, spot) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 100) {
    fail(`${spot} must be a percent above 0 and at most 100 %`);
  }
}

function readIrMatch(match, board, where) {
  const spot = `${where}.ir_match`;
  exactKeys(
    match,
    ["basis", "session", "board_median_mohm", "check_first_pct", "charge_alone_pct", "nights_needed", "of_last_nights", "packs", "check_first", "charge_alone", "call"],
    spot,
  );
  text(match.basis, `${spot}.basis`);
  text(match.session, `${spot}.session`);
  irMohm(match.board_median_mohm, `${spot}.board_median_mohm`, true);
  irThresholdPct(match.check_first_pct, `${spot}.check_first_pct`);
  irThresholdPct(match.charge_alone_pct, `${spot}.charge_alone_pct`);
  for (const key of ["nights_needed", "of_last_nights"]) {
    if (!Number.isInteger(match[key]) || match[key] < 1 || match[key] > 10) {
      fail(`${spot}.${key} must be an integer from 1 to 10`);
    }
  }
  if (match.nights_needed > match.of_last_nights) fail(`${spot}.nights_needed must be within of_last_nights`);
  if (!(match.charge_alone_pct > match.check_first_pct)) fail(`${spot}.charge_alone_pct must be above check_first_pct`);
  if (!Array.isArray(match.packs) || match.packs.length === 0) fail(`${spot}.packs must be a non-empty array`);
  const seen = new Map();
  for (const [index, item] of match.packs.entries()) {
    const at_ = `${spot}.packs[${index}]`;
    exactKeys(item, ["label", "avg_mohm", "session", "pct_off", "nights_checked", "nights_over_check_pct", "nights_over_alone_pct", "flag"], at_);
    const label = text(item.label, `${at_}.label`);
    if (seen.has(label)) fail(`${at_} repeats ${label}`);
    if (!IR_FLAGS.includes(item.flag)) fail(`${at_}.flag must be ${IR_FLAGS.join(", ")}`);
    if (item.flag !== "charge alone" && !board.packs.includes(label)) fail(`${at_} lists ${label}, which is not on this board`);
    irMohm(item.avg_mohm, `${at_}.avg_mohm`, true);
    irPctOff(item.pct_off, `${at_}.pct_off`);
    for (const key of ["nights_checked", "nights_over_check_pct", "nights_over_alone_pct"]) {
      if (!Number.isInteger(item[key]) || item[key] < 0 || item[key] > match.of_last_nights) fail(`${at_}.${key} must be 0–${match.of_last_nights}`);
    }
    seen.set(label, item.flag);
  }
  for (const [list, flag] of [["check_first", "check first"], ["charge_alone", "charge alone"]]) {
    const labels = stringList(match[list], `${spot}.${list}`);
    const want = [...seen].filter(([, value]) => value === flag).map(([label]) => label);
    if (labels.join("+") !== want.join("+")) fail(`${spot}.${list} must list the packs flagged ${flag}`);
  }
  const call = match.charge_alone.length ? "CHARGE ALONE" : match.check_first.length ? "CHECK FIRST" : "GO";
  if (!IR_CALLS.includes(match.call) || match.call !== call) fail(`${spot}.call must be ${call}`);
  for (const label of board.packs) if (!seen.has(label)) fail(`${spot}.packs is missing ${label}`);
  if (match.check_first.length && board.current !== "reduced") fail(`${where} has IR check-first packs, so current must be reduced`);
}

function readBoards(boards, packs, prefix) {
  const whereList = at(prefix, "parallel_boards");
  if (!Array.isArray(boards)) fail(`${whereList} must be an array`);
  let boardsNeeded = 0;
  for (const [index, board] of boards.entries()) {
    const where = `${whereList}[${index}]`;
    exactKeys(
      board,
      [
        "series",
        "packs",
        "current",
        "conditions",
        "rest_check_limit_V",
        "last_rule_b_V",
        "last_rule_b_call",
        "last_rule_b_session",
        "last_rule_b_over",
        "last_rule_b_basis",
        "outlook_rule_b",
      ],
      where,
    );
    text(board.series, `${where}.series`);
    if (board.current !== "normal" && board.current !== "reduced") {
      fail(`${where}.current must be normal or reduced`);
    }
    stringList(board.conditions, `${where}.conditions`);
    voltLimit(board.rest_check_limit_V, `${where}.rest_check_limit_V`);
    readRecordedRuleB(board, where);
    const labels = stringList(board.packs, `${where}.packs`);
    boardsNeeded += labels.length === 0 ? 1 : Math.ceil(labels.length / BOARD_PORT_IDS.length);
  }
  if (boardsNeeded > BOARD_NAMES.length) fail("needs more than 4 parallel boards");

  const parallelLabels = new Set();
  for (const [index, board] of boards.entries()) {
    const where = `${whereList}[${index}]`;
    const seen = new Set();
    for (const label of board.packs) {
      const pack = requirePack(label, packs, where);
      if (pack.series !== board.series) fail(`${label} is ${pack.series}, not ${board.series}`);
      if (seen.has(label) || parallelLabels.has(label)) fail(`duplicate pack ${label} on parallel boards`);
      seen.add(label);
      parallelLabels.add(label);
    }
    const covered = new Set();
    for (const label of board.last_rule_b_over) {
      if (!board.packs.includes(label)) {
        fail(`${where}.last_rule_b_over lists ${label}, which is not on this board`);
      }
      if (covered.has(label)) fail(`${where}.last_rule_b_over repeats ${label}`);
      covered.add(label);
    }
    readOutlook(board.outlook_rule_b, packs, board, where);
  }
  layoutParallelBoards(boards);
  return parallelLabels;
}

function readCheckFirst(items, packs, board, where) {
  const whereList = `${where}.check_first`;
  if (!Array.isArray(items)) fail(`${whereList} must be an array`);
  const seen = new Set();
  for (const [index, item] of items.entries()) {
    const spot = `${whereList}[${index}]`;
    exactKeys(
      item,
      ["label", "uid", "last_rest_V", "last_offset_max_V", "last_offset_side", "note"],
      spot,
    );
    const label = text(item.label, `${spot}.label`);
    const pack = requirePack(label, packs, spot);
    if (text(item.uid, `${spot}.uid`) !== pack.uid) fail(`${spot}.uid does not match ${label}`);
    if (!board.packs.includes(label)) fail(`${spot} lists ${label}, which is not on this board`);
    voltPack(item.last_rest_V, `${spot}.last_rest_V`);
    voltDelta(item.last_offset_max_V, `${spot}.last_offset_max_V`);
    if (item.last_offset_side !== "below" && item.last_offset_side !== "above") {
      fail(`${spot}.last_offset_side must be below or above`);
    }
    text(item.note, `${spot}.note`);
    if (seen.has(label)) fail(`duplicate pack ${label} in check_first`);
    seen.add(label);
  }
  return seen;
}

function readAlone(items, packs, prefix) {
  const whereList = at(prefix, "charge_alone");
  if (!Array.isArray(items)) fail(`${whereList} must be an array`);
  const labels = new Set();
  for (const [index, item] of items.entries()) {
    const where = `${whereList}[${index}]`;
    exactKeys(item, ["label", "uid", "reason", "until"], where, ["last_offset_max_V", "last_offset_side"]);
    const label = text(item.label, `${where}.label`);
    const pack = requirePack(label, packs, where);
    if (text(item.uid, `${where}.uid`) !== pack.uid) fail(`${where}.uid does not match ${label}`);
    text(item.reason, `${where}.reason`);
    text(item.until, `${where}.until`);
    const hasOffset = "last_offset_max_V" in item;
    const hasSide = "last_offset_side" in item;
    if (hasOffset !== hasSide) fail(`${where} needs both last_offset_max_V and last_offset_side`);
    if (hasOffset) {
      if (typeof item.last_offset_max_V !== "number" || !Number.isFinite(item.last_offset_max_V)) {
        fail(`${where}.last_offset_max_V must be a finite number`);
      }
      if (item.last_offset_side !== "below" && item.last_offset_side !== "above") {
        fail(`${where}.last_offset_side must be below or above`);
      }
    }
    if (labels.has(label)) fail(`duplicate pack ${label} in charge_alone`);
    labels.add(label);
  }
  return labels;
}

function readWatch(items, packs, prefix) {
  const whereList = at(prefix, "watch");
  if (!Array.isArray(items)) fail(`${whereList} must be an array`);
  const labels = new Set();
  for (const [index, item] of items.entries()) {
    const where = `${whereList}[${index}]`;
    exactKeys(item, ["label", "uid", "note"], where);
    const label = text(item.label, `${where}.label`);
    const pack = requirePack(label, packs, where);
    if (text(item.uid, `${where}.uid`) !== pack.uid) fail(`${where}.uid does not match ${label}`);
    text(item.note, `${where}.note`);
    if (labels.has(label)) fail(`duplicate pack ${label} in watch`);
    labels.add(label);
  }
  return labels;
}

function readPlan(plan, packs, prefix) {
  const storageLabels = readStorage(plan.storage_runs, packs, prefix);
  const parallelLabels = readBoards(plan.parallel_boards, packs, prefix);
  const aloneLabels = readAlone(plan.charge_alone, packs, prefix);
  const watchLabels = readWatch(plan.watch, packs, prefix);
  const connect = new Set([...storageLabels, ...parallelLabels, ...aloneLabels]);
  const labels = new Set([...connect, ...watchLabels]);
  return { storageLabels, parallelLabels, aloneLabels, watchLabels, connect, labels };
}

function readJoin(items, packs, where, parallelLabels, series, labels) {
  const whereList = `${where}.join_status`;
  if (!Array.isArray(items)) fail(`${whereList} must be an array`);
  const seen = new Set();
  for (const [index, item] of items.entries()) {
    const spot = `${whereList}[${index}]`;
    exactKeys(
      item,
      ["label", "uid", "storage_nights", "clean_nights_in_a_row", "joins_board", "status", "rule"],
      spot,
    );
    const label = text(item.label, `${spot}.label`);
    const pack = requirePack(label, packs, spot);
    if (text(item.uid, `${spot}.uid`) !== pack.uid) fail(`${spot}.uid does not match ${label}`);
    if (!series.includes(pack.series)) fail(`${label} is ${pack.series}, outside ${where}`);
    if (typeof item.storage_nights !== "number" || !Number.isFinite(item.storage_nights)) {
      fail(`${spot}.storage_nights must be a finite number`);
    }
    if (typeof item.clean_nights_in_a_row !== "number" || !Number.isFinite(item.clean_nights_in_a_row)) {
      fail(`${spot}.clean_nights_in_a_row must be a finite number`);
    }
    if (typeof item.joins_board !== "boolean") fail(`${spot}.joins_board must be true or false`);
    text(item.status, `${spot}.status`);
    text(item.rule, `${spot}.rule`);
    if (!item.joins_board && parallelLabels.has(label)) {
      fail(`${label} joins_board is ${item.joins_board} but the parallel boards disagree`);
    }
    if (seen.has(label)) fail(`duplicate pack ${label} in join_status`);
    seen.add(label);
    labels.add(label);
  }
}

function readSet(set, packs, where) {
  exactKeys(
    set,
    ["series", "last_storage_session", "storage_runs", "parallel_boards", "charge_alone", "watch"],
    where,
    ["join_status"],
  );
  const series = stringList(set.series, `${where}.series`);
  if (series.length === 0) fail(`${where}.series is empty`);
  if (new Set(series).size !== series.length) fail(`${where}.series repeats a name`);
  text(set.last_storage_session, `${where}.last_storage_session`);
  const plan = readPlan(set, packs, where);
  for (const board of set.parallel_boards) {
    if (!series.includes(board.series)) fail(`${where} series ${board.series} is outside this set`);
  }
  if ("join_status" in set) readJoin(set.join_status, packs, where, plan.parallelLabels, series, plan.labels);
  for (const label of plan.labels) {
    const pack = packs.get(label);
    if (pack && !series.includes(pack.series)) fail(`${label} is ${pack.series}, outside ${where}`);
  }
  return plan;
}

export function validateNextCharge(doc, packs) {
  if (!isObject(doc)) fail("must be an object");
  if (doc.schema !== SCHEMA) {
    const shown = doc.schema === undefined ? "(missing)" : JSON.stringify(doc.schema);
    fail(`unknown schema version ${shown}; expected ${SCHEMA}`);
  }
  exactKeys(doc, TOP_KEYS, "document", ["locked", "locked_reason", "individual"]);
  if (!["v5", "v6", "v7"].includes(doc.rules)) fail(`rules must be v5, v6 or v7, got ${JSON.stringify(doc.rules)}`);
  text(doc.as_of_session, "as_of_session");
  date(doc.as_of_date_pt, "as_of_date_pt");
  const activeName = text(doc.active_set, "active_set");
  const alternateName = text(doc.alternate_set, "alternate_set");
  if (activeName === alternateName) fail("active_set and alternate_set are the same");
  if ("locked" in doc && typeof doc.locked !== "boolean") fail("locked must be true or false");
  if (doc.locked === true) text(doc.locked_reason, "locked_reason");
  else if ("locked_reason" in doc) text(doc.locked_reason, "locked_reason");
  text(doc.active_set_reason, "active_set_reason");

  const top = readPlan(doc, packs, "");
  const held = readHeld(doc.do_not_connect, packs, top.connect);
  stringList(doc.notes, "notes");

  if (!isObject(doc.sets)) fail("sets must be an object");
  const activeId = chargeSetId(activeName);
  const alternateId = chargeSetId(alternateName);
  exactKeys(doc.sets, [activeId, alternateId], "sets");

  const owners = new Map();
  for (const id of [activeId, alternateId]) {
    const plan = readSet(doc.sets[id], packs, `sets.${id}`);
    for (const label of plan.labels) {
      const prior = owners.get(label);
      if (prior) fail(`pack ${label} is in both ${prior} and ${id}`);
      owners.set(label, id);
    }
    for (const label of plan.connect) {
      if (held.has(label)) fail(`${label} is in a connect slot and in do_not_connect`);
    }
    if (id === activeId) {
      for (const key of PLAN_KEYS) {
        if (JSON.stringify(doc[key]) !== JSON.stringify(doc.sets[id][key])) {
          fail(`${key} does not match the active set`);
        }
      }
    }
  }
  if ("individual" in doc) readIndividual(doc.individual, packs, new Set([...top.labels, ...owners.keys(), ...held]));
  // Rules v5 IR board match: checked last, after the plan and pool checks.
  const ruleSets = [["", doc], ...[activeId, alternateId].map((id) => [`sets.${id}.`, doc.sets[id]])];
  for (const [prefix, plan] of ruleSets) {
    for (const [index, board] of plan.parallel_boards.entries()) {
      readIrMatch(board.outlook_rule_b.ir_match, board, `${prefix}parallel_boards[${index}].outlook_rule_b`);
    }
  }
  return doc;
}

function readIndividual(items, packs, placed) {
  if (!Array.isArray(items)) fail("individual must be an array");
  const seen = new Set();
  for (const [index, item] of items.entries()) {
    const where = `individual[${index}]`;
    exactKeys(item, ["label", "uid", "pool", "status", "note"], where);
    const label = text(item.label, `${where}.label`);
    const pack = requirePack(label, packs, where);
    if (text(item.uid, `${where}.uid`) !== pack.uid) fail(`${where}.uid does not match ${label}`);
    if (text(item.pool, `${where}.pool`) !== "D") fail(`${where}.pool must be D`);
    text(item.status, `${where}.status`);
    text(item.note, `${where}.note`);
    if (seen.has(label)) fail(`duplicate pack ${label} in individual`);
    if (placed.has(label)) fail(`${label} is in individual and also on a board, in charge_alone, a storage run or do_not_connect`);
    seen.add(label);
  }
}

function readHeld(items, packs, connect) {
  if (!Array.isArray(items)) fail("do_not_connect must be an array");
  const held = new Set();
  for (const [index, item] of items.entries()) {
    const where = `do_not_connect[${index}]`;
    exactKeys(item, ["label", "uid", "pool", "reason", "return_date"], where);
    const label = text(item.label, `${where}.label`);
    const pack = requirePack(label, packs, where);
    if (text(item.uid, `${where}.uid`) !== pack.uid) fail(`${where}.uid does not match ${label}`);
    text(item.pool, `${where}.pool`);
    text(item.reason, `${where}.reason`);
    date(item.return_date, `${where}.return_date`);
    if (held.has(label)) fail(`duplicate pack ${label} in do_not_connect`);
    if (connect.has(label)) fail(`${label} is in a connect slot and in do_not_connect`);
    held.add(label);
  }
  return held;
}

function sample() {
  const storage_runs = [{ charger: "DX8-1", channel: "CH1", order: ["C1-P2"] }];
  const parallel_boards = [
    {
      series: "C1",
      packs: ["C1-P3"],
      current: "normal",
      conditions: [],
      rest_check_limit_V: 0.6,
      last_rule_b_V: 0.135,
      last_rule_b_call: "GO",
      last_rule_b_session: "2026-10-10",
      last_rule_b_over: ["C1-P3"],
      last_rule_b_basis: "packs charged together on this board that night (recorded)",
      outlook_rule_b: {
        value_v: 0.135,
        packs: ["C1-P3"],
        basis: "latest rest V of every pack assigned to this board",
        session: "2026-10-10",
        limit_v: 0.6,
        call: "GO",
        check_first: [],
        value_without_check_first_v: null,
        packs_without_check_first: null,
        ir_match: {
          basis: "sample",
          session: "2026-10-10",
          board_median_mohm: 2.8,
          check_first_pct: 25,
          charge_alone_pct: 35,
          nights_needed: 2,
          of_last_nights: 3,
          packs: [
            {
              label: "C1-P3",
              avg_mohm: 2.8,
              session: "2026-10-10",
              pct_off: 0,
              nights_checked: 1,
              nights_over_check_pct: 0,
              nights_over_alone_pct: 0,
              flag: "ok",
            },
          ],
          check_first: [],
          charge_alone: [],
          call: "GO",
        },
      },
    },
  ];
  const charge_alone = [];
  const watch = [];
  return {
    schema: SCHEMA,
    rules: "v5",
    as_of_session: "2026-10-10",
    as_of_date_pt: "2026-10-10",
    active_set: "C1+C2",
    locked: false,
    locked_reason: "sample",
    active_set_reason: "sample",
    alternate_set: "C3+C4",
    storage_runs,
    parallel_boards,
    charge_alone,
    watch,
    sets: {
      C1_C2: {
        series: ["C1", "C2"],
        last_storage_session: "2026-10-10",
        storage_runs,
        parallel_boards,
        charge_alone,
        watch,
      },
      C3_C4: {
        series: ["C3", "C4"],
        last_storage_session: "2026-10-14",
        storage_runs: [{ charger: "DX8-1", channel: "CH1", order: ["C3-P1"] }],
        parallel_boards: [],
        charge_alone: [],
        watch: [],
      },
    },
    do_not_connect: [],
    notes: [],
  };
}

function mirrorActive(doc) {
  const set = doc.sets[chargeSetId(doc.active_set)];
  for (const key of PLAN_KEYS) set[key] = doc[key];
}

function expectFail(doc, packs, pattern) {
  try {
    validateNextCharge(doc, packs);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!pattern.test(message)) throw new Error(`expected ${pattern}, got ${message}`);
    return;
  }
  throw new Error(`expected failure ${pattern}`);
}

export function loadNextCharge(root = process.cwd()) {
  const packs = readPacks(root);
  const doc = JSON.parse(fs.readFileSync(path.join(root, "data/v2/next_charge.json"), "utf8"));
  if (doc?.schema === SCHEMA_V4) return validateNextCharge(pageView(validateNextChargeV4(doc, packs)), packs);
  return validateNextCharge(doc, packs);
}

export function checkNextCharge(root = process.cwd()) {
  const file = fs.readFileSync(path.join(root, "data/v2/next_charge.json"));
  const sha = createHash("sha256").update(file).digest("hex");
  if (sha !== FILE_SHA256) throw new Error(`next_charge.json sha256 is ${sha}`);

  const packs = readPacks(root);
  const v4 = loadNextChargeV4(root);
  checkNextChargeV4(root, v4);
  // v2 shape (the page view): synthetic self-tests below.

  const split = layoutParallelBoards([
    {
      series: "C1",
      packs: ["A", "B", "C", "D", "E", "F", "G"],
      current: "normal",
      conditions: [],
      rest_check_limit_V: 0.6,
      last_rule_b_V: 0,
      last_rule_b_call: "GO",
      last_rule_b_session: "2026-10-10",
      last_rule_b_over: ["A"],
      last_rule_b_basis: "recorded",
      outlook_rule_b: {
        value_v: 0,
        packs: ["A"],
        basis: "outlook",
        session: "2026-10-10",
        limit_v: 0.6,
        call: "GO",
        check_first: [],
        value_without_check_first_v: null,
        packs_without_check_first: null,
      },
    },
  ]);
  const second = split[0].boards[1];
  if (split[0].boards[0].name !== "Board A" || second?.name !== "Board B" || second?.ports[0]?.label !== "G") {
    throw new Error("a 7-pack series did not spill onto Board B L1");
  }

  const base = sample();
  const unknownSchema = structuredClone(base);
  unknownSchema.schema = "next_charge/v0";
  expectFail(unknownSchema, packs, /unknown schema version/);

  const unknown = structuredClone(base);
  unknown.storage_runs[0].order = ["NO-SUCH-PACK"];
  expectFail(unknown, packs, /unknown pack NO-SUCH-PACK/);

  const duplicate = structuredClone(base);
  duplicate.storage_runs[0].order = ["C1-P2", "C1-P2"];
  expectFail(duplicate, packs, /duplicate pack C1-P2 in storage/);

  const overlap = structuredClone(base);
  overlap.do_not_connect = [
    {
      label: "C1-P2",
      uid: "CNHL-2026-002",
      pool: "Rest",
      reason: "Rest pool 7-day rest test",
      return_date: "2026-10-16",
    },
  ];
  expectFail(overlap, packs, /C1-P2 is in a connect slot and in do_not_connect/);
  const individualOnBoard = structuredClone(base);
  individualOnBoard.individual = [
    { label: "C1-P2", uid: "CNHL-2026-002", pool: "D", status: "Watch", note: "Charges on its own (D pool)." },
  ];
  expectFail(individualOnBoard, packs, /C1-P2 is in individual and also on a board/);
  const individualExtraKey = structuredClone(base);
  individualExtraKey.individual = [
    { label: "C1-P1", uid: "CNHL-2026-001", pool: "D", status: "Watch", note: "Charges on its own.", set: "C1_C2" },
  ];
  expectFail(individualExtraKey, packs, /individual\[0\] has unknown key set|unknown key set/);
  const individualPool = structuredClone(base);
  individualPool.individual = [
    { label: "C1-P1", uid: "CNHL-2026-001", pool: "C", status: "Watch", note: "Charges on its own." },
  ];
  expectFail(individualPool, packs, /individual\[0\]\.pool must be D/);

  const wrongSeries = structuredClone(base);
  wrongSeries.parallel_boards[0].packs = ["C2-P1"];
  expectFail(wrongSeries, packs, /C2-P1 is C2, not C1/);

  const badUid = structuredClone(base);
  badUid.charge_alone = [{ label: "C1-P5", uid: "CNHL-2026-999", reason: "floor", until: "one clean night" }];
  expectFail(badUid, packs, /uid does not match C1-P5/);

  const crowded = structuredClone(base);
  crowded.parallel_boards[0].packs = Array.from({ length: 25 }, () => "C1-P2");
  expectFail(crowded, packs, /more than 4 parallel boards/);

  const samePackBothSteps = structuredClone(base);
  samePackBothSteps.parallel_boards[0].packs = ["C1-P2"];
  samePackBothSteps.parallel_boards[0].last_rule_b_over = ["C1-P2"];
  samePackBothSteps.parallel_boards[0].outlook_rule_b.packs = ["C1-P2"];
  samePackBothSteps.parallel_boards[0].outlook_rule_b.ir_match.packs[0].label = "C1-P2";
  mirrorActive(samePackBothSteps);
  validateNextCharge(samePackBothSteps, packs);

  const irCall = structuredClone(base);
  irCall.parallel_boards[0].outlook_rule_b.ir_match.call = "CHECK FIRST";
  mirrorActive(irCall);
  expectFail(irCall, packs, /ir_match\.call must be GO/);

  const irCheck = structuredClone(base);
  irCheck.parallel_boards[0].outlook_rule_b.ir_match.packs[0].flag = "check first";
  irCheck.parallel_boards[0].outlook_rule_b.ir_match.check_first = ["C1-P3"];
  irCheck.parallel_boards[0].outlook_rule_b.ir_match.call = "CHECK FIRST";
  mirrorActive(irCheck);
  expectFail(irCheck, packs, /current must be reduced/);

  const irMissing = structuredClone(base);
  delete irMissing.parallel_boards[0].outlook_rule_b.ir_match;
  mirrorActive(irMissing);
  expectFail(irMissing, packs, /missing ir_match/);

  const irHuge = structuredClone(base);
  irHuge.parallel_boards[0].outlook_rule_b.ir_match.board_median_mohm = 384;
  mirrorActive(irHuge);
  expectFail(irHuge, packs, /board_median_mohm must be null or milliohms in 0\.5–15 mΩ/);

  const irPct = structuredClone(base);
  irPct.parallel_boards[0].outlook_rule_b.ir_match.packs[0].pct_off = 5000;
  mirrorActive(irPct);
  expectFail(irPct, packs, /pct_off must be null or a percent in -100–1000 %/);

  const withCoverage = structuredClone(base);
  withCoverage.parallel_boards[0].last_rule_b_over = ["C1-P3"];
  withCoverage.charge_alone = [
    {
      label: "C1-P5",
      uid: "CNHL-2026-005",
      reason: "rest offset",
      until: "next storage night",
      last_offset_max_V: 0.384,
      last_offset_side: "below",
    },
  ];
  mirrorActive(withCoverage);
  validateNextCharge(withCoverage, packs);

  const unknownKey = structuredClone(base);
  unknownKey.parallel_boards[0].last_rule_b_note = "extra";
  expectFail(unknownKey, packs, /unknown key last_rule_b_note/);

  const offBoard = structuredClone(base);
  offBoard.parallel_boards[0].last_rule_b_over = ["C1-P5"];
  expectFail(offBoard, packs, /last_rule_b_over lists C1-P5/);

  const badSide = structuredClone(base);
  badSide.charge_alone = [
    {
      label: "C1-P5",
      uid: "CNHL-2026-005",
      reason: "rest offset",
      until: "next storage night",
      last_offset_max_V: 0.384,
      last_offset_side: "under",
    },
  ];
  expectFail(badSide, packs, /last_offset_side must be below or above/);

  const bareOutlook = structuredClone(base);
  delete bareOutlook.parallel_boards[0].outlook_rule_b.value_v;
  expectFail(bareOutlook, packs, /missing value_v/);

  const unitlessOutlook = structuredClone(base);
  unitlessOutlook.parallel_boards[0].outlook_rule_b.value_v = "0.384";
  expectFail(unitlessOutlook, packs, /value_v must be a number of volts/);

  const hugeOutlook = structuredClone(base);
  hugeOutlook.parallel_boards[0].outlook_rule_b.value_v = 384;
  expectFail(hugeOutlook, packs, /value_v=384 is outside 0–2 V/);

  return v4;
}

// ---------------------------------------------------------------------------
// next_charge/v4 (Rules v7, 2026-10-17): home channels, planner rules and planner fixtures (v6 layout),
// plus the v7 pull and charge-alone lists. Run order and per-charger file counts only; never log numbers.
// planRuns lives in plan-runs.mjs and is re-exported above. /next-charge calls it.
// pageView() is the v2-shaped view fleet and these checks still use.
// loadNextCharge() returns that view. loadNextChargeV4() returns the v4 document.
// No D series in the planner: series boxes come from home_channels.
// ---------------------------------------------------------------------------
const SCHEMA_V4 = "next_charge/v4";
const V4_KEYS = [
  "schema",
  "rules",
  "as_of_session",
  "as_of_date_pt",
  "measurement",
  "home_channels",
  "planner_rules",
  "start_order",
  "planner_fixtures",
  "parallel_boards",
  "pulled",
  "charge_alone",
  "check_before_connecting",
  "watch",
  "performance_notes",
  "self_discharge_checks",
  "notes",
];
const SLOT_STATES = ["active", "empty", "pulled"];
const NO_LOG_NUMBERS = /Storage_\d+|next_log|next_number|log_number|expected_log/i;
const SHORT_CHANNEL = /\bCH[12]\b/;

/** Rules v6/v7 home channel of slot series-Pn. */
export function homeChannel(series, slot) {
  const [a, b] = series === "C1" || series === "C3" ? ["DX8-1", "DX8-2"] : ["DX8-2", "DX8-1"];
  if (slot === 1 || slot === 2) return [a, 1];
  if (slot === 3 || slot === 4) return [a, 2];
  if (slot === 5) return [b, 1];
  if (slot === 6) return [b, 2];
  fail(`slot ${slot} is outside 1–6`);
}

function subsets() {
  const out = [];
  for (let size = 1; size <= 4; size += 1) {
    for (let mask = 1; mask < 16; mask += 1) {
      const set = PLANNER_SERIES.filter((_, index) => mask & (1 << index));
      if (set.length === size) out.push(set);
    }
  }
  return out;
}

function readHomeChannels(rows, packs) {
  if (!Array.isArray(rows)) fail("home_channels must be an array");
  const seen = new Set();
  for (const [index, row] of rows.entries()) {
    const where = `home_channels[${index}]`;
    exactKeys(row, ["label", "uid", "series", "slot", "charger", "channel", "state", "note"], where);
    const label = text(row.label, `${where}.label`);
    if (seen.has(label)) fail(`${where} repeats ${label}`);
    seen.add(label);
    if (!SLOT_STATES.includes(row.state)) fail(`${where}.state must be ${SLOT_STATES.join(", ")}`);
    if (!PLANNER_SERIES.includes(row.series)) fail(`${where}.series must be C1–C4 (there is no D series in v4)`);
    if (!Number.isInteger(row.slot) || row.slot < 1 || row.slot > 6) fail(`${where}.slot must be 1–6`);
    if (label !== `${row.series}-P${row.slot}`) fail(`${where} label must be ${row.series}-P${row.slot}`);
    const [charger, channel] = homeChannel(row.series, row.slot);
    if (row.charger !== charger || row.channel !== channel) {
      fail(`${where} ${label} home is ${channelName(charger, channel)}, not ${channelName(row.charger, row.channel)}`);
    }
    if (row.state === "empty") {
      if (row.uid !== null) fail(`${where}.uid must be null for an empty slot`);
    } else {
      const pack = requirePack(label, packs, where);
      if (text(row.uid, `${where}.uid`) !== pack.uid) fail(`${where}.uid does not match ${label}`);
    }
    if (row.state !== "active") text(row.note, `${where}.note`);
    else if (row.note !== null) text(row.note, `${where}.note`);
  }
  for (const series of PLANNER_SERIES) {
    for (let slot = 1; slot <= 6; slot += 1) if (!seen.has(`${series}-P${slot}`)) fail(`home_channels is missing ${series}-P${slot}`);
  }
  for (const [label] of packs) if (!seen.has(label)) fail(`home_channels is missing ${label}`);
}

function readPlannerRules(rules) {
  exactKeys(rules, ["series_order", "channel_start_order", "skip_empty", "reorder", "include_states", "steps"], "planner_rules");
  if (JSON.stringify(rules.series_order) !== JSON.stringify(PLANNER_SERIES)) fail("planner_rules.series_order must be C1, C2, C3, C4");
  if (JSON.stringify(rules.channel_start_order) !== "[1,2]") fail("planner_rules.channel_start_order must be [1, 2]");
  if (rules.skip_empty !== true || rules.reorder !== false) fail("planner_rules must skip empty slots without reordering");
  if (JSON.stringify(rules.include_states) !== '["active"]') fail('planner_rules.include_states must be ["active"]');
  if (stringList(rules.steps, "planner_rules.steps").length !== 4) fail("planner_rules.steps must have 4 steps");
}

function readFixtures(fixtures, rows, rules) {
  if (!Array.isArray(fixtures)) fail("planner_fixtures must be an array");
  const want = new Set(subsets().map((set) => set.join("+")));
  const real = new Set();
  let synthetic = 0;
  for (const [index, fixture] of fixtures.entries()) {
    const where = `planner_fixtures[${index}]`;
    exactKeys(fixture, ["id", "name", "flown_series", "channels", "rounds", "files"], where, ["fixture_only", "fixture_states"]);
    const flown = stringList(fixture.flown_series, `${where}.flown_series`);
    if (fixture.name !== null) text(fixture.name, `${where}.name`);
    let useRows = rows;
    if ("fixture_only" in fixture || "fixture_states" in fixture) {
      text(fixture.fixture_only, `${where}.fixture_only`);
      if (!isObject(fixture.fixture_states)) fail(`${where}.fixture_states must be an object`);
      useRows = rows.map((row) => (row.label in fixture.fixture_states ? { ...row, state: fixture.fixture_states[row.label] } : row));
      synthetic += 1;
    } else {
      const id = flown.join("+");
      if (fixture.id !== id) fail(`${where}.id must be ${id}`);
      if (!want.has(id) || real.has(id)) fail(`${where} ${id} is unexpected or repeated`);
      real.add(id);
    }
    const plan = planRuns(useRows, rules, flown);
    for (const key of ["channels", "rounds", "files"]) {
      if (JSON.stringify(fixture[key]) !== JSON.stringify(plan[key])) {
        fail(`${where} ${fixture.id} ${key} disagree with the planner: ${JSON.stringify(fixture[key])} vs ${JSON.stringify(plan[key])}`);
      }
    }
  }
  if (real.size !== 15) fail(`planner_fixtures has ${real.size} of the 15 flown-series cases`);
  if (synthetic < 1) fail("planner_fixtures needs the fixture-only pulled case");
}

function readIrMatchV4(match, board, where) {
  const spot = `${where}.ir_match`;
  exactKeys(match, ["basis", "session", "board_median_mohm", "note_pct", "strong_note_pct", "nights_needed", "of_last_nights", "packs", "notes"], spot);
  text(match.basis, `${spot}.basis`);
  text(match.session, `${spot}.session`);
  if (match.board_median_mohm !== null && !(typeof match.board_median_mohm === "number" && match.board_median_mohm > 0 && match.board_median_mohm < 15)) {
    fail(`${spot}.board_median_mohm must be null or a number in 0–15 mΩ`);
  }
  if (!(match.strong_note_pct > match.note_pct && match.note_pct > 0)) fail(`${spot} note limits are out of order`);
  const flagged = [];
  for (const [index, item] of match.packs.entries()) {
    const at_ = `${spot}.packs[${index}]`;
    exactKeys(item, ["label", "avg_mohm", "session", "pct_off", "nights_checked", "nights_over_25_pct", "nights_over_35_pct", "flag"], at_);
    if (!board.packs.includes(item.label)) fail(`${at_} lists ${item.label}, which is not on this board`);
    if (!["ok", "over 25%", "over 35%"].includes(item.flag)) fail(`${at_}.flag must be ok, over 25% or over 35%`);
    if (item.avg_mohm !== null && !(item.avg_mohm >= 0.5 && item.avg_mohm <= 15)) fail(`${at_}.avg_mohm is outside 0.5–15 mΩ`);
    if (item.flag !== "ok") flagged.push(item.label);
  }
  if (stringList(match.notes, `${spot}.notes`).join("+") !== flagged.join("+")) fail(`${spot}.notes must list the flagged packs`);
  return flagged;
}

function readCellCheck(check, board, where) {
  const spot = `${where}.cell_check`;
  exactKeys(check, ["session", "limit_mv", "basis", "pairs", "labels"], spot);
  if (check.limit_mv !== 100) fail(`${spot}.limit_mv must be 100`);
  text(check.basis, `${spot}.basis`);
  if (check.session !== null) text(check.session, `${spot}.session`);
  if (!Array.isArray(check.pairs)) fail(`${spot}.pairs must be an array`);
  const named = new Set();
  for (const [index, pair] of check.pairs.entries()) {
    const at_ = `${spot}.pairs[${index}]`;
    exactKeys(pair, ["labels", "cell", "diff_mv"], at_);
    const labels = stringList(pair.labels, `${at_}.labels`);
    if (labels.length !== 2 || labels[0] === labels[1]) fail(`${at_}.labels must be two packs`);
    for (const label of labels) {
      if (!board.packs.includes(label)) fail(`${at_} lists ${label}, which is not on this board`);
      named.add(label);
    }
    if (!Number.isInteger(pair.cell) || pair.cell < 1 || pair.cell > 6) fail(`${at_}.cell must be 1–6`);
    if (!(Number.isInteger(pair.diff_mv) && pair.diff_mv > check.limit_mv && pair.diff_mv < 4200)) fail(`${at_}.diff_mv must be over ${check.limit_mv} mV`);
  }
  const want = board.packs.filter((label) => named.has(label));
  if (stringList(check.labels, `${spot}.labels`).join("+") !== want.join("+")) fail(`${spot}.labels must list the packs named in pairs, in board order`);
  return named;
}

function readNoteList(items, packs, name) {
  if (!Array.isArray(items)) fail(`${name} must be an array`);
  const labels = new Set();
  for (const [index, item] of items.entries()) {
    const where = `${name}[${index}]`;
    exactKeys(item, ["label", "uid", "note"], where);
    const label = text(item.label, `${where}.label`);
    const pack = requirePack(label, packs, where);
    if (text(item.uid, `${where}.uid`) !== pack.uid) fail(`${where}.uid does not match ${label}`);
    text(item.note, `${where}.note`);
    if (labels.has(label)) fail(`duplicate pack ${label} in ${name}`);
    labels.add(label);
  }
  return labels;
}

export function validateNextChargeV4(doc, packs) {
  if (!isObject(doc)) fail("must be an object");
  if (doc.schema !== SCHEMA_V4) fail(`unknown schema version ${JSON.stringify(doc.schema)}; expected ${SCHEMA_V4}`);
  exactKeys(doc, V4_KEYS, "document");
  if (doc.rules !== "v7") fail(`rules must be v7, got ${JSON.stringify(doc.rules)}`);
  const raw = JSON.stringify(doc);
  if (NO_LOG_NUMBERS.test(raw)) fail(`carries a log number or next-log field (${raw.match(NO_LOG_NUMBERS)[0]})`);
  if (SHORT_CHANNEL.test(raw)) fail('uses a short channel tag; write "DX8-1 Channel 1" in full');
  text(doc.as_of_session, "as_of_session");
  date(doc.as_of_date_pt, "as_of_date_pt");
  exactKeys(doc.measurement, ["rest_rule", "ir_rule", "from_logs", "not_from_logs"], "measurement");
  if (!/90 minutes/.test(text(doc.measurement.rest_rule, "measurement.rest_rule"))) fail("measurement.rest_rule must say 90 minutes");
  if (!/solo/.test(text(doc.measurement.ir_rule, "measurement.ir_rule"))) fail("measurement.ir_rule must say solo");
  stringList(doc.measurement.from_logs, "measurement.from_logs");
  if (!stringList(doc.measurement.not_from_logs, "measurement.not_from_logs").some((item) => /temperature/.test(item))) fail("measurement.not_from_logs must name pack temperature");
  readHomeChannels(doc.home_channels, packs);
  readPlannerRules(doc.planner_rules);
  exactKeys(doc.start_order, ["rule", "mapping"], "start_order");
  text(doc.start_order.rule, "start_order.rule");
  text(doc.start_order.mapping, "start_order.mapping");
  readFixtures(doc.planner_fixtures, doc.home_channels, doc.planner_rules);
  // Pulled: skipped, not charged. pulled[] and the pulled home_channels rows must list the same packs.
  if (!Array.isArray(doc.pulled)) fail("pulled must be an array");
  const pulled = new Set();
  for (const [index, item] of doc.pulled.entries()) {
    const where = `pulled[${index}]`;
    exactKeys(item, ["label", "uid", "reason"], where);
    const pack = requirePack(text(item.label, `${where}.label`), packs, where);
    if (text(item.uid, `${where}.uid`) !== pack.uid) fail(`${where}.uid does not match ${item.label}`);
    if (!/^pulled \(fire risk\)/.test(text(item.reason, `${where}.reason`))) fail(`${where}.reason must start "pulled (fire risk)"`);
    if (pulled.has(item.label)) fail(`duplicate pack ${item.label} in pulled`);
    pulled.add(item.label);
  }
  const pulledRows = doc.home_channels.filter((row) => row.state === "pulled").map((row) => row.label).sort();
  if (pulledRows.join("+") !== [...pulled].sort().join("+")) fail(`pulled (${[...pulled].join("+")}) must match the pulled home_channels rows (${pulledRows.join("+")})`);
  const alone = readAlone(doc.charge_alone, packs, "");
  for (const label of alone) if (pulled.has(label)) fail(`${label} is pulled and in charge_alone`);
  const check = readNoteList(doc.check_before_connecting, packs, "check_before_connecting");
  const watch = readNoteList(doc.watch, packs, "watch");
  const perf = readNoteList(doc.performance_notes, packs, "performance_notes");
  for (const [name, set] of [["charge_alone", alone], ["check_before_connecting", check], ["watch", watch], ["performance_notes", perf]]) {
    for (const label of set) if (pulled.has(label)) fail(`${label} is pulled and in ${name}`);
  }
  if (!Array.isArray(doc.parallel_boards)) fail("parallel_boards must be an array");
  for (const [index, board] of doc.parallel_boards.entries()) {
    const where = `parallel_boards[${index}]`;
    exactKeys(
      board,
      ["series", "packs", "conditions", "rest_check_limit_V", "cell_check_limit_V", "last_rule_b_V", "last_rule_b_call", "last_rule_b_session", "last_rule_b_over", "last_rule_b_basis", "outlook_rule_b"],
      where,
    );
    if (board.series !== PLANNER_SERIES[index]) fail(`${where}.series must be ${PLANNER_SERIES[index]}`);
    const want = doc.home_channels
      .filter((row) => row.series === board.series && row.state === "active")
      .sort((x, y) => x.slot - y.slot)
      .map((row) => row.label);
    if (stringList(board.packs, `${where}.packs`).join("+") !== want.join("+")) fail(`${where}.packs must be ${want.join("+")}`);
    for (const label of board.packs) if (pulled.has(label)) fail(`pulled pack ${label} is on a board`);
    const conditions = stringList(board.conditions, `${where}.conditions`);
    if (!conditions.some((item) => /0\.60 V/.test(item) && /0\.10 V/.test(item))) fail(`${where}.conditions must state the 0.60 V and 0.10 V checks`);
    voltLimit(board.rest_check_limit_V, `${where}.rest_check_limit_V`);
    if (board.rest_check_limit_V !== 0.6 || board.cell_check_limit_V !== 0.1) fail(`${where} limits must be 0.60 V and 0.10 V`);
    for (const label of readRecordedRuleB(board, where)) if (!board.packs.includes(label) && !pulled.has(label)) fail(`${where}.last_rule_b_over lists ${label}`);
    const { cell_check: cellCheck, ...outlook } = board.outlook_rule_b;
    readOutlook(outlook, packs, board, where);
    for (const label of readCellCheck(cellCheck, board, `${where}.outlook_rule_b`)) {
      if (!check.has(label)) fail(`${label} is in the per-cell check but not in check_before_connecting`);
    }
    for (const label of readIrMatchV4(board.outlook_rule_b.ir_match, board, `${where}.outlook_rule_b`)) {
      if (!perf.has(label)) fail(`${label} has an IR match note but no performance note`);
    }
  }
  const sd = doc.self_discharge_checks;
  exactKeys(
    sd,
    ["pull_rule", "pull_relative_mv", "pull_window_h", "pull_any_cell_mv", "pull_any_cell_h", "how_we_check", "longer_gaps", "performance_grade", "open"],
    "self_discharge_checks",
  );
  if (sd.pull_relative_mv !== 50 || JSON.stringify(sd.pull_window_h) !== "[48,72]" || sd.pull_any_cell_mv !== 100 || sd.pull_any_cell_h !== 24) {
    fail("self_discharge_checks limits must be 50 mV in 48–72 h and 100 mV in 24 h");
  }
  for (const key of ["pull_rule", "how_we_check", "longer_gaps", "performance_grade"]) text(sd[key], `self_discharge_checks.${key}`);
  if (!/note only/.test(sd.performance_grade)) fail("self_discharge_checks.performance_grade must say the grade is a note only");
  for (const [index, item] of sd.open.entries()) {
    const where = `self_discharge_checks.open[${index}]`;
    exactKeys(item, ["test_id", "label", "uid", "suspect_cell", "storage_end_date", "storage_end_mV", "completes_from"], where);
    const pack = requirePack(text(item.label, `${where}.label`), packs, where);
    if (item.uid !== pack.uid) fail(`${where}.uid does not match ${item.label}`);
    date(item.storage_end_date, `${where}.storage_end_date`);
    if (!Array.isArray(item.storage_end_mV) || item.storage_end_mV.length !== 6 || item.storage_end_mV.some((v) => !(v >= 2500 && v <= 4350))) {
      fail(`${where}.storage_end_mV must be 6 cell voltages in mV`);
    }
  }
  stringList(doc.notes, "notes");
  return doc;
}

/** Transitional v2-shaped view for the current page (set A and set B). */
export function pageView(doc) {
  const sets = {};
  const alone = new Set(doc.charge_alone.map((item) => item.label));
  // The page's watch list: watch notes, then the check-before-connecting advisories (one entry per pack).
  const watch = [];
  for (const item of [...doc.watch, ...doc.check_before_connecting]) {
    const prior = watch.find((entry) => entry.label === item.label);
    if (prior) prior.note = `${prior.note} ${item.note}`;
    else watch.push({ ...item });
  }
  const order = doc.home_channels.map((row) => row.label);
  watch.sort((x, y) => order.indexOf(x.label) - order.indexOf(y.label));
  for (const [id, series] of [["C1+C2", ["C1", "C2"]], ["C3+C4", ["C3", "C4"]]]) {
    const plan = planRuns(doc.home_channels, doc.planner_rules, series);
    const storage_runs = PLANNER_CHANNELS.map(([charger, channel]) => ({
      charger,
      channel: `Channel ${channel}`,
      order: plan.channels[channelName(charger, channel)],
      mode: "one pack per run, in this order",
    })).filter((run) => run.order.length > 0);
    const parallel_boards = doc.parallel_boards
      .filter((board) => series.includes(board.series))
      .map((board) => {
        const { cell_check: _cell, ir_match: match, ...outlook } = board.outlook_rule_b;
        const packsOn = board.packs.filter((label) => !alone.has(label));
        return {
          series: board.series,
          packs: packsOn,
          current: "normal",
          conditions: board.conditions,
          rest_check_limit_V: board.rest_check_limit_V,
          last_rule_b_V: board.last_rule_b_V,
          last_rule_b_call: board.last_rule_b_call,
          last_rule_b_session: board.last_rule_b_session,
          last_rule_b_over: board.last_rule_b_over.filter((label) => packsOn.includes(label)),
          last_rule_b_basis: board.last_rule_b_basis,
          outlook_rule_b: {
            ...outlook,
            packs: outlook.packs.filter((label) => packsOn.includes(label)),
            check_first: outlook.check_first.filter((item) => packsOn.includes(item.label)),
            ...(outlook.check_first.some((item) => packsOn.includes(item.label))
              ? { packs_without_check_first: outlook.packs_without_check_first.filter((label) => packsOn.includes(label)) }
              : { call: "GO", value_without_check_first_v: null, packs_without_check_first: null }),
            ir_match: {
              basis: match.basis,
              session: match.session,
              board_median_mohm: match.board_median_mohm,
              check_first_pct: match.note_pct,
              charge_alone_pct: match.strong_note_pct,
              nights_needed: match.nights_needed,
              of_last_nights: match.of_last_nights,
              packs: match.packs
                .filter((item) => packsOn.includes(item.label))
                .map((item) => ({
                  label: item.label,
                  avg_mohm: item.avg_mohm,
                  session: item.session,
                  pct_off: item.pct_off,
                  nights_checked: item.nights_checked,
                  nights_over_check_pct: item.nights_over_25_pct,
                  nights_over_alone_pct: item.nights_over_35_pct,
                  flag: "ok",
                })),
              check_first: [],
              charge_alone: [],
              call: "GO",
            },
          },
        };
      });
    const inSet = (item) => series.includes(item.label.split("-")[0]);
    const sessions = parallel_boards.map((board) => board.outlook_rule_b.session).filter(Boolean).sort();
    sets[chargeSetId(id)] = {
      series,
      last_storage_session: sessions.at(-1) ?? doc.as_of_session,
      storage_runs,
      parallel_boards,
      charge_alone: doc.charge_alone.filter(inSet),
      watch: watch.filter(inSet),
    };
  }
  const active = sets.C1_C2;
  return {
    schema: SCHEMA,
    rules: "v7",
    as_of_session: doc.as_of_session,
    as_of_date_pt: doc.as_of_date_pt,
    active_set: "C1+C2",
    active_set_reason:
      "Rules v7: every series that was flown is charged, each pack on its home channel. Set A and set B are shown here; the data file has the run order for every mix of series.",
    alternate_set: "C3+C4",
    storage_runs: active.storage_runs,
    parallel_boards: active.parallel_boards,
    charge_alone: active.charge_alone,
    watch: active.watch,
    sets,
    do_not_connect: [],
    notes: doc.notes,
  };
}

export function loadNextChargeV4(root = process.cwd()) {
  const packs = readPacks(root);
  const doc = JSON.parse(fs.readFileSync(path.join(root, "data/v2/next_charge.json"), "utf8"));
  return validateNextChargeV4(doc, packs);
}

function expectFailV4(doc, packs, pattern) {
  try {
    validateNextChargeV4(doc, packs);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!pattern.test(message)) throw new Error(`expected ${pattern}, got ${message}`);
    return;
  }
  throw new Error(`expected failure ${pattern}`);
}

function checkNextChargeV4(root, doc) {
  const packs = readPacks(root);
  const rows = doc.home_channels;
  const row = (label) => rows.find((item) => item.label === label);
  if (rows.length !== 24) throw new Error(`home_channels has ${rows.length} rows`);
  const p1 = row("C1-P1");
  if (p1.uid !== "CNHL-2026-001" || p1.state !== "active" || p1.charger !== "DX8-1" || p1.channel !== 1 || !/Back from the D pool/.test(p1.note)) {
    throw new Error("C1-P1 must be CNHL-2026-001, active on DX8-1 Channel 1, back from the D pool");
  }
  if (rows.some((item) => item.series === "D" || item.label.startsWith("D-"))) throw new Error("no D row in v4");
  if (rows.some((item) => item.state !== "active")) throw new Error("every real slot is active");
  const all = doc.planner_fixtures.find((item) => item.id === "C1+C2+C3+C4");
  const want = {
    "DX8-1 Channel 1": ["C1-P1", "C1-P2", "C2-P5", "C3-P1", "C3-P2", "C4-P5"],
    "DX8-1 Channel 2": ["C1-P3", "C1-P4", "C2-P6", "C3-P3", "C3-P4", "C4-P6"],
    "DX8-2 Channel 1": ["C1-P5", "C2-P1", "C2-P2", "C3-P5", "C4-P1", "C4-P2"],
    "DX8-2 Channel 2": ["C1-P6", "C2-P3", "C2-P4", "C3-P6", "C4-P3", "C4-P4"],
  };
  if (JSON.stringify(all?.channels) !== JSON.stringify(want) || all.files["DX8-1"] !== 12 || all.files["DX8-2"] !== 12) throw new Error(`all-four run order is ${JSON.stringify(all?.channels)}`);
  const c1 = doc.planner_fixtures.find((item) => item.id === "C1");
  if (JSON.stringify(c1?.rounds) !== JSON.stringify({ "DX8-1": [["C1-P1", "C1-P3"], ["C1-P2", "C1-P4"]], "DX8-2": [["C1-P5", "C1-P6"]] })) throw new Error("C1 rounds changed");
  const synth = doc.planner_fixtures.find((item) => item.fixture_states);
  if (!synth || JSON.stringify(synth.fixture_states) !== '{"C2-P3":"pulled"}' || synth.channels["DX8-2 Channel 2"].join("+") !== "C2-P4" || synth.files["DX8-2"] !== 3) {
    throw new Error("the fixture-only pulled C2-P3 case changed");
  }
  if (doc.planner_fixtures.length !== 16) throw new Error(`planner_fixtures has ${doc.planner_fixtures.length}`);
  console.log(`planner fixtures ${doc.planner_fixtures.length}/16`);
  if (doc.pulled.length !== 0 || doc.charge_alone.length !== 0) throw new Error("pulled and charge_alone must be empty on the real data");
  const labels = (list) => list.map((item) => item.label).join("+");
  if (labels(doc.watch) !== "C1-P1+C1-P4+C2-P2") throw new Error(`watch is ${labels(doc.watch)}`);
  if (labels(doc.check_before_connecting) !== "C3-P1+C3-P2+C3-P3+C3-P4+C3-P5+C3-P6") throw new Error(`check_before_connecting is ${labels(doc.check_before_connecting)}`);
  if (labels(doc.performance_notes) !== "C1-P1+C1-P4+C1-P5+C2-P1+C2-P2+C3-P2+C3-P5+C3-P6+C4-P2") throw new Error(`performance_notes is ${labels(doc.performance_notes)}`);
  if (doc.self_discharge_checks.open.map((item) => item.test_id).sort().join("+") !== "RT-004-1+RT-008-1") throw new Error("open self-discharge checks changed");
  const boards = doc.parallel_boards.map((board) => `${board.series}:${board.packs.length}:${board.outlook_rule_b.value_v}:${board.outlook_rule_b.call}:${board.outlook_rule_b.cell_check.labels.join("+")}`).join(" ");
  if (boards !== "C1:6:0.18:GO: C2:6:0.005:GO: C3:6:1.158:CHECK FIRST:C3-P1+C3-P2+C3-P3+C3-P4+C3-P5+C3-P6 C4:6:0.005:GO:") throw new Error(`boards are ${boards}`);
  if (doc.parallel_boards[2].outlook_rule_b.check_first.map((item) => item.label).join("+") !== "C3-P1") throw new Error("C3 check-first changed");

  // Self-tests on copies of the real file.
  let selfTests = 0;
  const bad = (edit, pattern) => {
    selfTests += 1;
    const copy = structuredClone(doc);
    edit(copy);
    expectFailV4(copy, packs, pattern);
  };
  bad((d) => (d.schema = "next_charge/v3"), /unknown schema version/);
  bad((d) => (d.rules = "v6"), /rules must be v7/);
  bad((d) => (d.planner_rules.next_log_number = { "DX8-1": 1 }), /log number or next-log field|unknown key/);
  bad((d) => (d.notes = [...d.notes, "Storage_533 first"]), /log number/);
  bad((d) => (d.notes = [...d.notes, "DX8-1 CH1 first"]), /short channel tag/);
  bad((d) => (row2(d, "C1-P2").channel = 2), /home is DX8-1 Channel 1/);
  bad((d) => (row2(d, "C1-P1").uid = "CNHL-2026-002"), /uid does not match C1-P1/);
  bad((d) => d.home_channels.push({ label: "D-1", uid: "CNHL-2026-001", series: "D", slot: 1, charger: "DX8-2", channel: 1, state: "active", note: null }), /no D series/);
  bad((d) => (d.planner_rules.series_order = [...PLANNER_SERIES, "D"]), /series_order must be C1, C2, C3, C4/);
  bad((d) => (d.home_channels = d.home_channels.filter((item) => item.label !== "C4-P6")), /missing C4-P6/);
  bad((d) => d.planner_fixtures[0].channels["DX8-1 Channel 1"].reverse().push("C2-P5"), /disagree with the planner/);
  bad((d) => (d.planner_fixtures[5].files["DX8-2"] += 1), /files disagree/);
  bad((d) => d.planner_fixtures.splice(3, 1), /14 of the 15/);
  bad((d) => (d.planner_fixtures.at(-1).fixture_states = { "C2-P3": "active" }), /disagree with the planner/);
  bad((d) => (d.planner_rules.skip_empty = false), /skip empty slots/);
  bad((d) => d.parallel_boards[0].packs.push("C2-P1"), /packs must be/);
  bad((d) => (row2(d, "C2-P3").state = "pulled", row2(d, "C2-P3").note = "test"), /must match the pulled home_channels rows|disagree with the planner/);
  bad((d) => d.pulled.push({ label: "C2-P3", uid: row2(d, "C2-P3").uid, reason: "pulled (fire risk): test" }), /must match the pulled home_channels rows/);
  bad((d) => (d.self_discharge_checks.pull_relative_mv = 100), /limits must be 50 mV/);
  bad((d) => (d.parallel_boards[0].cell_check_limit_V = 0.2), /limits must be 0.60 V and 0.10 V/);
  bad((d) => (d.check_before_connecting = d.check_before_connecting.filter((item) => item.label !== "C3-P4")), /C3-P4 is in the per-cell check/);
  bad((d) => (d.parallel_boards[3].outlook_rule_b.cell_check.pairs = [{ labels: ["C4-P1", "C4-P2"], cell: 1, diff_mv: 80 }]), /diff_mv must be over 100/);
  bad((d) => (d.measurement.not_from_logs = ["flight times"]), /pack temperature/);
  if (selfTests !== 23) throw new Error(`expected 23 v4 self-tests, ran ${selfTests}`);
  console.log(`next charge v4 self-tests ${selfTests}/23`);
  {
    const copy = structuredClone(doc);
    copy.charge_alone.push({ label: "C2-P3", uid: row2(copy, "C2-P3").uid, reason: "C6 single-cell IR step: test", until: "that board night only; no status change" });
    validateNextChargeV4(copy, packs);
    const view = validateNextCharge(pageView(copy), packs);
    if (view.sets.C1_C2.parallel_boards[1].packs.includes("C2-P3") || !view.charge_alone.some((item) => item.label === "C2-P3")) throw new Error("a charge-alone pack must leave the page board view");
  }

  // The page view (v2 shape) is built from the v4 file.
  const view = validateNextCharge(pageView(doc), packs);
  const summary = storageSummary(view.storage_runs).map((item) => item.line).join("\n");
  const expected = [
    "DX8-1 Channel 1 C1-P1 · Channel 2 C1-P3 · DX8-2 Channel 1 C1-P5 · Channel 2 C1-P6",
    "DX8-1 Channel 1 C1-P2 · Channel 2 C1-P4 · DX8-2 Channel 1 C2-P1 · Channel 2 C2-P3",
    "DX8-1 Channel 1 C2-P5 · Channel 2 C2-P6 · DX8-2 Channel 1 C2-P2 · Channel 2 C2-P4",
  ].join("\n");
  if (summary !== expected) throw new Error(`set A view summary is\n${summary}`);
  if (view.do_not_connect.length !== 0 || view.sets.C1_C2.parallel_boards.map((board) => board.packs.join("+")).join(" ") !== "C1-P1+C1-P2+C1-P3+C1-P4+C1-P5+C1-P6 C2-P1+C2-P2+C2-P3+C2-P4+C2-P5+C2-P6") {
    throw new Error("set A view boards changed");
  }
  return view;
}

function row2(doc, label) {
  return doc.home_channels.find((item) => item.label === label);
}
