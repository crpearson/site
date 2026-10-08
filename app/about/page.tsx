import type { Metadata } from "next";
import Link from "next/link";
import { Panel } from "@/components/Panel";
import { chargers, metricLabels, siteMeta, thresholds } from "@/lib/fleet";

export const metadata: Metadata = {
  title: "About the data",
  description:
    "How this LiPo fleet is measured: DX8 storage charges, Rule A, Rule B, and what the logs do not contain.",
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
          {siteMeta.source}. Logged through {siteMeta.lastIngest}. The record holds{" "}
          {siteMeta.rowCount} measurements across {siteMeta.sessionCount} nights. Rest voltage
          comes from the start of each storage charge. Rule A and Rule B use the limits shown
          below.
        </p>
        <p className="mt-4">
          <Link href="/methodology" className="pack-link">
            How packs are charged, logged and judged
          </Link>
        </p>
      </header>

      <div className="flex flex-wrap gap-1.5" aria-label="Nights">
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
            Inter-pack rest delta, in volts: within one series and one night, the highest rest
            voltage minus the lowest, and only among packs that charged in parallel. A series or
            a night with fewer than two parallel packs is N/A, charged individually. Rest voltage
            is the sum of the six start-cell voltages. Rule A, the floor watch, and self-discharge
            still apply to every pack.
          </p>
        </Panel>
        <Panel accent="off" eyebrow="Glossary" title="Self-discharge">
          <p className="note">
            Arrival imbalance is the gap between the highest and lowest cell voltage at the start
            of the charge, in millivolts. About {thresholds.self_discharge_imbalance_mv} mV or more
            is treated as self-discharge. A smaller imbalance is noted and is not called
            self-discharge.
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
          fleet.
        </p>
      </Panel>

      <Panel accent="muted" eyebrow="Still open" title="Gaps">
        <ul className="list-disc space-y-2 pl-4 text-sm leading-relaxed">
          {siteMeta.gaps.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
      </Panel>

      <Panel accent="signal" eyebrow="Charging nights" title="How a night is matched to packs">
        <div className="space-y-3 text-sm leading-relaxed text-[var(--muted)]">
          <p>
            Only storage charges are recorded. Each log belongs to one charger, and the two
            chargers are not mixed into one sequence. The charger&apos;s serial stays off this site;
            the pages show DX8-1 and DX8-2.
          </p>
          <p>
            On a night, the logs on a channel are taken in order and matched to that night&apos;s
            slot list. If the number of logs does not match the number of slots, the night is
            refused and nothing is quietly reassigned. When a night has no slot list, DX8-1 channel
            1 is C1-P1 through C1-P3, DX8-1 channel 2 is C1-P4 through C1-P6, DX8-2 channel 1 is
            C2-P1 through C2-P3, and DX8-2 channel 2 is C2-P4 through C2-P6. The slot list wins
            when a slot is empty or a pack is charged on its own.
          </p>
          <p>
            Two identity checks must pass, or that series stays unmatched for review: C1-P4 cell 1
            is that pack&apos;s highest internal resistance, and C2-P2 cell 3 is that pack&apos;s
            lowest. Two softer checks can fail without moving a pack: C2-P6 has the lowest C2
            average, and C2-P4 has the tightest C2 spread.
          </p>
          <p>
            A charger is limited to one series only when that limit is turned on. DX8-1 and DX8-2
            are not limited. An existing night and pack is never overwritten. A partial night is
            kept as measured. The rest-voltage comparison uses only packs that charged in parallel
            that night, and only when at least two of them did.
          </p>
        </div>
        <ul className="mt-4 space-y-3">
          {units.map((charger) => (
            <li key={charger.id} className="rounded-xl border border-[var(--line)] p-3 text-sm">
              <p className="font-mono text-[var(--ink)]">
                {charger.id} · {charger.fleet} ·{" "}
                {charger.fleetLock ? `limited to ${charger.fleet}` : "not limited to one series"}
              </p>
              {charger.note ? <p className="note mt-1">{charger.note}</p> : null}
            </li>
          ))}
        </ul>
        <p className="note mt-4">{siteMeta.unassignedNote}</p>
      </Panel>

      <Panel accent="muted" eyebrow="Record" title="What the logs contain">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="eyebrow">Recorded</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-[var(--muted)]">
              {siteMeta.metricsAvailable.map((key) => (
                <li key={key}>{metricLabels[key] ?? key}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="eyebrow">Not in the logs</p>
            <p className="note mt-2">
              Capacity in and capacity out stay empty on the fleet page. Storage charges do not
              include them, and they are not filled in.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
