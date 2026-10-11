import type { Metadata } from "next";
import Link from "next/link";
import { ChargerDiagram } from "@/components/ChargerDiagram";
import { DontConnectList } from "@/components/DontConnectList";
import { ChargeAlone, ParallelBoardDiagram } from "@/components/ParallelBoardDiagram";
import { statusRows, type StatusRow } from "@/lib/fleet";
import { loadNextCharge } from "@/lib/next-charge.mjs";

export const metadata: Metadata = {
  title: "Next charge",
  description:
    "Storage channels, pre-flight parallel boards, and packs to leave disconnected for the next session.",
};

export default function NextChargePage() {
  const plan = loadNextCharge();
  const rows = new Map(statusRows().map((row) => [row.label, row]));
  const resolve = (label: string): StatusRow => {
    const row = rows.get(label);
    if (!row) throw new Error(`next_charge.json pack ${label} has no fleet row`);
    return row;
  };

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
            <dd>{plan.as_of}</dd>
          </div>
          <div>
            <dt>Based on night</dt>
            <dd>{plan.based_on_session}</dd>
          </div>
        </dl>
        <p>
          <Link href={plan.status_calls_link} className="pack-link">
            Status calls
          </Link>
        </p>
      </header>

      <section className="space-y-3" aria-labelledby="storage-heading">
        <h2 id="storage-heading" className="section-title">
          Storage
        </h2>
        <div className="bench-stack">
          {plan.storage.chargers.map((charger) => (
            <ChargerDiagram key={charger.name} charger={charger} resolve={resolve} />
          ))}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="parallel-heading">
        <h2 id="parallel-heading" className="section-title">
          Pre-flight parallel
        </h2>
        <div className="bench-stack">
          {plan.parallel.boards.map((board) => (
            <ParallelBoardDiagram key={board.series} board={board} resolve={resolve} />
          ))}
        </div>
        <ChargeAlone items={plan.parallel.charge_alone} resolve={resolve} />
      </section>

      <section className="space-y-3" aria-labelledby="hold-heading">
        <h2 id="hold-heading" className="section-title">
          Don&apos;t connect
        </h2>
        <DontConnectList items={plan.dont_connect} resolve={resolve} />
      </section>
    </div>
  );
}
