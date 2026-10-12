import fs from "node:fs";
import path from "node:path";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SCHEMA = "next_charge/v1";

export const BOARD_PORT_IDS = ["L1", "L2", "L3", "R1", "R2", "R3"];
export const BOARD_NAMES = ["Board A", "Board B", "Board C", "Board D"];

const TOP_KEYS = [
  "schema",
  "as_of_session",
  "as_of_date_pt",
  "storage_runs",
  "parallel_boards",
  "charge_alone",
  "do_not_connect",
  "notes",
];

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

export function validateNextCharge(doc, packs) {
  if (!isObject(doc)) fail("must be an object");
  if (doc.schema !== SCHEMA) {
    const shown = doc.schema === undefined ? "(missing)" : JSON.stringify(doc.schema);
    fail(`unknown schema version ${shown}; expected ${SCHEMA}`);
  }
  exactKeys(doc, TOP_KEYS, "document");
  text(doc.as_of_session, "as_of_session");
  date(doc.as_of_date_pt, "as_of_date_pt");
  if (!Array.isArray(doc.storage_runs)) fail("storage_runs must be an array");
  if (!Array.isArray(doc.parallel_boards)) fail("parallel_boards must be an array");
  if (!Array.isArray(doc.charge_alone)) fail("charge_alone must be an array");
  if (!Array.isArray(doc.do_not_connect)) fail("do_not_connect must be an array");
  stringList(doc.notes, "notes");

  const storageLabels = new Set();
  const seenChannel = new Set();
  for (const [index, run] of doc.storage_runs.entries()) {
    const where = `storage_runs[${index}]`;
    exactKeys(run, ["charger", "channel", "order"], where);
    text(run.charger, `${where}.charger`);
    text(run.channel, `${where}.channel`);
    const key = `${run.charger}\0${run.channel}`;
    if (seenChannel.has(key)) fail(`${where} repeats ${run.charger} ${run.channel}`);
    seenChannel.add(key);
    const order = stringList(run.order, `${where}.order`);
    if (order.length === 0) fail(`${where}.order is empty`);
    for (const label of order) {
      requirePack(label, packs, where);
      if (storageLabels.has(label)) fail(`duplicate pack ${label} in storage`);
      storageLabels.add(label);
    }
  }

  let boardsNeeded = 0;
  for (const [index, board] of doc.parallel_boards.entries()) {
    const where = `parallel_boards[${index}]`;
    exactKeys(
      board,
      ["series", "packs", "current", "conditions", "last_rule_b_V", "last_rule_b_call", "last_rule_b_session"],
      where,
      ["last_rule_b_over"],
    );
    text(board.series, `${where}.series`);
    if (board.current !== "normal" && board.current !== "reduced") {
      fail(`${where}.current must be normal or reduced`);
    }
    stringList(board.conditions, `${where}.conditions`);
    if (typeof board.last_rule_b_V !== "number" || !Number.isFinite(board.last_rule_b_V)) {
      fail(`${where}.last_rule_b_V must be a finite number`);
    }
    text(board.last_rule_b_call, `${where}.last_rule_b_call`);
    text(board.last_rule_b_session, `${where}.last_rule_b_session`);
    if ("last_rule_b_over" in board) {
      const over = stringList(board.last_rule_b_over, `${where}.last_rule_b_over`);
      if (over.length === 0) fail(`${where}.last_rule_b_over is empty`);
    }
    const labels = stringList(board.packs, `${where}.packs`);
    boardsNeeded += labels.length === 0 ? 1 : Math.ceil(labels.length / BOARD_PORT_IDS.length);
  }
  if (boardsNeeded > BOARD_NAMES.length) fail("needs more than 4 parallel boards");

  const parallelLabels = new Set();
  for (const [index, board] of doc.parallel_boards.entries()) {
    const where = `parallel_boards[${index}]`;
    const seen = new Set();
    for (const label of board.packs) {
      const pack = requirePack(label, packs, where);
      if (pack.series !== board.series) fail(`${label} is ${pack.series}, not ${board.series}`);
      if (seen.has(label) || parallelLabels.has(label)) fail(`duplicate pack ${label} on parallel boards`);
      seen.add(label);
      parallelLabels.add(label);
    }
    if (Array.isArray(board.last_rule_b_over)) {
      const covered = new Set();
      for (const label of board.last_rule_b_over) {
        if (!board.packs.includes(label)) {
          fail(`${where}.last_rule_b_over lists ${label}, which is not on this board`);
        }
        if (covered.has(label)) fail(`${where}.last_rule_b_over repeats ${label}`);
        covered.add(label);
      }
    }
  }

  const aloneLabels = new Set();
  for (const [index, item] of doc.charge_alone.entries()) {
    const where = `charge_alone[${index}]`;
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
    if (aloneLabels.has(label)) fail(`duplicate pack ${label} in charge_alone`);
    aloneLabels.add(label);
  }

  const held = new Set();
  for (const [index, item] of doc.do_not_connect.entries()) {
    const where = `do_not_connect[${index}]`;
    exactKeys(item, ["label", "uid", "pool", "reason", "return_date"], where);
    const label = text(item.label, `${where}.label`);
    const pack = requirePack(label, packs, where);
    if (text(item.uid, `${where}.uid`) !== pack.uid) fail(`${where}.uid does not match ${label}`);
    text(item.pool, `${where}.pool`);
    text(item.reason, `${where}.reason`);
    date(item.return_date, `${where}.return_date`);
    if (held.has(label)) fail(`duplicate pack ${label} in do_not_connect`);
    if (storageLabels.has(label) || parallelLabels.has(label) || aloneLabels.has(label)) {
      fail(`${label} is in a connect slot and in do_not_connect`);
    }
    held.add(label);
  }

  layoutParallelBoards(doc.parallel_boards);
  return doc;
}

function sample() {
  return {
    schema: SCHEMA,
    as_of_session: "2026-10-10",
    as_of_date_pt: "2026-10-10",
    storage_runs: [{ charger: "DX8-1", channel: "CH1", order: ["C1-P2"] }],
    parallel_boards: [
      {
        series: "C1",
        packs: ["C1-P3"],
        current: "normal",
        conditions: [],
        last_rule_b_V: 0.135,
        last_rule_b_call: "GO",
        last_rule_b_session: "2026-10-10",
      },
    ],
    charge_alone: [],
    do_not_connect: [],
    notes: [],
  };
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
  const packs = readPacks(root);
  const doc = loadNextCharge(root);
  const summary = storageSummary(doc.storage_runs).map((item) => item.line);
  const expected = [
    "DX8-1 CH1 C1-P2 · CH2 C1-P5 · DX8-2 CH1 C2-P1 · CH2 C2-P4",
    "DX8-1 CH1 C1-P3 · CH2 C1-P6 · DX8-2 CH1 C2-P3 · CH2 C2-P5",
    "DX8-2 CH2 C2-P6",
  ];
  if (summary.join("\n") !== expected.join("\n")) {
    throw new Error(`storage summary is\n${summary.join("\n")}`);
  }
  const chargers = storageChargers(doc.storage_runs);
  const first = chargers[0]?.channels[0]?.runs.map((run) => `${run.run}:${run.label}`).join(" ");
  if (first !== "1:C1-P2 2:C1-P3") throw new Error(`DX8-1 CH1 runs are ${first}`);
  for (const charger of chargers) {
    for (const channel of charger.channels) {
      if (channel.runs.some((run) => !run.label)) throw new Error(`${charger.charger} ${channel.channel} has an empty run`);
    }
  }

  const laid = layoutParallelBoards(doc.parallel_boards);
  const c1 = laid[0]?.boards[0]?.ports.map((port) => `${port.id}:${port.label ?? "-"}`).join(" ");
  const c2 = laid[1]?.boards[0]?.ports.map((port) => `${port.id}:${port.label ?? "-"}`).join(" ");
  if (laid[0]?.boards[0]?.name !== "Board A" || c1 !== "L1:C1-P2 L2:C1-P3 L3:C1-P6 R1:- R2:- R3:-") {
    throw new Error(`C1 board is ${laid[0]?.boards[0]?.name} ${c1}`);
  }
  if (laid[1]?.boards[0]?.name !== "Board B" || c2 !== "L1:C2-P1 L2:C2-P3 L3:C2-P4 R1:C2-P5 R2:- R3:-") {
    throw new Error(`C2 board is ${laid[1]?.boards[0]?.name} ${c2}`);
  }
  const c1Rule = doc.parallel_boards.find((board) => board.series === "C1");
  const c2Rule = doc.parallel_boards.find((board) => board.series === "C2");
  if (
    c1Rule?.last_rule_b_V !== 0.186 ||
    c1Rule.last_rule_b_call !== "GO" ||
    c1Rule.last_rule_b_over?.join("+") !== "C1-P2+C1-P3+C1-P6"
  ) {
    throw new Error(`C1 last Rule B is ${c1Rule?.last_rule_b_V} over ${c1Rule?.last_rule_b_over}`);
  }
  if (
    c2Rule?.last_rule_b_V !== 0.23 ||
    c2Rule.last_rule_b_call !== "GO" ||
    c2Rule.last_rule_b_over?.join("+") !== "C2-P1+C2-P3+C2-P4+C2-P5"
  ) {
    throw new Error(`C2 last Rule B is ${c2Rule?.last_rule_b_V} over ${c2Rule?.last_rule_b_over}`);
  }
  const c1Alone = doc.charge_alone.find((item) => item.label === "C1-P5");
  const c2Alone = doc.charge_alone.find((item) => item.label === "C2-P6");
  if (c1Alone?.last_offset_max_V !== 0.384 || c1Alone.last_offset_side !== "below") {
    throw new Error(`C1-P5 offset is ${c1Alone?.last_offset_max_V} ${c1Alone?.last_offset_side}`);
  }
  if (c2Alone?.last_offset_max_V !== 0.425 || c2Alone.last_offset_side !== "above") {
    throw new Error(`C2-P6 offset is ${c2Alone?.last_offset_max_V} ${c2Alone?.last_offset_side}`);
  }

  const split = layoutParallelBoards([
    {
      series: "C1",
      packs: ["A", "B", "C", "D", "E", "F", "G"],
      current: "normal",
      conditions: [],
      last_rule_b_V: 0,
      last_rule_b_call: "GO",
      last_rule_b_session: "2026-10-10",
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
  validateNextCharge(samePackBothSteps, packs);

  const withCoverage = structuredClone(base);
  withCoverage.parallel_boards[0].last_rule_b_over = ["C1-P3"];
  withCoverage.charge_alone = [
    {
      label: "C1-P5",
      uid: "CNHL-2026-005",
      reason: "rest offset",
      until: "within 0.30 V",
      last_offset_max_V: 0.384,
      last_offset_side: "below",
    },
  ];
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
      until: "within 0.30 V",
      last_offset_max_V: 0.384,
      last_offset_side: "under",
    },
  ];
  expectFail(badSide, packs, /last_offset_side must be below or above/);

  return doc;
}
