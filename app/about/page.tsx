import type { Metadata } from "next";
import Link from "next/link";
import { Panel } from "@/components/Panel";
import { publicSession } from "@/lib/format";
import { categories, chargers, metricLabels, siteMeta, thresholds } from "@/lib/fleet";
import { formatValue } from "@/lib/format";
import { IR_UNIT } from "@/lib/ir";

export const metadata: Metadata = {
  title: "About the data",
  description:
    "How this LiPo fleet is measured: DX8 storage charges, charge rules v5, Rule B, and what the logs do not contain.",
};

export default function AboutPage() {
  const spread = thresholds.spread_mohm;
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
          comes from the start of each storage charge. Charge rules v6 (permanent home channels, the same voltage checks, and IR checks as notes) and Rule B use the limits
          shown below. 2026-10-09-restday0 is a rest-test day-0 baseline, not a latest IR point and
          not a series mean. The rest pool is retired: C1-P4 and C2-P2 are back in rotation, and their rest
          tests complete in place. D-1 passed its 7-day rest test on 2026-10-17 and stays in rotation in the
          D pool, charged on its own, last on DX8-2 Channel 1. A Rest pool night is labeled Rest pool. D-1's 2026-10-09 run stays on series D. C3 and C4 are in
          rotation: CNHL V2 6S 1300 Black, purchased 2026-10-13. Storage night 2 was 2026-10-16.
          Each series has its own board. Watch is a note. C3-P5 is marked check first.
        </p>
        <p className="mt-4">
          <Link href="/methodology" className="pack-link">
            How packs are charged, logged and judged
          </Link>
        </p>
        <p className="note mt-4">
          Data processing and website production are done with Grok Bot and{" "}
          <a
            href="https://cursor.com"
            rel="noopener"
            className="underline decoration-[var(--faint)] underline-offset-2 hover:text-[var(--ink)]"
          >
            Cursor
          </a>
          .
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
            Internal resistance in milliohms. Each cell is the median of the DX8 IR samples on that
            storage run, already in {IR_UNIT}. Pack average is the mean of the six cells. Pack S_R
            is the whole-pack sample. Line resistance is not shown. The old end-of-run charge line is
            milliamp-hours, not IR, and it is not shown.
          </p>
        </Panel>
        <Panel accent="rulea" eyebrow="Glossary" title="Spread">
          <p className="note">
            Intra-pack spread: the highest cell IR minus the lowest cell IR in that pack, in
            milliohms. Caution is {formatValue("ir", thresholds.spread_mohm.caution_gte)} {IR_UNIT}{" "}
            or a hot cell, two nights in a row. Watch note at{" "}
            {formatValue("ir", thresholds.spread_mohm.individual_gte)} {IR_UNIT} or more on that same pattern.
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
            is the sum of the six start-cell voltages. The parallel call, the floor watch, and
            self-discharge still apply to every pack. The rest-test baseline is not a Rule B night.
          </p>
        </Panel>
        <Panel accent="off" eyebrow="Glossary" title="Self-discharge">
          <p className="note">
            Arrival imbalance is the gap between the highest and lowest cell voltage at the start
            of the charge, in millivolts. A low-cell gap is that lowest cell against the median of
            the other five. A 7-day rest test watches the weak cell after storage. A test with no
            reading yet stays open until the due date. A failed rest test takes the pack off the parallel board.
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
              Pulled. Off the board for safety, or for trouble on 3 of the last 4 nights.
            </li>
          </ul>
          <p className="note mt-4">
            A spread of {formatValue("ir", spread.caution_gte)} {IR_UNIT} or more, or a cell at{" "}
            {thresholds.cell_ratio_to_median.caution_gte}× the pack median, is a watch note. A low-cell
            gap of {thresholds.low_cell_gap_mv.individual_gte} mV or more counts as a trouble night.
            Service is separate: In service, Watch, D pool, or Retire. Rest pool nights before 2026-10-17
            are labeled Rest pool. A status line reads Parallel, then Service. The words on
            each pack are the recorded call.
          </p>
        </article>
        <article className="panel" data-accent="ruleb">
          <p className="eyebrow">Across a fleet</p>
          <h2 className="panel-title mt-1">Rule B · rest-Δ</h2>
          <ul className="mt-4 space-y-2 font-mono text-sm">
            <li className="text-[var(--ok)]">Go ≤ {rest.go_lte.toFixed(2)} V</li>
          </ul>
          <p className="note mt-4">
            Before connecting, every pack on the board must rest within {rest.go_lte.toFixed(2)} V.
            A pack outside that range is checked first and stays off the leads that night only. Its
            status does not change. Kept separate from the parallel call so a spread note and a
            rest-delta check are not read as the same limit.
          </p>
        </article>
      </div>

      <Panel accent="signal" eyebrow="Charts" title="A night with no reading">
        <p className="note">
          No chart is given a made-up value. Every recorded reading for a pack is joined to the
          next one, including D-pool nights, charge-alone nights, rest-test nights, and nights from
          before a move. Fleet charts — the series mean, the pack trends, Rule B, and the bake-off —
          draw that line solid through a night with no reading. A pack page, and the sparkline on a
          pack tile, uses a faint dotted line across a night that pack was not charged. Nothing is
          drawn before the first reading or after the last. A pack with only its first reading is a
          single point. If the series did run and the metric does not apply, the tooltip says N/A
          for that night. A star on the night label is a different mark: a partial night, one that
          did not include every pack. A pack or series that was charged on a partial night still
          has a point on the line. On a pack chart the legend reads: dotted = not charged.
        </p>
      </Panel>

      <Panel accent="off" eyebrow="Do not mix scales" title="DX8 IR is not a manufacturer rating">
        <p className="note">
          Cell IR on these packs is about 2–3.5 {IR_UNIT}. A whole pack is about 11–21 {IR_UNIT}. The
          DX8 IR reading is coarse, so it is used for relative checks and trends. It is not a
          manufacturer rating.
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
            Mapping uses that night&apos;s manifest: charger alias, channel, file number, and slots.
            The usual low cell is a soft check only. A mismatch is noted and does not move a pack.
            Cell IR is the median of the DX8 IR samples on the run, already in milliohms. The old
            end-of-run charge line is milliamp-hours and is not used as IR.
          </p>
          <p>
            A charger is limited to one series only when that limit is turned on. DX8-1 and DX8-2
            are not limited. An existing night and pack is never overwritten. A partial night is
            kept as measured. On the charts that partial night stays starred on the night label,
            which is separate from a dotted join on a pack chart for a night that pack was not charged.
            The rest-voltage comparison uses
            only packs that charged in parallel
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
