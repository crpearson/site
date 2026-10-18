import type { NextChargeV4 } from "@/lib/next-charge.mjs";

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

export function NextChargeNotes({ doc }: { doc: NextChargeV4 }) {
  const checks = doc.self_discharge_checks;
  return (
    <div className="space-y-6">
      <section className="panel" data-accent="off" aria-labelledby="pulled-heading">
        <h2 id="pulled-heading" className="panel-title">
          Pulled
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

      <section className="panel" data-accent="rulea" aria-labelledby="advisory-heading">
        <h2 id="advisory-heading" className="panel-title">
          Check before connecting
        </h2>
        <NoteList items={doc.check_before_connecting} />
      </section>

      <section className="panel" data-accent="muted" aria-labelledby="cell-check-heading">
        <h2 id="cell-check-heading" className="panel-title">
          Per-cell check
        </h2>
        <div className="mt-3 space-y-4">
          {doc.parallel_boards.map((board) => {
            const check = board.outlook_rule_b.cell_check;
            return (
              <div key={board.series}>
                <h3 className="font-mono text-sm">{board.series}</h3>
                <p className="note mt-1">{check.basis}</p>
                {check.pairs.length === 0 ? (
                  <p className="note mt-1">None.</p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {check.pairs.map((pair) => (
                      <li key={`${board.series}-${pair.labels.join("-")}-${pair.cell}`} className="font-mono text-sm">
                        {pair.labels.join(", ")} cell {pair.cell} {pair.diff_mv} mV
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel" data-accent="signal" aria-labelledby="performance-heading">
        <h2 id="performance-heading" className="panel-title">
          Performance notes
        </h2>
        <NoteList items={doc.performance_notes} />
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
