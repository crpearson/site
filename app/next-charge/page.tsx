import type { Metadata } from "next";
import { ChargerDiagram } from "@/components/ChargerDiagram";
import { DontConnectList } from "@/components/DontConnectList";
import { ChargeAlone, ParallelBoardDiagram } from "@/components/ParallelBoardDiagram";
import { statusRows, type StatusRow } from "@/lib/fleet";
import { irValidationIsProvisional } from "@/lib/ir-validation.mjs";
import { layoutParallelBoards, loadNextCharge, storageChargers, storageSummary } from "@/lib/next-charge.mjs";
import { seriesColor } from "@/lib/color";
import type { CSSProperties } from "react";
import type { ParallelBoard } from "@/lib/next-charge.mjs";

export const metadata: Metadata = {
  title: "Next charge",
  description:
    "Storage channels, pre-flight parallel boards, and packs to leave disconnected for the next session.",
};

function ruleBLine(board: ParallelBoard): string | null {
  const covered = board.last_rule_b_over;
  if (!covered?.length) return null;
  const packs =
    covered.length === 1 ? covered[0] : `${covered.slice(0, -1).join(", ")} and ${covered[covered.length - 1]}`;
  return `${board.last_rule_b_V.toFixed(3)} V ${board.last_rule_b_call} over ${packs} · ${board.last_rule_b_session}`;
}

export default function NextChargePage() {
  const plan = loadNextCharge();
  const rows = new Map(statusRows().map((row) => [row.label, row]));
  const resolve = (label: string): StatusRow => {
    const row = rows.get(label);
    if (!row) throw new Error(`next_charge.json pack ${label} has no fleet row`);
    return row;
  };
  const summary = storageSummary(plan.storage_runs);
  const chargers = storageChargers(plan.storage_runs);
  const boards = layoutParallelBoards(plan.parallel_boards);
  const anyProvisional = [...rows.values()].some((row) => row.provisional);
  const notes = anyProvisional ? plan.notes : plan.notes.filter((note) => !irValidationIsProvisional(note));

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <div>
          <p className="eyebrow">Bench sheet</p>
          <h1 className="h1 mt-2">Next charge</h1>
        </div>
        <dl className="bench-meta">
          <div>
            <dt>As of</dt>
            <dd>{plan.as_of_date_pt}</dd>
          </div>
          <div>
            <dt>Session</dt>
            <dd>{plan.as_of_session}</dd>
          </div>
        </dl>
      </header>

      <section className="space-y-3" aria-labelledby="storage-heading">
        <h2 id="storage-heading" className="section-title">
          Storage
        </h2>
        <div className="bench-stack">
          <article className="panel" data-accent="signal">
            <h3 className="panel-title">One pack per channel</h3>
            <ul className="bench-run-summary">
              {summary.map((item) => (
                <li key={item.run}>
                  <p className="bench-run-line">
                    <span className="bench-run-kicker">Run {item.run}:</span> {item.line}
                  </p>
                </li>
              ))}
            </ul>
          </article>
          {chargers.map((charger) => (
            <ChargerDiagram key={charger.charger} charger={charger} resolve={resolve} />
          ))}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="parallel-heading">
        <h2 id="parallel-heading" className="section-title">
          Pre-flight parallel
        </h2>
        <div className="bench-stack">
          {boards.map((board) => {
            const ruleB = ruleBLine(board);
            return (
            <div key={board.series} className="bench-series">
              <article
                className="panel"
                data-accent={board.current === "reduced" ? "ruleb" : undefined}
                style={{ "--accent": seriesColor(board.series) } as CSSProperties}
              >
                <h3 className="panel-title">{board.series}</h3>
                <dl className="bench-meta mt-3">
                  <div>
                    <dt>Current</dt>
                    <dd>{board.current}</dd>
                  </div>
                  {ruleB ? (
                    <div>
                      <dt>Last Rule B</dt>
                      <dd>{ruleB}</dd>
                    </div>
                  ) : null}
                </dl>
                {board.conditions.length ? (
                  <ul className="bench-notes">
                    {board.conditions.map((condition) => (
                      <li key={condition} className="note">
                        {condition}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
              {board.boards.map((drawn) => (
                <ParallelBoardDiagram
                  key={drawn.name}
                  name={drawn.name}
                  series={board.series}
                  ports={drawn.ports}
                  resolve={resolve}
                />
              ))}
            </div>
            );
          })}
        </div>
        <ChargeAlone items={plan.charge_alone} resolve={resolve} />
      </section>

      <section className="space-y-3" aria-labelledby="hold-heading">
        <h2 id="hold-heading" className="section-title">
          Don&apos;t connect
        </h2>
        <DontConnectList items={plan.do_not_connect} resolve={resolve} />
      </section>

      {notes.length ? (
        <section className="space-y-3" aria-labelledby="notes-heading">
          <h2 id="notes-heading" className="section-title">
            Notes
          </h2>
          <ul className="bench-notes">
            {notes.map((note) => (
              <li key={note} className="note">
                {note}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
