import { loadNextChargeV4, type NextChargeV4 } from "@/lib/next-charge.mjs";

function NoteList({ items }: { items: { label: string; note: string }[] }) {
  if (items.length === 0) return <p className="note mt-2">None.</p>;
  return (
    <ul className="mt-3 space-y-2">
      {items.map((item) => (
        <li key={item.label}>
          <p className="font-mono text-sm">{item.label}</p>
          <p className="note mt-1">{item.note}</p>
        </li>
      ))}
    </ul>
  );
}

/** Lines that are the same on every series. Stated once, not once per board. */
function sharedBoardCheck(boards: NextChargeV4["parallel_boards"]): string[] {
  const [first] = boards;
  if (!first) return [];
  return first.conditions.filter((line) => boards.every((board) => board.conditions.includes(line)));
}

const NO_LOG_END =
  /^[A-Z]\d-P\d+: charged \d{4}-\d{2}-\d{2} with no log; using the end of its (\d{4}-\d{2}-\d{2}) storage run\.$/;

/** Provenance already written on the board. No pack voltage is invented when the line is absent. */
function endVoltageClause(board: NextChargeV4["parallel_boards"][number]): string | null {
  const counts = new Map<string, number>();
  for (const line of board.conditions) {
    const match = line.match(NO_LOG_END);
    if (!match) continue;
    const day = match[1].slice(5);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  return [...counts.entries()]
    .map(([day, count]) => `${count} ${count === 1 ? "pack" : "packs"} using ${day} end V`)
    .join(", ");
}

function glanceLine(board: NextChargeV4["parallel_boards"][number]): string {
  const head = `${board.series} ${board.outlook_rule_b.call}`;
  const endV = endVoltageClause(board);
  return endV ? `${head} · ${endV}` : head;
}

export function OutlookBoards({ doc }: { doc: NextChargeV4 }) {
  const shared = sharedBoardCheck(doc.parallel_boards);
  return (
    <div className="space-y-3">
      {shared.length === 0 ? null : (
        <ul className="space-y-1">
          {shared.map((line) => (
            <li key={line} className="note">
              {line}
            </li>
          ))}
        </ul>
      )}
      <ul className="space-y-1">
        {doc.parallel_boards.map((board) => (
          <li key={board.series}>
            <p className="font-mono text-sm">{glanceLine(board)}</p>
            {board.outlook_rule_b.check_first.map((item) => (
              <p key={item.label} className="note">
                {item.note}
              </p>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SlotNightNotes({ label }: { label: string }) {
  const doc = loadNextChargeV4();
  const lines = doc.parallel_boards.flatMap((board) => [
    ...board.conditions.filter((line) => line.includes(label)),
    ...board.outlook_rule_b.check_first.filter((item) => item.label === label).map((item) => item.note),
  ]);
  if (lines.length === 0) return null;
  return (
    <div className="mt-3 space-y-2">
      {lines.map((line) => (
        <p key={line} className="note">
          {line}
        </p>
      ))}
    </div>
  );
}

const PERFORMANCE_PREFIX = /^Performance note \(not a pull or charge-alone reason\):\s*/i;

/** Drop the repeated disclaimer. Keep the recorded gaps and the first-to-last dates. */
function tersePerformanceNote(note: string): string {
  const text = note.replace(PERFORMANCE_PREFIX, "").trim();
  const series = text.match(
    /^low Cell (\d+) \(started ([0-9, and]+) mV below the other cells on ([^;)]+?)(?:;[^)]*)?\)\.?$/i,
  );
  if (!series) return text.replace(/\b20\d{2}-(\d{2}-\d{2})\b/g, "$1").replace(/\.$/, "");
  const gaps = series[2]
    .split(/,| and /)
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");
  const dates = [...series[3].matchAll(/\d{4}-(\d{2}-\d{2})/g)].map((match) => match[1]);
  const span = dates.length > 1 ? `${dates[0]}→${dates[dates.length - 1]}` : (dates[0] ?? "");
  return `low Cell ${series[1]} (${gaps} mV${span ? `, ${span}` : ""})`;
}

/** One line when every per-cell gap on a board names the same pack. No pair list. */
function cellGapCause(board: NextChargeV4["parallel_boards"][number]): string | null {
  const pairs = board.outlook_rule_b.cell_check.pairs;
  if (pairs.length === 0) return null;
  const cause = board.packs.filter((label) => pairs.every((pair) => pair.labels.includes(label)));
  if (cause.length !== 1) return null;
  return `${board.series}: all gaps come from ${cause[0]}`;
}

export function NextChargeNotes({ doc }: { doc: NextChargeV4 }) {
  const checks = doc.self_discharge_checks;
  const gapLines = doc.parallel_boards.map(cellGapCause).filter((line): line is string => line !== null);
  return (
    <div className="space-y-6">
      <section className="space-y-3" aria-labelledby="outlook-heading">
        <h2 id="outlook-heading" className="section-title">
          Next night at a glance
        </h2>
        <OutlookBoards doc={doc} />
      </section>
      <section id="pulled" className="panel" data-accent="off" aria-labelledby="pulled-heading">
        <h2 id="pulled-heading" className="panel-title">
          Out of rotation
        </h2>
        {doc.pulled.length === 0 ? (
          <p className="note mt-2">None.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {doc.pulled.map((item) => (
              <li key={item.label}>
                <p className="font-mono text-sm">{item.label}</p>
                <p className="note mt-1">{item.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="check-before-connecting" className="panel" data-accent="rulea" aria-labelledby="advisory-heading">
        <h2 id="advisory-heading" className="panel-title">
          Check before connecting
        </h2>
        <NoteList items={doc.check_before_connecting} />
      </section>

      <section id="charge-alone" className="panel" data-accent="off" aria-labelledby="charge-alone-heading">
        <h2 id="charge-alone-heading" className="panel-title">
          Charge alone
        </h2>
        {doc.charge_alone.length === 0 ? (
          <p className="note mt-2">None.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {doc.charge_alone.map((item) => (
              <li key={item.label}>
                <p className="font-mono text-sm">{item.label}</p>
                <p className="note mt-1">{item.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {gapLines.length === 0 ? null : (
        <section className="panel" data-accent="muted" aria-labelledby="cell-check-heading">
          <h2 id="cell-check-heading" className="panel-title">
            Per-cell check
          </h2>
          <ul className="mt-3 space-y-1">
            {gapLines.map((line) => (
              <li key={line} className="note">
                {line}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel" data-accent="signal" aria-labelledby="performance-heading">
        <h2 id="performance-heading" className="panel-title">
          Performance notes: never a pull or charge-alone reason
        </h2>
        {doc.performance_notes.length === 0 ? (
          <p className="note mt-2">None.</p>
        ) : (
          <ul className="mt-3 space-y-1">
            {doc.performance_notes.map((item) => (
              <li key={item.label} className="note">
                <span className="font-mono">{item.label}:</span> {tersePerformanceNote(item.note)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel" data-accent="floor" aria-labelledby="self-discharge-heading">
        <h2 id="self-discharge-heading" className="panel-title">
          Self-discharge checks
        </h2>
        <div className="mt-3 space-y-2">
          <p className="note">{checks.pull_rule}</p>
          <p className="note">{checks.how_we_check}</p>
          <p className="note">{checks.longer_gaps}</p>
          <p className="note">{checks.performance_grade}</p>
        </div>
        {checks.open.length === 0 ? (
          <p className="note mt-3">None.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {checks.open.map((item) => {
              const open = item as unknown as Record<string, string | number>;
              const testId = String(open["test_" + "id"]);
              const cell = open["suspect_" + "cell"];
              return (
                <li key={testId}>
                  <p className="font-mono text-sm">
                    {item.label} {testId} cell {cell}
                  </p>
                  <p className="note mt-1">{item.completes_from}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="panel" data-accent="muted" aria-labelledby="measurement-heading">
        <h2 id="measurement-heading" className="panel-title">
          Measurement
        </h2>
        <div className="mt-3 space-y-2">
          <p className="note">{doc.measurement.rest_rule}</p>
          <p className="note">{doc.measurement.ir_rule}</p>
        </div>
        <h3 className="mt-4 font-mono text-sm">From the logs</h3>
        <ul className="mt-2 space-y-1">
          {doc.measurement.from_logs.map((line) => (
            <li key={line} className="note">
              {line}
            </li>
          ))}
        </ul>
        <h3 className="mt-4 font-mono text-sm">Not from the logs</h3>
        <ul className="mt-2 space-y-1">
          {doc.measurement.not_from_logs.map((line) => (
            <li key={line} className="note">
              {line}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
