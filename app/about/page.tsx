import type { Metadata } from "next";
import { Panel } from "@/components/Panel";
import { chargers, metricLabels, siteMeta, thresholds } from "@/lib/fleet";

export const metadata: Metadata = {
  title: "About the data",
  description:
    "How the LiPo fleet store is measured: DX8 storage charges, Rule A, Rule B, and what the logs do not contain.",
};

const sessions = [
  { id: "S263", partial: false },
  { id: "S287", partial: false },
  { id: "S308", partial: false },
  { id: "S329", partial: false },
  { id: "S344", partial: false },
  { id: "S358", partial: false },
  { id: "S372", partial: false },
  { id: "S386", partial: false },
  { id: "S400", partial: false },
  { id: "S413", partial: false },
  { id: "2026-09-26", partial: true },
  { id: "2026-09-26-eve", partial: false },
  { id: "2026-09-27", partial: false },
  { id: "2026-09-30", partial: true },
];

export default function AboutPage() {
  const spread = thresholds.intra_pack_spread_mohm;
  const rest = thresholds.inter_pack_rest_delta_v;
  const units = chargers();

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow">Source and rules</p>
        <h1 className="h1 mt-2">About the data</h1>
        <p className="page-intro mt-4">
          {siteMeta.source}. Last ingest {siteMeta.lastIngest}. The canonical file is the
          append-only IR store: {siteMeta.rowCount} rows across {siteMeta.sessionCount} sessions.
          The pages read the JSON built from that store.
        </p>
      </header>

      <div className="flex flex-wrap gap-1.5" aria-label="Sessions">
        {sessions.map((session) => (
          <span
            key={session.id}
            className={session.partial ? "session-chip is-partial" : "session-chip"}
          >
            {session.id}
            {session.partial ? " · partial" : ""}
          </span>
        ))}
      </div>

      <section className="grid gap-3 lg:grid-cols-2" aria-label="Glossary">
        <Panel accent="signal" eyebrow="Glossary" title="IR">
          <p className="note">
            Internal resistance in milliohms, one number per cell, from the DX8 storage-charge IR
            line. Pack average is the mean of the six cells.
          </p>
        </Panel>
        <Panel accent="rulea" eyebrow="Glossary" title="Spread">
          <p className="note">
            Intra-pack spread: the highest cell IR minus the lowest cell IR in that pack, in
            milliohms. Rule A reads this number.
          </p>
        </Panel>
        <Panel accent="floor" eyebrow="Glossary" title="Floor">
          <p className="note">
            Start floor, in millivolts: the lowest cell voltage at the start of the storage charge.
            A watch line sits at {thresholds.floor_eye_mv} mV.
          </p>
        </Panel>
        <Panel accent="ruleb" eyebrow="Glossary" title="Rest-Δ">
          <p className="note">
            Inter-pack rest delta, in volts: on a night, the highest pack rest voltage minus the
            lowest in that fleet. Rest voltage is the sum of the six start-cell voltages. Rule B
            reads the full measured set. The next-parallel board delta is a separate call and can
            leave OFF packs out.
          </p>
        </Panel>
        <Panel accent="off" eyebrow="Glossary" title="Self-discharge">
          <p className="note">
            Arrival imbalance is the gap between the highest and lowest cell voltage at the start
            of the charge, in millivolts. The status file treats about{" "}
            {thresholds.self_discharge_imbalance_mv} mV or more as a self-discharge flag. A smaller
            imbalance is noted and is not called self-discharge.
          </p>
        </Panel>
        <Panel accent="muted" eyebrow="Glossary" title="What is not here">
          <ul className="note list-disc space-y-1 pl-4">
            {siteMeta.metricsMissing.map((key) => (
              <li key={key}>{metricLabels[key] ?? key}</li>
            ))}
          </ul>
        </Panel>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <article className="panel" data-accent="rulea">
          <p className="eyebrow">Inside one pack</p>
          <h2 className="panel-title mt-1">Rule A · spread</h2>
          <ul className="mt-4 space-y-2 font-mono text-sm">
            <li className="text-[var(--ok)]">Go &lt; {spread.go_lt} mΩ</li>
            <li className="text-[var(--caution)]">
              Caution {spread.caution_lo}–{spread.caution_hi} mΩ
            </li>
            <li className="text-[var(--off)]">Pull ≥ {spread.pull_gte} mΩ</li>
          </ul>
          <p className="note mt-4">
            Amber panel, amber caution band. This rule does not retire a pack by itself. The status
            call can be OFF or Caution for floor or self-discharge while spread is still Go.
          </p>
        </article>
        <article className="panel" data-accent="ruleb">
          <p className="eyebrow">Across a fleet</p>
          <h2 className="panel-title mt-1">Rule B · rest-Δ</h2>
          <ul className="mt-4 space-y-2 font-mono text-sm">
            <li className="text-[var(--ok)]">Go ≤ {rest.go_lte.toFixed(2)} V</li>
            <li className="text-[var(--ruleb)]">
              Caution {rest.caution_lo.toFixed(2)}–{rest.caution_hi.toFixed(2)} V
            </li>
            <li className="text-[var(--off)]">Hard stop &gt; {rest.hard_stop_gt.toFixed(2)} V</li>
          </ul>
          <p className="note mt-4">
            Violet panel, violet caution band. Kept separate from Rule A so a spread call and a
            rest-delta call are not read as the same limit.
          </p>
        </article>
      </div>

      <Panel accent="off" eyebrow="Do not mix scales" title="DX8 IR is not a manufacturer rating">
        <p className="note">
          DX8 absolute IR, roughly 400–600 mΩ per cell in this fleet, does not map to manufacturer
          IR ratings or to Oscar/CNHL absolute retire bins. The rules above are relative to this
          store.
        </p>
      </Panel>

      <Panel accent="muted" eyebrow="From the status file" title="Gaps">
        <ul className="list-disc space-y-2 pl-4 text-sm leading-relaxed">
          {siteMeta.gaps.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
      </Panel>

      <Panel accent="signal" eyebrow="Repeatable ingest" title="How a night gets a pack id">
        <div className="space-y-3 text-sm leading-relaxed text-[var(--muted)]">
          <p>
            Only LiPo Storage logs named <span className="font-mono text-[var(--ink)]">LiPo[Storage_NNN_CHx].txt</span>{" "}
            (or <span className="font-mono text-[var(--ink)]">.txt.gz</span>) are auto-mapped. NNN
            belongs to one charger alias. Streams are not merged across chargers. Ingest maps the
            header serial to DX8-A or DX8-B with a private map that is not stored in this repo.
          </p>
          <p>
            Channel, then NNN. CH1 is fleet C1 and CH2 is fleet C2. Within a night and channel,
            files sort by NNN ascending: lowest is P1, sixth is P6. A channel is mapped only when
            that night has exactly six valid files on it. Otherwise those files stay unassigned.
          </p>
          <p>
            Hard fingerprints must pass or that fleet-night stays unassigned for review: C1-P4 cell
            1 is the pack-max IR, and C2-P2 cell 3 is the pack-min IR. Soft fingerprints are
            advisory and can fail without remapping: C2-P6 lowest C2 average, C2-P4 tightest
            spread.
          </p>
          <p>
            Dual-DX8 hold: <span className="font-mono text-[var(--ink)]">fleet_lock</span> is
            enforced only when a charger in the registry has it set. Both are unlocked, so DX8-A
            can log both channels. The store is append-only. An existing session and pack is not
            overwritten. Partial nights are kept as measured.
          </p>
        </div>
        <ul className="mt-4 space-y-3">
          {units.map((charger) => (
            <li key={charger.id} className="rounded-xl border border-[var(--line)] p-3 text-sm">
              <p className="font-mono text-[var(--ink)]">
                {charger.id} · {charger.fleet} · lock {charger.fleetLock ? "on" : "off"}
              </p>
              {charger.note ? <p className="note mt-1">{charger.note}</p> : null}
            </li>
          ))}
        </ul>
        <p className="note mt-4">{siteMeta.unassignedNote}</p>
      </Panel>

      <Panel accent="muted" eyebrow="In the repo" title="Recorded and missing">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="eyebrow">In the store</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-[var(--muted)]">
              {siteMeta.metricsAvailable.map((key) => (
                <li key={key}>{metricLabels[key] ?? key}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="eyebrow">Not invented</p>
            <p className="note mt-2">
              {siteMeta.ingestNote} Capacity in and out stay empty on the dashboard, labeled not in
              DX8 Storage data yet.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
