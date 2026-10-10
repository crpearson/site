import type { Metadata } from "next";
import Link from "next/link";
import { Panel } from "@/components/Panel";
import { categories, chargers, metricLabels, siteMeta, thresholds } from "@/lib/fleet";
import { formatValue } from "@/lib/format";
import { IR_UNIT } from "@/lib/ir";

export const metadata: Metadata = {
  title: "About the data",
  description:
    "How this LiPo fleet is measured: DX8 storage charges, Rules v3, Rule B, and what the logs do not contain.",
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
          comes from the start of each storage charge. Rules v3 and Rule B use the limits shown
          below. 2026-10-09-restday0 is a rest-test day-0 baseline, not a latest IR point and not a
          series mean. D-1, C1-P4, and C2-P2 are in the Rest pool until 2026-10-16. A Rest pool night
          is labeled Rest pool. D-1's 2026-10-09 run stays on series D.
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
            {session.id}
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
            or a hot cell, two nights in a row. Individual only is{" "}
            {formatValue("ir", thresholds.spread_mohm.individual_gte)} {IR_UNIT} on that same pattern.
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
            the other five. A 7-day rest test watches the weak cell after storage. Pending tests
            stay pending until the due date. A failed rest test takes the pack off the parallel board.
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
            <li className="text-[var(--ok)]">Go</li>
            <li className="text-[var(--caution)]">
              Caution, reduced current. Spread ≥ {formatValue("ir", spread.caution_gte)} {IR_UNIT}, or a
              cell ≥ {thresholds.cell_ratio_to_median.caution_gte}× the pack median, two nights in a row.
              Or a low-cell gap ≥ {thresholds.low_cell_gap_mv.caution_gte} mV on 2 of the last 3 nights.
              Or a floor under {thresholds.floor_eye_mv} mV on the usual low cell.
            </li>
            <li className="text-[var(--off)]">
              Individual only. Spread ≥ {formatValue("ir", spread.individual_gte)} {IR_UNIT}, or a cell ≥{" "}
              {thresholds.cell_ratio_to_median.individual_gte}× the median, two nights in a row. Or a gap ≥{" "}
              {thresholds.low_cell_gap_mv.individual_gte} mV on 2 of the last 3 nights. Or any cell under{" "}
              {(thresholds.min_cell_rest_mv / 1000).toFixed(2)} V. Or the pack is in the D pool, on a
              self-discharge watch, or failed a rest test.
            </li>
          </ul>
          <p className="note mt-4">
            Service is separate: In service, Watch, D pool, or Retire. A Rest pool pack is off every
            board until the 7-day reading. A status line reads Parallel, then Service. The words on
            each pack are the recorded call.
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
            Violet panel, violet caution band. Kept separate from the parallel call so a spread
            call and a rest-delta call are not read as the same limit.
          </p>
        </article>
      </div>

      <Panel accent="signal" eyebrow="Charts" title="A night not charged">
        <p className="note">
          On every line chart, a night the pack or series was in service but was not charged is
          never given a made-up value. When readings sit on both sides, a faint dotted line joins
          those real readings, and the skipped night has no value. A skipped night before the first
          reading or after the last, while that line was in service, is a small hollow ring on the
          bottom edge of the graph instead, also with no value. Nights before the pack or series
          existed, and nights after a move, are not marked, and the line is not joined across that
          move. A series line, such as the series mean or Rule B rest-Δ, uses the same marks only
          while that series has a pack. A single reading is a dot.
          If the series did run and the metric does not apply, the tooltip says N/A for that night.
          A star on the night label is a different mark: a partial night, one that did not include
          every pack. A pack or series that was charged on a partial night still has a solid point.
          The legend reads: dotted = not charged · ○ = not charged (start/end).
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
            which is separate from a dotted join or a hollow ring for a pack that was not charged.
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
