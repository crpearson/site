import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { ChargerDiagram } from "@/components/ChargerDiagram";
import { DontConnectList } from "@/components/DontConnectList";
import { ChargeAlone, ParallelBoardDiagram } from "@/components/ParallelBoardDiagram";
import { SetSwitcher } from "@/components/SetSwitcher";
import { statusRows, type StatusRow } from "@/lib/fleet";
import { irValidationIsProvisional } from "@/lib/ir-validation.mjs";
import { seriesColor } from "@/lib/color";
import { formatIr, publicSession } from "@/lib/format";
import { chargeSetId, layoutParallelBoards, loadNextCharge, storageChargers, storageSummary } from "@/lib/next-charge.mjs";
import type { ChargeSet, IndividualItem, IrMatch, ParallelBoard, StorageRun } from "@/lib/next-charge.mjs";

export const metadata: Metadata = {
  title: "Next charge",
  description: "Tonight's charge set, the other night's set, and packs to leave disconnected.",
};

function packList(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

function mohm(value: number | null): string {
  return value == null ? "—" : `${formatIr(value)} mΩ`;
}

function pct(value: number | null): string {
  if (value == null) return "—";
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}%`;
}

function IrMatchFigures({ match }: { match: IrMatch }) {
  return (
    <div data-ir-match="">
      <p className="panel-title mt-4">IR match (not a recorded result)</p>
      <dl className="bench-meta mt-3">
        <div>
          <dt>IR call</dt>
          <dd>{match.call}</dd>
        </div>
        <div>
          <dt>Board median</dt>
          <dd>{mohm(match.board_median_mohm)}</dd>
        </div>
        <div>
          <dt>Check first</dt>
          <dd>{pct(match.check_first_pct)} off the median</dd>
        </div>
        <div>
          <dt>Charge alone</dt>
          <dd>
            {pct(match.charge_alone_pct)} off, on {match.nights_needed} of the last {match.of_last_nights} nights
          </dd>
        </div>
      </dl>
      <ul className="bench-notes">
        {match.packs.map((item) => (
          <li key={item.label} className="note">
            {item.label}: {mohm(item.avg_mohm)}, {pct(item.pct_off)}, {item.flag}, {item.nights_checked} nights
          </li>
        ))}
      </ul>
      <p className="note">{match.basis}</p>
    </div>
  );
}

function recordedRuleB(board: ParallelBoard): string {
  if (board.last_rule_b_V == null || board.last_rule_b_over.length === 0) return "No board night yet";
  return `${board.last_rule_b_V.toFixed(3)} V ${board.last_rule_b_call} over ${packList(board.last_rule_b_over)} · ${publicSession(board.last_rule_b_session ?? "")}`;
}

/** A repeated channel starts the next queue. Charge-alone packs are listed before board packs. */
function storagePhases(runs: StorageRun[]): StorageRun[][] {
  const phases: StorageRun[][] = [];
  let current: StorageRun[] = [];
  const seen = new Set<string>();
  for (const run of runs) {
    const key = `${run.charger}\0${run.channel}`;
    if (seen.has(key) && current.length) {
      phases.push(current);
      current = [];
      seen.clear();
    }
    seen.add(key);
    current.push(run);
  }
  if (current.length) phases.push(current);
  return phases;
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
  const boards = set.parallel_boards.length ? layoutParallelBoards(set.parallel_boards) : [];
  const phases = storagePhases(set.storage_runs);
  return (
    <div className="min-w-0 space-y-8">
      <section className="space-y-3" aria-labelledby={`${setId}-storage-heading`}>
        <h2 id={`${setId}-storage-heading`} className="section-title">
          {name}
        </h2>
        <p className="note">Last storage session {publicSession(set.last_storage_session)}</p>
        {phases.map((phase, phaseIndex) => {
          const summary = storageSummary(phase);
          const chargers = storageChargers(phase);
          const modes = [...new Set(phase.flatMap((run) => (run.mode ? [run.mode] : [])))];
          return (
            <div key={`${setId}-phase-${phaseIndex}`} className="space-y-3">
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
                  <ChargerDiagram
                    key={`${setId}-${phaseIndex}-${charger.charger}`}
                    charger={charger}
                    resolve={resolve}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {boards.length ? (
        <section className="space-y-3" aria-labelledby={`${setId}-parallel-heading`}>
          <h2 id={`${setId}-parallel-heading`} className="section-title">
            Pre-flight parallel
          </h2>
          <div className="bench-stack">
            {boards.map((board) => {
              const outlook = board.outlook_rule_b;
              const checked = outlook.check_first.map((item) => item.label);
              const without =
                outlook.value_without_check_first_v != null && checked.length
                  ? `${outlook.value_without_check_first_v.toFixed(3)} V without ${packList(checked)}`
                  : null;
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
                      <div>
                        <dt>Go limit</dt>
                        <dd>{board.rest_check_limit_V.toFixed(2)} V</dd>
                      </div>
                      <div data-recorded="">
                        <dt>Recorded Rule B</dt>
                        <dd>
                          {recordedRuleB(board)}
                          <p className="note mt-1">{board.last_rule_b_basis}</p>
                        </dd>
                      </div>
                    </dl>
                    <div className="outlook-block" data-outlook="">
                      <p className="panel-title">Next-night outlook (not a board result)</p>
                      <dl className="bench-meta mt-3">
                        <div>
                          <dt>Outlook</dt>
                          <dd>
                            {outlook.value_v.toFixed(3)} V {outlook.call} over {packList(outlook.packs)} · {publicSession(outlook.session)}
                          </dd>
                        </div>
                        <div>
                          <dt>Limit</dt>
                          <dd>{outlook.limit_v.toFixed(2)} V</dd>
                        </div>
                        <div>
                          <dt>Basis</dt>
                          <dd>{outlook.basis}</dd>
                        </div>
                        {without ? (
                          <div>
                            <dt>Without the check-first packs</dt>
                            <dd>{without}</dd>
                          </div>
                        ) : null}
                      </dl>
                      {outlook.check_first.length ? (
                        <ul className="bench-notes">
                          {outlook.check_first.map((item) => (
                            <li key={item.label} className="note">
                              {item.label}: {item.note}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <IrMatchFigures match={outlook.ir_match} />
                    </div>
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

    </div>
  );
}

function OwnChargeList({ items }: { items: IndividualItem[] | undefined }) {
  if (!items?.length) return null;
  return (
    <section className="space-y-3" aria-labelledby="own-heading">
      <h2 id="own-heading" className="section-title">
        Charges on its own
      </h2>
      <ul className="bench-hold-list">
        {items.map((item) => (
          <li key={item.label} className="panel" data-accent="signal">
            <p>
              <Link href={`/pack/${item.label}`} className="pack-link font-mono">
                {item.label}
              </Link>
            </p>
            <p className="bench-field">{item.uid}</p>
            <p className="bench-return">Pool {item.pool}</p>
            <p className="note mt-2">{item.status}</p>
            <p className="note mt-2">{item.note}</p>
          </li>
        ))}
      </ul>
    </section>
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
            <dd>{publicSession(plan.as_of_session)}</dd>
          </div>
          <div>
            <dt>Tonight</dt>
            <dd>{plan.active_set}</dd>
          </div>
        </dl>
        <p className="note">{plan.active_set_reason}</p>
        {plan.locked_reason ? <p className="note">{plan.locked_reason}</p> : null}
      </header>

      <SetSwitcher
        activeLabel={plan.active_set}
        alternateLabel={plan.alternate_set}
        active={<SetPlan name={plan.active_set} set={active} setId={activeId} resolve={resolve} />}
        alternate={<SetPlan name={plan.alternate_set} set={alternate} setId={alternateId} resolve={resolve} />}
      />

      <OwnChargeList items={plan.individual} />

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
