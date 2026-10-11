import fs from "node:fs";
import path from "node:path";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const BOARD_PORT_IDS = ["L1", "L2", "L3", "R1", "R2", "R3"];
export const BOARD_NAMES = ["Board A", "Board B", "Board C", "Board D"];

/**
 * Fill a 6-port board. An entry with no port takes the next free id in
 * L1, L2, L3, R1, R2, R3 order. Explicit ports must be one of those ids.
 */
export function assignPorts(ports, where) {
  const taken = new Map();
  const pending = [];
  for (const [index, port] of ports.entries()) {
    if (port.port == null) {
      pending.push(port);
      continue;
    }
    const id = text(port.port, `${where} ports[${index}].port`);
    if (!BOARD_PORT_IDS.includes(id)) {
      fail(`${where} port ${id} is not L1, L2, L3, R1, R2, or R3`);
    }
    if (taken.has(id)) fail(`${where} uses ${id} twice`);
    taken.set(id, port);
  }
  for (const port of pending) {
    const id = BOARD_PORT_IDS.find((slot) => !taken.has(slot));
    if (!id) fail(`${where} has more than 6 packs`);
    taken.set(id, port);
  }
  return BOARD_PORT_IDS.map((id) => {
    const port = taken.get(id);
    return port ? { id, pack: port.pack, note: port.note } : { id };
  });
}

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

function allow(value, fields, where) {
  if (!isObject(value)) fail(`${where} must be an object`);
  for (const key of Object.keys(value)) {
    if (!fields.includes(key)) fail(`${where} has unknown field ${key}`);
  }
}

function text(value, where) {
  if (typeof value !== "string" || value.trim() === "") fail(`${where} must be text`);
  return value.trim();
}

function date(value, where) {
  const written = text(value, where);
  if (!DATE.test(written)) fail(`${where} must be YYYY-MM-DD`);
  return written;
}

function stringList(value, where) {
  if (!Array.isArray(value)) fail(`${where} must be a list`);
  return value;
}

/**
 * Packs one DX8 channel stores in a single run.
 * That is the size of every default slot list in scripts/ingest.py.
 */
export function readRunAtOnce(root = process.cwd()) {
  const source = fs.readFileSync(path.join(root, "scripts/ingest.py"), "utf8");
  const block = source.match(/DEFAULT_SLOTS = \{([\s\S]*?)\n\}/);
  if (!block) fail("DEFAULT_SLOTS is missing from scripts/ingest.py");
  const counts = [...block[1].matchAll(/\[([^\]]*)\]/g)].map((match) =>
    match[1]
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean).length,
  );
  if (counts.length === 0 || counts.some((count) => count !== counts[0] || count < 1)) {
    throw new Error(`DEFAULT_SLOTS channel sizes are ${counts.join(", ") || "missing"}`);
  }
  return counts[0];
}

function readPacks(root) {
  const rows = parseCsv(fs.readFileSync(path.join(root, "data/v2/packs.csv"), "utf8"));
  const packs = new Map();
  for (const row of rows) {
    const label = row.label?.trim();
    if (!label) continue;
    if (packs.has(label)) fail(`packs.csv lists ${label} twice`);
    packs.set(label, row.series?.trim() ?? "");
  }
  return packs;
}

function claim(seen, label, packs, where) {
  if (!packs.has(label)) fail(`unknown pack ${label}`);
  if (seen.has(label)) fail(`duplicate pack ${label} in ${where}`);
  seen.add(label);
  return label;
}

export function validateNextCharge(doc, packs, runAtOnce) {
  if (!Number.isInteger(runAtOnce) || runAtOnce < 1) fail(`run-at-once must be a positive integer`);
  allow(
    doc,
    ["as_of", "based_on_session", "status_calls_link", "storage", "parallel", "dont_connect"],
    "root",
  );
  date(doc.as_of, "as_of");
  text(doc.based_on_session, "based_on_session");
  const link = text(doc.status_calls_link, "status_calls_link");
  if (!link.startsWith("/") || link.startsWith("//") || /[\s<>"']/.test(link)) {
    fail("status_calls_link must be a path on this site");
  }

  allow(doc.storage, ["chargers"], "storage");
  const chargers = stringList(doc.storage.chargers, "storage.chargers");
  const chargerNames = new Set();
  const storagePacks = new Set();
  for (const [chargerIndex, charger] of chargers.entries()) {
    const where = `storage.chargers[${chargerIndex}]`;
    allow(charger, ["name", "channels"], where);
    const name = text(charger.name, `${where}.name`);
    if (chargerNames.has(name)) fail(`duplicate charger ${name}`);
    chargerNames.add(name);
    const channels = stringList(charger.channels, `${where}.channels`);
    if (channels.length === 0) fail(`${name} has no channels`);
    const channelNames = new Set();
    for (const [channelIndex, channel] of channels.entries()) {
      const channelWhere = `${name} ${where}.channels[${channelIndex}]`;
      allow(channel, ["name", "runs"], channelWhere);
      const channelName = text(channel.name, `${channelWhere}.name`);
      if (channelNames.has(channelName)) fail(`${name} lists ${channelName} twice`);
      channelNames.add(channelName);
      const runs = stringList(channel.runs, `${name} ${channelName} runs`);
      if (runs.length === 0) fail(`${name} ${channelName} has no runs`);
      let total = 0;
      for (const [runIndex, run] of runs.entries()) {
        const runWhere = `${name} ${channelName} run ${runIndex + 1}`;
        allow(run, ["run", "packs", "note"], runWhere);
        if (run.run !== runIndex + 1) fail(`${name} ${channelName} runs must be numbered 1, 2, 3 in order`);
        const labels = stringList(run.packs, `${runWhere} packs`);
        if (labels.length === 0) fail(`${runWhere} has no packs`);
        if (labels.length > runAtOnce) {
          fail(
            `${name} ${channelName} run ${run.run} has ${labels.length} packs; run-at-once is ${runAtOnce}`,
          );
        }
        for (const label of labels) claim(storagePacks, text(label, `${runWhere} pack`), packs, "storage");
        if (run.note != null) text(run.note, `${runWhere} note`);
        total += labels.length;
      }
      if (total <= runAtOnce && runs.length !== 1) {
        fail(`${name} ${channelName} has ${total} packs, so it is one run (run-at-once is ${runAtOnce})`);
      }
    }
  }

  allow(doc.parallel, ["boards", "charge_alone"], "parallel");
  const boards = stringList(doc.parallel.boards, "parallel.boards");
  if (boards.length > BOARD_NAMES.length) fail("at most 4 parallel boards");
  const alone = stringList(doc.parallel.charge_alone, "parallel.charge_alone");
  const parallelPacks = new Set();
  const boardNames = new Set();
  for (const [boardIndex, board] of boards.entries()) {
    const where = `parallel.boards[${boardIndex}]`;
    allow(board, ["series", "name", "ports", "notes"], where);
    const series = text(board.series, `${where}.series`);
    if (board.name != null) {
      const name = text(board.name, `${where}.name`);
      if (!BOARD_NAMES.includes(name)) fail(`${name} is not Board A, Board B, Board C, or Board D`);
      if (boardNames.has(name)) fail(`duplicate board ${name}`);
      boardNames.add(name);
    }
    const portEntries = stringList(board.ports, `${series} ports`);
    for (const [portIndex, port] of portEntries.entries()) {
      const portWhere = `${series} port ${portIndex + 1}`;
      allow(port, ["pack", "port", "note"], portWhere);
      const label = claim(parallelPacks, text(port.pack, `${portWhere} pack`), packs, "parallel");
      const packSeries = packs.get(label);
      if (packSeries !== series) fail(`${label} is series ${packSeries || "unknown"}, not on the ${series} board`);
      if (port.note != null) text(port.note, `${portWhere} note`);
    }
    assignPorts(portEntries, series);
    const notes = stringList(board.notes, `${series} notes`);
    for (const [noteIndex, note] of notes.entries()) text(note, `${series} notes[${noteIndex}]`);
  }
  for (const [aloneIndex, item] of alone.entries()) {
    const where = `parallel.charge_alone[${aloneIndex}]`;
    allow(item, ["pack", "reason"], where);
    claim(parallelPacks, text(item.pack, `${where}.pack`), packs, "parallel");
    text(item.reason, `${where}.reason`);
  }

  const held = new Set();
  const holds = stringList(doc.dont_connect, "dont_connect");
  for (const [holdIndex, item] of holds.entries()) {
    const where = `dont_connect[${holdIndex}]`;
    allow(item, ["pack", "reason", "returns"], where);
    claim(held, text(item.pack, `${where}.pack`), packs, "don't connect");
    text(item.reason, `${where}.reason`);
    date(item.returns, `${where}.returns`);
  }

  for (const label of storagePacks) {
    if (held.has(label)) fail(`${label} is in a connect slot and in don't connect`);
  }
  for (const label of parallelPacks) {
    if (held.has(label)) fail(`${label} is in a connect slot and in don't connect`);
  }
}

function sample(packs) {
  const label = (name) => {
    if (!packs.has(name)) throw new Error(`sample pack ${name} is not in packs.csv`);
    return name;
  };
  return {
    as_of: "2026-10-10",
    based_on_session: "2026-10-10",
    status_calls_link: "/#calls-heading",
    storage: {
      chargers: [
        {
          name: "DX8-1",
          channels: [{ name: "CH1", runs: [{ run: 1, packs: [label("C1-P2")] }] }],
        },
      ],
    },
    parallel: {
      boards: [{ series: "C1", ports: [{ pack: label("C1-P3") }], notes: [] }],
      charge_alone: [],
    },
    dont_connect: [],
  };
}

function expectFail(doc, packs, runAtOnce, pattern) {
  try {
    validateNextCharge(doc, packs, runAtOnce);
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
  validateNextCharge(doc, packs, readRunAtOnce(root));
  return doc;
}

export function checkNextCharge(root = process.cwd()) {
  const packs = readPacks(root);
  const runAtOnce = readRunAtOnce(root);
  const doc = loadNextCharge(root);
  const base = sample(packs);
  const unknown = structuredClone(base);
  unknown.storage.chargers[0].channels[0].runs[0].packs = ["NO-SUCH-PACK"];
  expectFail(unknown, packs, runAtOnce, /unknown pack NO-SUCH-PACK/);

  const duplicate = structuredClone(base);
  duplicate.storage.chargers[0].channels[0].runs[0].packs = ["C1-P2", "C1-P2"];
  expectFail(duplicate, packs, runAtOnce, /duplicate pack C1-P2 in storage/);

  const overlap = structuredClone(base);
  overlap.dont_connect = [{ pack: "C1-P2", reason: "Rest pool 7-day rest test", returns: "2026-10-16" }];
  expectFail(overlap, packs, runAtOnce, /C1-P2 is in a connect slot and in don't connect/);

  const crowded = structuredClone(base);
  crowded.storage.chargers[0].channels[0].runs[0].packs = Array.from({ length: runAtOnce + 1 }, () => "C1-P2");
  expectFail(crowded, packs, runAtOnce, /run-at-once/);

  const splitTooSoon = structuredClone(base);
  splitTooSoon.storage.chargers[0].channels[0].runs = [
    { run: 1, packs: ["C1-P2"] },
    { run: 2, packs: ["C1-P3"] },
  ];
  expectFail(splitTooSoon, packs, runAtOnce, /one run/);

  const samePackBothSteps = structuredClone(base);
  samePackBothSteps.parallel.boards[0].ports = [{ pack: "C1-P2" }];
  validateNextCharge(samePackBothSteps, packs, runAtOnce);

  const badPort = structuredClone(base);
  badPort.parallel.boards[0].ports = [{ pack: "C1-P3", port: "X9" }];
  expectFail(badPort, packs, runAtOnce, /not L1, L2, L3, R1, R2, or R3/);

  const samePort = structuredClone(base);
  samePort.parallel.boards[0].ports = [
    { pack: "C1-P3", port: "L1" },
    { pack: "C1-P6", port: "L1" },
  ];
  expectFail(samePort, packs, runAtOnce, /uses L1 twice/);

  const extraBoard = structuredClone(base);
  extraBoard.parallel.boards = BOARD_NAMES.map((name) => ({
    name,
    series: "C1",
    ports: [],
    notes: [],
  })).concat([{ series: "C2", ports: [], notes: [] }]);
  expectFail(extraBoard, packs, runAtOnce, /at most 4 parallel boards/);

  const badName = structuredClone(base);
  badName.parallel.boards[0].name = "Board E";
  expectFail(badName, packs, runAtOnce, /not Board A, Board B, Board C, or Board D/);

  const placed = assignPorts(
    [{ pack: "C1-P2" }, { pack: "C1-P3" }, { pack: "C1-P6" }, { pack: "C2-P1", port: "R3" }],
    "order",
  );
  const placedText = placed.map((slot) => `${slot.id}:${slot.pack ?? "-"}`).join(" ");
  if (placedText !== "L1:C1-P2 L2:C1-P3 L3:C1-P6 R1:- R2:- R3:C2-P1") {
    throw new Error(`port order is ${placedText}`);
  }
  try {
    assignPorts(Array.from({ length: 7 }, () => ({ pack: "C1-P2" })), "overflow");
    throw new Error("expected a 7-pack board to fail");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/more than 6 packs/.test(message)) throw error;
  }

  return doc;
}
