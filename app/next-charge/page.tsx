import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { ChargerDiagram } from "@/components/ChargerDiagram";
import { DontConnectList } from "@/components/DontConnectList";
import { ChargeAlone, ParallelBoardDiagram } from "@/components/ParallelBoardDiagram";
import { SetSwitcher } from "@/components/SetSwitcher";
import { statusRows, type StatusRow } from "@/lib/fleet";
import { irValidationIsProvisional } from "@/lib/ir-validation.mjs";
import { seriesColor } from "@/lib/color";
import { chargeSetId, layoutParallelBoards, loadNextCharge, storageChargers, storageSummary } from "@/lib/next-charge.mjs";
import type { ChargeSet, ParallelBoard } from "@/lib/next-charge.mjs";

export const metadata: Metadata = {
  title: "Next charge",
  description: "Tonight's charge set, the other night's set, and packs to leave disconnected.",
};

function ruleBLine(board: ParallelBoard): string | null {
  const covered = board.last_rule_b_over;
  if (!covered?.length) return null;
  const packs =
    covered.length === 1 ? covered[0] : `${covered.slice(0, -1).join(", ")} and ${covered[covered.length - 1]}`;
  return `${board.last_rule_b_V.toFixed(3)} V ${board.last_rule_b_call} over ${packs} · ${board.last_rule_b_session}`;
}

function SetPlan({
  name,
  set,
  setId,
  resolve,
}: {
  name: string;
  set: ChargeSet;
  setId: string;
  resolve: (label: string) => StatusRow;
}) {
  const summary = storageSummary(set.storage_runs);
  const chargers = storageChargers(set.storage_runs);
  const boards = set.parallel_boards.length ? layoutParallelBoards(set.parallel_boards) : [];
  const modes = [...new Set(set.storage_runs.flatMap((run) => (run.mode ? [run.mode] : [])))];
  return (
    <div className="min-w-0 space-y-8">
      <section className="space-y-3" aria-labelledby={`${setId}-storage-heading`}>
        <h2 id={`${setId}-storage-heading`} className="section-title">
          {name}
        </h2>
        <p className="note">Last storage session {set.last_storage_session}</p>
        {modes.map((mode) => (
          <p key={mode} className="note">
            {mode}
          </p>
        ))}
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
            <ChargerDiagram key={`${setId}-${charger.charger}`} charger={charger} resolve={resolve} />
          ))}
        </div>
      </section>

      {boards.length ? (
        <section className="space-y-3" aria-labelledby={`${setId}-parallel-heading`}>
          <h2 id={`${setId}-parallel-heading`} className="section-title">
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
        </section>
      ) : null}

      <ChargeAlone items={set.charge_alone} resolve={resolve} />

      {set.watch.length ? (
        <section className="space-y-3" aria-labelledby={`${setId}-watch-heading`}>
          <h2 id={`${setId}-watch-heading`} className="section-title">
            Watch
          </h2>
          <ul className="bench-notes">
            {set.watch.map((item) => (
              <li key={item.label} className="note">
                {item.label}: {item.note}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {set.join_status?.length ? (
        <section className="space-y-3" aria-labelledby={`${setId}-join-heading`}>
          <h2 id={`${setId}-join-heading`} className="section-title">
            Joining a board
          </h2>
          <ul className="bench-notes">
            {set.join_status.map((item) => (
              <li key={item.label} className="note">
                {item.label}: {item.status}. Storage nights {item.storage_nights}. Clean nights in a row{" "}
                {item.clean_nights_in_a_row}. {item.rule}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export default function NextChargePage() {
  const plan = loadNextCharge();
  const rows = new Map(statusRows().map((row) => [row.label, row]));
  const resolve = (label: string): StatusRow => {
    const row = rows.get(label);
    if (!row) throw new Error(`next_charge.json pack ${label} has no fleet row`);
    return row;
  };
  const activeId = chargeSetId(plan.active_set);
  const alternateId = chargeSetId(plan.alternate_set);
  const active = plan.sets[activeId];
  const alternate = plan.sets[alternateId];
  if (!active || !alternate) throw new Error("next_charge.json is missing a set");
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
          <div>
            <dt>Tonight</dt>
            <dd>{plan.active_set}</dd>
          </div>
        </dl>
        <p className="note">{plan.active_set_reason}</p>
        <p className="note">{plan.locked_reason}</p>
      </header>

      <SetSwitcher
        activeLabel={plan.active_set}
        alternateLabel={plan.alternate_set}
        active={<SetPlan name={plan.active_set} set={active} setId={activeId} resolve={resolve} />}
        alternate={<SetPlan name={plan.alternate_set} set={alternate} setId={alternateId} resolve={resolve} />}
      />

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
