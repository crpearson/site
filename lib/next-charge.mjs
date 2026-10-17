import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SCHEMA = "next_charge/v2";
const FILE_SHA256 = "6e7456a3c501d480f586655dbb4bba408e78163b70d5f39a209736b7b326d4d6";
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
  exactKeys(doc, TOP_KEYS, "document", ["locked", "locked_reason"]);
  if (doc.rules !== "v5") fail(`rules must be v5, got ${JSON.stringify(doc.rules)}`);
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
  // Rules v5 IR board match: checked last, after the plan and pool checks.
  const ruleSets = [["", doc], ...[activeId, alternateId].map((id) => [`sets.${id}.`, doc.sets[id]])];
  for (const [prefix, plan] of ruleSets) {
    for (const [index, board] of plan.parallel_boards.entries()) {
      readIrMatch(board.outlook_rule_b.ir_match, board, `${prefix}parallel_boards[${index}].outlook_rule_b`);
    }
  }
  return doc;
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
  return validateNextCharge(doc, packs);
}

export function checkNextCharge(root = process.cwd()) {
  const file = fs.readFileSync(path.join(root, "data/v2/next_charge.json"));
  const sha = createHash("sha256").update(file).digest("hex");
  if (sha !== FILE_SHA256) throw new Error(`next_charge.json sha256 is ${sha}`);

  const packs = readPacks(root);
  const doc = loadNextCharge(root);
  if (doc.schema !== SCHEMA || doc.rules !== "v5") throw new Error(`schema is ${doc.schema} rules=${doc.rules}`);
  if (doc.active_set !== "C1+C2" || doc.alternate_set !== "C3+C4" || doc.locked != null) {
    throw new Error(`active set is ${doc.active_set} locked=${doc.locked} alternate=${doc.alternate_set}`);
  }
  if (
    doc.active_set_reason !==
    "rotation: set A (C1+C2) is the least recently charged set (last storage night 2026-10-11); set B ran 2026-10-14 and 2026-10-16"
  ) {
    throw new Error(`active_set_reason is ${doc.active_set_reason}`);
  }

  const summary = storageSummary(doc.storage_runs).map((item) => item.line);
  const expected = [
    "DX8-1 CH1 C1-P2 · CH2 C1-P5 · DX8-2 CH1 C2-P1 · CH2 C2-P4",
    "DX8-1 CH1 C1-P3 · CH2 C1-P6 · DX8-2 CH1 C2-P3 · CH2 C2-P5",
    "DX8-2 CH2 C2-P6",
  ];
  if (summary.join("\n") !== expected.join("\n")) {
    throw new Error(`storage summary is\n${summary.join("\n")}`);
  }
  const first = storageChargers(doc.storage_runs)[0]?.channels[0]?.runs.map((run) => `${run.run}:${run.label}`).join(" ");
  if (first !== "1:C1-P2 2:C1-P3") throw new Error(`DX8-1 CH1 runs are ${first}`);

  const active = doc.sets.C1_C2;
  const laid = layoutParallelBoards(active.parallel_boards);
  const c1 = laid[0]?.boards[0]?.ports.map((port) => `${port.id}:${port.label ?? "-"}`).join(" ");
  const c2 = laid[1]?.boards[0]?.ports.map((port) => `${port.id}:${port.label ?? "-"}`).join(" ");
  if (laid[0]?.boards[0]?.name !== "Board A" || c1 !== "L1:C1-P2 L2:C1-P3 L3:C1-P5 R1:C1-P6 R2:- R3:-") {
    throw new Error(`C1 board is ${laid[0]?.boards[0]?.name} ${c1}`);
  }
  if (laid[1]?.boards[0]?.name !== "Board B" || c2 !== "L1:C2-P1 L2:C2-P3 L3:C2-P4 R1:C2-P5 R2:C2-P6 R3:-") {
    throw new Error(`C2 board is ${laid[1]?.boards[0]?.name} ${c2}`);
  }
  const c1Rule = active.parallel_boards.find((board) => board.series === "C1");
  const c2Rule = active.parallel_boards.find((board) => board.series === "C2");
  if (
    c1Rule?.last_rule_b_V !== 0.186 ||
    c1Rule.last_rule_b_call !== "GO" ||
    c1Rule.last_rule_b_session !== "2026-10-11" ||
    c1Rule.rest_check_limit_V !== 0.6 ||
    c1Rule.last_rule_b_over?.join("+") !== "C1-P2+C1-P3+C1-P6" ||
    c1Rule.outlook_rule_b.value_v !== 0.384 ||
    c1Rule.outlook_rule_b.call !== "GO" ||
    c1Rule.outlook_rule_b.limit_v !== 0.6 ||
    c1Rule.outlook_rule_b.packs.join("+") !== "C1-P2+C1-P3+C1-P5+C1-P6" ||
    c1Rule.outlook_rule_b.check_first.length !== 0
  ) {
    throw new Error(`C1 recorded Rule B is ${c1Rule?.last_rule_b_V} outlook ${c1Rule?.outlook_rule_b?.value_v}`);
  }
  if (
    c2Rule?.last_rule_b_V !== 0.23 ||
    c2Rule.last_rule_b_call !== "GO" ||
    c2Rule.last_rule_b_session !== "2026-10-11" ||
    c2Rule.rest_check_limit_V !== 0.6 ||
    c2Rule.last_rule_b_over?.join("+") !== "C2-P1+C2-P3+C2-P4+C2-P5" ||
    c2Rule.outlook_rule_b.value_v !== 0.425 ||
    c2Rule.outlook_rule_b.call !== "GO" ||
    c2Rule.outlook_rule_b.packs.join("+") !== "C2-P1+C2-P3+C2-P4+C2-P5+C2-P6"
  ) {
    throw new Error(`C2 recorded Rule B is ${c2Rule?.last_rule_b_V} outlook ${c2Rule?.outlook_rule_b?.value_v}`);
  }
  if (active.charge_alone.length !== 0) throw new Error("set A still has a charge-alone list");
  if (active.watch.map((item) => item.label).join("+") !== "C1-P5+C2-P1") {
    throw new Error(`set A watch is ${active.watch.map((item) => item.label).join("+")}`);
  }

  const fresh = doc.sets.C3_C4;
  const freshRuns = fresh.storage_runs.map((run) => `${run.charger} ${run.channel} ${run.order.join("+")}`).join(" | ");
  if (
    freshRuns !==
    "DX8-1 CH1 C3-P1+C3-P2+C3-P3 | DX8-1 CH2 C3-P4+C3-P5+C3-P6 | DX8-2 CH1 C4-P1+C4-P2+C4-P3 | DX8-2 CH2 C4-P4+C4-P5+C4-P6"
  ) {
    throw new Error(`C3+C4 runs are ${freshRuns}`);
  }
  const boardMode = "one pack per run, in this order";
  if ([...doc.storage_runs, ...fresh.storage_runs].some((run) => run.mode !== boardMode)) {
    throw new Error("a storage run is not one pack per run, in this order");
  }
  const freshLaid = layoutParallelBoards(fresh.parallel_boards);
  const c3 = freshLaid[0]?.boards[0]?.ports.map((port) => `${port.id}:${port.label ?? "-"}`).join(" ");
  const c4 = freshLaid[1]?.boards[0]?.ports.map((port) => `${port.id}:${port.label ?? "-"}`).join(" ");
  if (
    freshLaid[0]?.boards[0]?.name !== "Board A" ||
    c3 !== "L1:C3-P1 L2:C3-P2 L3:C3-P3 R1:C3-P4 R2:C3-P5 R3:C3-P6"
  ) {
    throw new Error(`C3 board is ${freshLaid[0]?.boards[0]?.name} ${c3}`);
  }
  if (
    freshLaid[1]?.boards[0]?.name !== "Board B" ||
    c4 !== "L1:C4-P1 L2:C4-P2 L3:C4-P3 R1:C4-P4 R2:C4-P5 R3:C4-P6"
  ) {
    throw new Error(`C4 board is ${freshLaid[1]?.boards[0]?.name} ${c4}`);
  }
  const c3Rule = fresh.parallel_boards.find((board) => board.series === "C3");
  const c4Rule = fresh.parallel_boards.find((board) => board.series === "C4");
  if (
    c3Rule?.last_rule_b_V !== null ||
    c3Rule.last_rule_b_call !== null ||
    c3Rule.last_rule_b_session !== null ||
    c3Rule.last_rule_b_over.length !== 0 ||
    c3Rule.rest_check_limit_V !== 0.6 ||
    c3Rule.outlook_rule_b.value_v !== 0.629 ||
    c3Rule.outlook_rule_b.call !== "CHECK FIRST" ||
    c3Rule.outlook_rule_b.limit_v !== 0.6 ||
    c3Rule.outlook_rule_b.value_without_check_first_v !== 0.43 ||
    c3Rule.outlook_rule_b.packs_without_check_first?.join("+") !== "C3-P1+C3-P2+C3-P3+C3-P4+C3-P6" ||
    c3Rule.outlook_rule_b.check_first.map((item) => item.label).join("+") !== "C3-P5"
  ) {
    throw new Error(`C3 recorded Rule B is ${c3Rule?.last_rule_b_V} outlook ${c3Rule?.outlook_rule_b?.value_v}`);
  }
  if (
    c4Rule?.last_rule_b_V !== null ||
    c4Rule.last_rule_b_over.length !== 0 ||
    c4Rule.outlook_rule_b.value_v !== 0.249 ||
    c4Rule.outlook_rule_b.call !== "GO" ||
    c4Rule.outlook_rule_b.check_first.length !== 0 ||
    !c4Rule.packs.includes("C4-P2") ||
    c4Rule.outlook_rule_b.packs.join("+") !== "C4-P1+C4-P2+C4-P3+C4-P4+C4-P5+C4-P6"
  ) {
    throw new Error(`C4 recorded Rule B is ${c4Rule?.last_rule_b_V} outlook ${c4Rule?.outlook_rule_b?.value_v}`);
  }
  if (fresh.charge_alone.length !== 0 || fresh.join_status != null || active.join_status != null) {
    throw new Error("a set still has charge-alone packs or a join list");
  }
  const notes = {
    "C3-P2":
      "Watch (note only, stays on its board): rest V was the highest in C3 on 2026-10-16 (22.225 V); no cell issue.",
    "C3-P5":
      "Watch (note only, stays on its board): lowest cell 3592 mV (Cell 1) on 2026-10-16, just under 3600, with all six cells even; rest V 21.596 V was the lowest in C3.",
    "C3-P6":
      "Watch (note only, stays on its board): Cell 6 started 128 mV below the other cells once (2026-10-16).",
    "C4-P2":
      "Watch (note only, stays on its board): Cell 6 started low on 2026-10-14 and 2026-10-16 (175 mV, then 58 mV below the other cells); recheck next C3+C4 storage night.",
  };
  if (fresh.watch.map((item) => item.label).join("+") !== "C3-P2+C3-P5+C3-P6+C4-P2") {
    throw new Error(`set B watch is ${fresh.watch.map((item) => item.label).join("+")}`);
  }
  for (const [label, note] of Object.entries(notes)) {
    if (fresh.watch.find((item) => item.label === label)?.note !== note) throw new Error(`${label} watch note changed`);
  }

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

  return doc;
}
