import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AliasStub } from "@/components/AliasStub";
import { Heatmap } from "@/components/Heatmap";
import { IrFigure } from "@/components/IrFigure";
import { StatusChip } from "@/components/StatusChip";
import { LineChart } from "@/components/LineChart";
import { Panel } from "@/components/Panel";
import { ProvisionalLegend } from "@/components/ProvisionalMark";
import { formatValue, isSessionId, publicProse, publicSession, shownWhen, volts } from "@/lib/format";
import { packPath } from "@/lib/pack-url";
import { callChipText, goNewText, watchRecheckText } from "@/lib/lamp";
import { IR_UNIT } from "@/lib/ir";
import {
  floorBands,
  floorGuide,
  getPack,
  nightUnpublished,
  nonStorageSession,
  restTestsFor,
  packRouteIds,
  packUids,
  resolvePackRoute,
  ruleABand,
  ruleABands,
  ruleAGuides,
  thresholds,
} from "@/lib/fleet";

function historyNote(event: { event: string; to: string; date: string; reason: string }) {
  if (event.event === "rest_pool_enter") {
    return "Off every board until the 7-day reading on 2026-10-16.";
  }
  if (event.event !== "commission") return publicProse(event.reason);
  const replacement = /replacement/i.test(event.reason);
  const when = isSessionId(event.date) ? null : event.date;
  const base = when
    ? `Commissioned into ${event.to} on ${when}, its first night with measurements. Earlier catalog nights aren't in this record. The pack ID was assigned on 2026-10-08.`
    : `Commissioned into ${event.to}, its first night with measurements. Earlier catalog nights aren't in this record. The pack ID was assigned on 2026-10-08.`;
  return replacement
    ? `${base} It replaced an earlier pack in the same slot, and that pack isn't in this record.`
    : base;
}

function historyVerb(event: string) {
  if (event === "commission") return "Commissioned";
  if (event === "move") return "Moved";
  if (event === "rest_test_start") return "Rest test started";
  if (event === "rest_pool_enter") return "Entered Rest pool";
  if (event === "rest_pool_exit") return "Left Rest pool";
  return event;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return packRouteIds().map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/batteries/pack/[id]">): Promise<Metadata> {
  const { id } = await params;
  const route = resolvePackRoute(id);
  if (!route) return { title: id };
  const pack = getPack(route.uid);
  const canonical = packPath(route.uid);
  return {
    title: pack ? `${pack.label} · ${pack.uid}` : route.uid,
    description: `Cell IR, spread, start floor, and status calls for ${route.uid}.`,
    alternates: { canonical },
    ...(route.alias ? { other: { refresh: `0; url=${canonical}` } } : {}),
  };
}

export default async function PackPage({ params }: PageProps<"/batteries/pack/[id]">) {
  const { id } = await params;
  const route = resolvePackRoute(id);
  if (!route) notFound();
  if (route.alias) {
    return <AliasStub href={packPath(route.uid)} title={route.uid} />;
  }
  const pack = getPack(route.uid);
  if (!pack) notFound();

  const latestCells = pack.row.cells;
  const historyValues = pack.cellSeries.flatMap((series) =>
    series.values.filter((value): value is number => value != null),
  );
  const band = ruleABand(pack.row.spread);
  const peers = packUids();
  const showProvisional =
    pack.row.provisional ||
    pack.points.some((point) => point.provisional) ||
    pack.restDays.some((point) => point.provisional) ||
    pack.chargeRuns.some((point) => point.provisional);

  return (
    <div className="space-y-8">
      <nav className="chip-row" aria-label="Packs">
        {peers.map((uid) => {
          const peer = getPack(uid);
          return (
            <Link
              key={uid}
              href={packPath(uid)}
              className={uid === pack.uid ? "switch-link is-on" : "switch-link"}
              aria-current={uid === pack.uid ? "page" : undefined}
            >
              {peer?.label ?? uid}
            </Link>
          );
        })}
      </nav>

      <header className="space-y-3">
        <p className="eyebrow">
          <Link href="/batteries/" className="pack-link">
            Fleet
          </Link>
          {" · "}
          <Link href={packPath(pack.uid)} className="pack-link">
            {pack.label}
          </Link>
          {" · "}
          {pack.brand} {pack.model} · {pack.capacityMah} mAh · {pack.series}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="h1">
            {pack.label}
            <span className="pack-serial"> · {pack.uid}</span>
          </h1>
          <StatusChip status={pack.call.status} chargeMode={pack.chargeMode} />
          {pack.badge ? <span className="badge">{pack.badge}</span> : null}
        </div>
        <p className="call-full">{callChipText(pack.call.status)}</p>
        {watchRecheckText(pack.call.status, pack.call.reason) ? (
          <p className="note">Go (watch). {watchRecheckText(pack.call.status, pack.call.reason)}</p>
        ) : null}
        {goNewText(pack.call.status) ? <p className="note">{goNewText(pack.call.status)}</p> : null}
        {pack.lineage ? <p className="text-lg">{pack.lineage}</p> : null}
        <p className="max-w-3xl text-lg leading-relaxed">{publicProse(pack.call.reason)}</p>
        <p className="note">
          {callChipText(pack.call.status)} · {pack.row.chargeCount} storage charges
        </p>
        {pack.row.restPool ? (
          <p className="note">
            Rest pool · day 0 {pack.row.restDay0} · 7-day reading due {pack.row.restDue}. Off every board
            and not charged during the test. {pack.label} keeps this slot.
          </p>
        ) : null}
        <p className="note">
          Status call {shownWhen(pack.call.session, pack.call.date)}
          {!isSessionId(pack.call.session) && pack.call.session !== pack.call.date
            ? ` (dated ${pack.call.date})`
            : ""}{" "}
          ·{" "}
          {pack.row.restPool
            ? "not charged (Rest pool)"
            : pack.chargeMode === "individual"
              ? "charged on its own"
              : "charged in parallel"}
        </p>
        <p className="note">
          Purchase {pack.purchaseDate} · price {pack.priceUsd} · vendor {pack.vendor}
        </p>
        {showProvisional ? <ProvisionalLegend /> : null}
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <article className="stat" data-tone="signal">
          <p className="eyebrow">Latest avg IR</p>
          <p className="stat-value">
            <span className="num">
              <IrFigure value={pack.row.avg} provisional={pack.row.provisional} unit />
            </span>
          </p>
          <p className="stat-sub">{publicSession(pack.row.latestSession)}</p>
        </article>
        <article className="stat" data-tone={band === "Go" ? "ok" : band === "Caution" ? "caution" : "floor"}>
          <p className="eyebrow">Spread</p>
          <p className="stat-value">
            <span className="num">
              <IrFigure value={pack.row.spread} provisional={pack.row.provisional} unit />
            </span>
          </p>
          <p className="stat-sub">
            {band === "Watch" ? "Watch note" : band} on this spread alone. Caution starts at{" "}
            {formatValue("ir", thresholds.spread_mohm.caution_gte)} {IR_UNIT}, watch note at{" "}
            {formatValue("ir", thresholds.spread_mohm.individual_gte)} {IR_UNIT} or more. The status call is
            separate.
          </p>
        </article>
        <article className="stat" data-tone="floor">
          <p className="eyebrow">Start floor</p>
          <p className="stat-value">
            <span className="num">{pack.row.floor ?? "—"} mV</span>
          </p>
          <p className="stat-sub">
            {pack.row.floor != null && pack.row.floor < thresholds.floor_eye_mv
              ? `Below the ${thresholds.floor_eye_mv} mV watch`
              : `Floor watch ${thresholds.floor_eye_mv} mV`}
          </p>
        </article>
        <article className="stat" data-tone="signal">
          <p className="eyebrow">Last storage</p>
          <p className="stat-value text-[1.15rem]">
            {pack.lastStorage ? publicSession(pack.lastStorage) : "—"}
          </p>
          <p className="stat-sub">
            {pack.row.lowGap != null ? `Low-cell gap ${pack.row.lowGap} mV` : "Low-cell gap —"}
            {pack.row.rest != null ? ` · rest ${volts(pack.row.rest)} V` : ""}
            {pack.row.sr != null ? (
              <>
                {" "}
                · S_R <IrFigure value={pack.row.sr} provisional={pack.row.provisional} unit />
              </>
            ) : (
              ""
            )}
          </p>
        </article>
      </div>

      {pack.chargeRuns.length ? (
        <Panel accent="signal" eyebrow="Not a storage night" title="Charge run">
          <p className="note mb-3">
            This full charge isn&apos;t the latest IR, a fleet or series mean, or a Rule B night. Its start
            voltage, floor, gap and rest come from the charge start and aren&apos;t shown here.
          </p>
          <div className="table-wrap scroll-cue" data-scroll-ok="">
            <table className="status-table">
              <thead>
                <tr>
                  <th scope="col">Session</th>
                  <th scope="col">Avg ({IR_UNIT})</th>
                  <th scope="col">Spread ({IR_UNIT})</th>
                  <th scope="col">S_R ({IR_UNIT})</th>
                </tr>
              </thead>
              <tbody>
                {pack.chargeRuns.map((point) => (
                  <tr key={point.session}>
                    <th scope="row" className="font-mono text-sm font-normal">
                      {publicSession(point.session)}
                    </th>
                    <td className="font-mono text-sm">
                      <IrFigure value={point.avg} provisional={point.provisional} />
                    </td>
                    <td className="font-mono text-sm">
                      <IrFigure value={point.spread} provisional={point.provisional} />
                    </td>
                    <td className="font-mono text-sm">
                      {point.sr == null ? "—" : <IrFigure value={point.sr} provisional={point.provisional} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      {pack.restDays.length ? (
        <Panel accent="floor" eyebrow="Not a parallel charge" title="Rest test day 0">
          <p className="note mb-3">
            This individual top-up is the day-0 baseline. It isn&apos;t the latest IR, a fleet or series mean, or
            a Rule B night.
          </p>
          <div className="table-wrap scroll-cue" data-scroll-ok="">
            <table className="status-table">
              <thead>
                <tr>
                  <th scope="col">Night</th>
                  <th scope="col">Avg ({IR_UNIT})</th>
                  <th scope="col">Spread ({IR_UNIT})</th>
                  <th scope="col">S_R ({IR_UNIT})</th>
                  <th scope="col">Floor (mV)</th>
                  <th scope="col">Gap (mV)</th>
                </tr>
              </thead>
              <tbody>
                {pack.restDays.map((point) => (
                  <tr key={point.session}>
                    <th scope="row" className="font-mono text-sm font-normal">
                      {publicSession(point.session)}
                    </th>
                    <td className="font-mono text-sm">
                      <IrFigure value={point.avg} provisional={point.provisional} />
                    </td>
                    <td className="font-mono text-sm">
                      <IrFigure value={point.spread} provisional={point.provisional} />
                    </td>
                    <td className="font-mono text-sm">
                      {point.sr == null ? "—" : <IrFigure value={point.sr} provisional={point.provisional} />}
                    </td>
                    <td className="font-mono text-sm">{point.floor ?? "—"}</td>
                    <td className="font-mono text-sm">{point.lowGap ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      {restTestsFor(pack.uid).length ? (
        <Panel accent="floor" eyebrow="7-day rest" title="Rest test">
          <ul className="space-y-2 text-sm">
            {restTestsFor(pack.uid).map((test) => (
              <li key={`${test.id}-${test.uid}`}>
                Cell {test.cell} started {test.start}. Day-0 baseline {test.readingDate || test.start}.
                7-day reading due {test.due}.{" "}
                {test.result === "unread" ? "Completes in place from the first reading of its next storage log." : `Read ${test.readDate}: ${test.result}${test.excessMv ? ` (${test.excessMv} mV extra drop)` : ""}.`}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel accent="muted" eyebrow="History" title="Slot history">
          <ol className="space-y-3">
            {pack.events.map((event) => (
              <li key={`${event.date}-${event.event}`} className="text-sm">
                <p className="font-mono text-[var(--ink)]">
                  {shownWhen(event.date)} · {historyVerb(event.event)}
                  {event.from ? ` · ${event.from}` : ""} → {event.to}
                </p>
                <p className="note mt-1">{historyNote(event)}</p>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel accent="signal" eyebrow="Calls" title="Status over time">
          <ol className="space-y-3" data-status-history="">
            {pack.calls.map((call, index) => (
              <li key={`${call.date}-${call.session}-${call.status}-${index}`} className="text-sm">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-mono">{shownWhen(call.session, call.date)}</span>
                  <span className="note">{call.label}</span>
                </p>
                <p className="call-full mt-1">{callChipText(call.status)}</p>
                <p className="mt-1 leading-relaxed">{publicProse(call.reason)}</p>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <Panel accent="signal" eyebrow={publicSession(pack.row.latestSession)} title="Latest cell IR">
        <Heatmap
          columnLabels={["Cell 1", "Cell 2", "Cell 3", "Cell 4", "Cell 5", "Cell 6"]}
          min={Math.min(...latestCells)}
          max={Math.max(...latestCells)}
          caption="Color scale is this snapshot only."
          rows={[{ key: pack.uid, label: pack.label, values: latestCells, provisional: pack.row.provisional }]}
        />
      </Panel>

      <Panel accent="signal" eyebrow="Every night for this pack" title="Cell IR across nights">
        <p className="note mb-3">
          The line follows this pack by serial, under whatever label it had that night. Every recorded
          reading is joined to the next one, including charge-alone nights and nights from before a move.
          A night it wasn&apos;t charged, between two readings, shows as a faint dotted line with no value.
          Nothing is drawn before the first reading or after the last, and a pack with only its first
          reading is a single point. A star on the night label means a partial night, which is a separate
          thing.
          {pack.nights.some((night) => night.kind === "charged-no-log")
            ? ` Charged, no log: ${pack.nights
                .filter((night) => night.kind === "charged-no-log")
                .map((night) => night.session)
                .join(", ")}. No value is plotted on that night.`
            : ""}
        </p>
        <LineChart
          categories={pack.categories}
          series={pack.cellSeries}
          yDomain={pack.irDomain}
          format="ir"
          unit={IR_UNIT}
          height={260}
          mode="pack"
          ariaLabel={`${pack.uid} per-cell internal resistance, milliohms`}
        />
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel heading="h3" accent="rulea" eyebrow="Rules v7" title="Intra-pack spread">
          <LineChart
            categories={pack.categories}
            series={pack.spreadSeries}
            guides={ruleAGuides}
            bands={ruleABands}
            yDomain={pack.spreadDomain}
            format="ir"
            unit={IR_UNIT}
            mode="pack"
            ariaLabel={`${pack.uid} intra-pack spread with watch-note guides, milliohms`}
          />
        </Panel>
        <Panel heading="h3" accent="floor" eyebrow="Watch line" title="Start floor">
          <LineChart
            categories={pack.categories}
            series={pack.floorSeries}
            guides={floorGuide}
            bands={floorBands}
            yDomain={pack.floorDomain}
            format="int"
            unit="mV"
            mode="pack"
            ariaLabel={`${pack.uid} start floor with a 3600 millivolt watch line`}
          />
        </Panel>
      </div>

      <Panel accent="muted" eyebrow="All measured nights" title="Cell IR by night">
        <Heatmap
          columnLabels={["Cell 1", "Cell 2", "Cell 3", "Cell 4", "Cell 5", "Cell 6"]}
          min={Math.min(...historyValues)}
          max={Math.max(...historyValues)}
          caption="Each night is one row. A dash means this pack wasn't charged that night. On the line chart, a faint dotted join connects the readings on either side, with no value filled in. Nothing is drawn before the first reading or after the last."
          rows={pack.categories.flatMap((category, index) =>
            nightUnpublished(category.id, pack.series) || nonStorageSession(category.id)
              ? []
              : [
                  {
                    key: category.id,
                    label: (
                      <span className="font-mono text-xs">
                        {category.label}
                        {category.partial ? "*" : ""}
                      </span>
                    ),
                    values: pack.cellSeries.map((series) => series.values[index] ?? null),
                    provisional: pack.cellSeries[0]?.provisional?.[index],
                  },
                ],
          )}
        />
      </Panel>

      <details className="panel" data-accent="muted">
        <summary className="cursor-pointer font-medium">Night table</summary>
        <p className="note mt-3">
          Cell, average and spread figures are in {IR_UNIT}. A Rest pool night is labeled Rest pool: the
          pack was off every board and wasn&apos;t charged. Not charged means the pack was in service and
          wasn&apos;t logged that night. On the charts, a faint dotted line joins the readings on either side
          of that night, and that night has no value. Nothing is drawn before the first reading or after
          the last. A star is a partial night, which is different. Nights before this pack was
          commissioned aren&apos;t marked, and readings from before a move stay on this line.
        </p>
        <div className="table-wrap scroll-cue mt-3" data-scroll-ok="">
          <table className="status-table">
            <thead>
              <tr>
                <th scope="col">Night</th>
                <th scope="col">Label</th>
                <th scope="col">Cell 1 ({IR_UNIT})</th>
                <th scope="col">Cell 2 ({IR_UNIT})</th>
                <th scope="col">Cell 3 ({IR_UNIT})</th>
                <th scope="col">Cell 4 ({IR_UNIT})</th>
                <th scope="col">Cell 5 ({IR_UNIT})</th>
                <th scope="col">Cell 6 ({IR_UNIT})</th>
                <th scope="col">Avg ({IR_UNIT})</th>
                <th scope="col">Spread ({IR_UNIT})</th>
                <th scope="col">Floor (mV)</th>
              </tr>
            </thead>
            <tbody>
              {pack.nights.map((night) =>
                night.kind === "rest-pool" ? (
                  <tr key={night.session}>
                    <th scope="row" className="font-mono text-sm font-normal">
                      {publicSession(night.session)}
                      {night.partial ? "*" : ""}
                    </th>
                    <td className="font-mono text-sm">{night.label}</td>
                    <td className="text-sm" colSpan={8}>
                      Rest pool
                    </td>
                  </tr>
                ) : night.kind === "charged-no-log" ? (
                  <tr key={night.session}>
                    <th scope="row" className="font-mono text-sm font-normal">
                      {publicSession(night.session)}
                      {night.partial ? "*" : ""}
                    </th>
                    <td className="font-mono text-sm">{night.label}</td>
                    <td className="text-sm" colSpan={8}>
                      Charged, no log
                    </td>
                  </tr>
                ) : night.kind === "measured" ? (
                  <tr key={night.session}>
                    <th scope="row" className="font-mono text-sm font-normal">
                      {publicSession(night.point.session)}
                      {night.partial ? "*" : ""}
                    </th>
                    <td className="font-mono text-sm">{night.point.label}</td>
                    {night.point.cells.map((cell, index) => (
                      <td key={`${night.session}-${index}`} className="font-mono text-sm">
                        <IrFigure value={cell} provisional={night.point.provisional} />
                      </td>
                    ))}
                    <td className="font-mono text-sm">
                      <IrFigure value={night.point.avg} provisional={night.point.provisional} />
                    </td>
                    <td className="font-mono text-sm">
                      <IrFigure value={night.point.spread} provisional={night.point.provisional} />
                    </td>
                    <td className="font-mono text-sm">{night.point.floor ?? "—"}</td>
                  </tr>
                ) : (
                  <tr key={night.session}>
                    <th scope="row" className="font-mono text-sm font-normal">
                      {publicSession(night.session)}
                      {night.partial ? "*" : ""}
                    </th>
                    <td className="font-mono text-sm">{night.label}</td>
                    <td className="text-sm" colSpan={8}>
                      Not charged
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
