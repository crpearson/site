import type { Metadata } from "next";
import Link from "next/link";
import { Panel } from "@/components/Panel";
import { publicSession } from "@/lib/format";
import { categories, chargers, metricLabels, siteMeta, thresholds } from "@/lib/fleet";
import { formatValue } from "@/lib/format";
import { IR_UNIT } from "@/lib/ir";

export const metadata: Metadata = {
  title: "Terms and rules",
  description:
    "How I measure my LiPo fleet: DX8 storage charges, charge rules v7, Rule B, and what the logs don't contain.",
};

export default function TermsAndRulesPage() {
  const spread = thresholds.spread_mohm;
  const rest = thresholds.inter_pack_rest_delta_v;
  const units = chargers();

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow">Source and rules</p>
        <h1 className="h1 mt-2">Terms and rules</h1>
        <div className="page-intro mt-4 space-y-4">
          <p>
            {siteMeta.source}. Logged through {siteMeta.lastIngest}: {siteMeta.rowCount} measurements
            across {siteMeta.sessionCount} nights. Rest voltage comes from the start of each storage
            charge. Charge rules v7 and Rule B use the limits shown below. In short, v7 means every pack
            has a permanent home channel, a pack is pulled only for fire risk, a pack that fails a board
            check charges alone that night, and IR checks are performance notes.
          </p>
          <p>
            A few dates to know. 2026-10-09-restday0 is a rest-test day-0 baseline. It isn&apos;t a latest
            IR point or a series mean. The rest pool is retired: C1-P4 and C2-P2 are back in rotation, and
            their rest tests passed as self-discharge checks on 2026-10-18. C1-P1 passed its 7-day rest
            test on 2026-10-17 and is back in rotation as C1-P1 from 2026-10-18, and its whole history
            shows as C1-P1. A Rest pool night is labeled Rest pool. C3 and C4 (CNHL V2 6S 1300 Black,
            purchased 2026-10-13) are in rotation. Storage night 2 was 2026-10-16.
          </p>
          <p>
            Each series has its own board. Watch notes and performance notes are just notes. C3-P5 is
            marked check first.
          </p>
        </div>
        <p className="mt-4">
          <Link href="/batteries/methodology/" className="pack-link">
            How I charge, log and judge my packs
          </Link>
        </p>
      </header>

      <div className="flex flex-wrap gap-1.5" aria-label="Nights">
        {categories.map((session) => (
          <span
            key={session.id}
            className={session.partial ? "session-chip is-partial" : "session-chip"}
          >
            {publicSession(session.id)}
            {session.partial ? " · partial" : ""}
          </span>
        ))}
      </div>

      <section className="grid gap-3 lg:grid-cols-2" aria-label="Glossary">
        <Panel accent="signal" eyebrow="Glossary" title="IR">
          <p className="note">
            Internal resistance, in milliohms. Each cell&apos;s value is the median of the DX8&apos;s IR
            samples on that storage run, already in {IR_UNIT}. The pack average is the mean of the six
            cells, and pack S_R is the whole-pack sample. I don&apos;t show line resistance. I also don&apos;t
            show the old end-of-run charge line, because it&apos;s milliamp-hours, not IR.
          </p>
        </Panel>
        <Panel accent="rulea" eyebrow="Glossary" title="Spread">
          <p className="note">
            Intra-pack spread is the highest cell IR minus the lowest cell IR in one pack, in milliohms.
            Caution is {formatValue("ir", thresholds.spread_mohm.caution_gte)} {IR_UNIT} or a hot cell,
            two nights in a row. At {formatValue("ir", thresholds.spread_mohm.individual_gte)} {IR_UNIT}{" "}
            or more, on that same pattern, it gets a watch note.
          </p>
        </Panel>
        <Panel accent="floor" eyebrow="Glossary" title="Floor">
          <p className="note">
            Start floor is the lowest cell voltage at the start of the storage charge, in millivolts.
            There&apos;s a watch line at {thresholds.floor_eye_mv} mV.
          </p>
        </Panel>
        <Panel accent="ruleb" eyebrow="Glossary" title="Rest-Δ">
          <p className="note">
            Inter-pack rest delta, in volts. Within one series on one night, it&apos;s the highest rest
            voltage minus the lowest, counting only packs that charged in parallel. If a series or night
            has fewer than two parallel packs, it&apos;s N/A, charged individually. Rest voltage is the sum of
            the six start-cell voltages. The parallel call, the floor watch and the self-discharge check
            still apply to every pack. The rest-test baseline isn&apos;t a Rule B night.
          </p>
        </Panel>
        <Panel accent="off" eyebrow="Glossary" title="Self-discharge">
          <p className="note">
            Arrival imbalance is the gap between the highest and lowest cell voltage at the start of the
            charge, in millivolts. The low-cell gap compares that lowest cell with the median of the other
            five. A 7-day rest test watches the weak cell after storage. A test with no reading yet stays
            open until its due date. If a pack fails a rest test, it comes off the parallel board.
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
          <h2 className="panel-title mt-1">Parallel call</h2>
          <ul className="mt-4 space-y-2 font-mono text-sm">
            <li className="text-[var(--ok)]">Go. On its parallel board. This is the default.</li>
            <li className="text-[var(--caution)]">Watch. A note only. The pack stays on its board.</li>
            <li className="text-[var(--off)]">
              Pulled. Fire risk only: swelling or damage, heat, a very low cell, self-discharge, or abnormal charging. Not charged.
            </li>
          </ul>
          <p className="note mt-4">
            A spread of {formatValue("ir", spread.caution_gte)} {IR_UNIT} or more, a cell at{" "}
            {thresholds.cell_ratio_to_median.caution_gte}× the pack median, or a low-cell gap of{" "}
            {thresholds.low_cell_gap_mv.individual_gte} mV or more is a performance note. Service status is
            separate: In service, Watch, Pulled or Retire. Rest pool nights before 2026-10-17 are labeled
            Rest pool. Each status line reads Parallel first, then Service, and the words on each pack are
            the recorded call.
          </p>
        </article>
        <article className="panel" data-accent="ruleb">
          <p className="eyebrow">Across a fleet</p>
          <h2 className="panel-title mt-1">Rule B · rest-Δ</h2>
          <ul className="mt-4 space-y-2 font-mono text-sm">
            <li className="text-[var(--ok)]">Go ≤ {rest.go_lte.toFixed(2)} V</li>
          </ul>
          <p className="note mt-4">
            Before I connect anything, every pack on the board has to rest within {rest.go_lte.toFixed(2)}{" "}
            V. A pack outside that range gets checked first and stays off the leads that night only. Its
            status doesn&apos;t change. I keep this separate from the parallel call so a spread note and a
            rest-delta check don&apos;t get read as the same limit.
          </p>
        </article>
      </div>

      <Panel accent="signal" eyebrow="Charts" title="A night with no reading">
        <p className="note">
          No chart gets a made-up value. Every recorded reading for a pack is joined to the next one,
          including charge-alone nights, rest-test nights and nights from before a move. The fleet charts
          (series mean, pack trends, Rule B and the bake-off) draw that line solid through a night with no
          reading. A pack page, and the sparkline on a pack tile, use a faint dotted line across a night
          that pack wasn&apos;t charged. Nothing is drawn before the first reading or after the last, and a
          pack with only its first reading is a single point. If the series ran and the metric doesn&apos;t
          apply, the tooltip says N/A for that night. A star on the night label means something else: a
          partial night, one that didn&apos;t include every pack. A pack or series that charged on a partial
          night still gets a point on the line. On a pack chart, the legend reads: dotted = not charged.
        </p>
      </Panel>

      <Panel accent="off" eyebrow="Do not mix scales" title="DX8 IR is not a manufacturer rating">
        <p className="note">
          Cell IR on these packs is about 2–3.5 {IR_UNIT}, and a whole pack is about 11–21 {IR_UNIT}. The
          DX8&apos;s IR reading is coarse, so I use it for relative checks and trends. It isn&apos;t a manufacturer
          rating.
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
            I only record storage charges. Each log belongs to one charger, and the two chargers never get
            mixed into one sequence. The chargers&apos; serial numbers stay off the site; the pages just say
            DX8-1 and DX8-2.
          </p>
          <p>
            Each night, the logs on each channel are matched, in order, to that night&apos;s slot list. If the
            number of logs doesn&apos;t match the number of slots, the night is refused, and nothing gets
            quietly reassigned. When a night has no slot list, the default is: DX8-1 channel 1 is C1-P1
            through C1-P3, DX8-1 channel 2 is C1-P4 through C1-P6, DX8-2 channel 1 is C2-P1 through C2-P3,
            and DX8-2 channel 2 is C2-P4 through C2-P6. The slot list wins when a slot is empty or a pack
            charges on its own.
          </p>
          <p>
            Mapping uses that night&apos;s manifest: charger alias, channel, file number and slots. A pack&apos;s
            usual low cell is only a soft check; a mismatch gets a note and doesn&apos;t move the pack. Cell IR
            is the median of the DX8 IR samples on the run, already in milliohms. The old end-of-run charge
            line is milliamp-hours, so it isn&apos;t used as IR.
          </p>
          <p>
            A charger is limited to one series only when that limit is turned on, and neither DX8-1 nor
            DX8-2 is limited. An existing night-and-pack record is never overwritten. A partial night is
            kept as measured, and on the charts it stays starred on the night label. That star is separate
            from the dotted join a pack chart uses for a night that pack wasn&apos;t charged. The rest-voltage
            comparison uses only packs that charged in parallel that night, and only when at least two of
            them did.
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
              Capacity in and capacity out stay empty on the fleet page. Storage charges don&apos;t record
              them, and I don&apos;t fill them in.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
