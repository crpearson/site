import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AliasStub } from "@/components/AliasStub";
import { Heatmap } from "@/components/Heatmap";
import { Lamp } from "@/components/Lamp";
import { LineChart } from "@/components/LineChart";
import { Panel } from "@/components/Panel";
import { SlotDetail } from "@/components/SlotDetail";
import { formatValue, volts } from "@/lib/format";
import { IR_UNIT } from "@/lib/ir";
import {
  floorBands,
  floorGuide,
  getPack,
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
  if (event.event !== "commission") return event.reason;
  const replacement = /replacement/i.test(event.reason);
  const base = `Commissioned into ${event.to} at ${event.date}, the first night with measurements. Earlier catalog nights are not in this record. The pack ID was assigned on 2026-10-08.`;
  return replacement
    ? `${base} This pack replaced an earlier one in the same slot, which is not in this record.`
    : base;
}

function historyVerb(event: string) {
  if (event === "commission") return "Commissioned";
  if (event === "move") return "Moved";
  if (event === "rest_test_start") return "Rest test started";
  if (event === "rest_pool_enter") return "Entered Rest pool";
  return event;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return packRouteIds().map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/pack/[id]">): Promise<Metadata> {
  const { id } = await params;
  const route = resolvePackRoute(id);
  if (!route) return { title: id };
  if (route.type === "pack") {
    const pack = getPack(route.uid);
    const canonical = `/pack/${route.uid}/`;
    return {
      title: pack ? `${pack.label} · ${pack.uid}` : route.uid,
      description: `Cell IR, spread, start floor, and status calls for ${route.uid}.`,
      alternates: { canonical },
      ...(route.alias ? { other: { refresh: `0; url=${canonical}` } } : {}),
    };
  }
  const canonical = `/pack/${route.label}/`;
  return {
    title: route.label,
    description: `Current and past occupants of ${route.label}.`,
    alternates: { canonical },
    ...(route.alias ? { other: { refresh: `0; url=${canonical}` } } : {}),
  };
}

export default async function PackPage({ params }: PageProps<"/pack/[id]">) {
  const { id } = await params;
  const route = resolvePackRoute(id);
  if (!route) notFound();
  if (route.alias) {
    const href = route.type === "pack" ? `/pack/${route.uid}/` : `/pack/${route.label}/`;
    const title = route.type === "pack" ? route.uid : route.label;
    return <AliasStub href={href} title={title} />;
  }
  if (route.type === "slot") {
    return <SlotDetail label={route.label} />;
  }
  const pack = getPack(route.uid);
  if (!pack) notFound();

  const latestCells = pack.row.cells;
  const historyValues = pack.cellSeries.flatMap((series) =>
    series.values.filter((value): value is number => value != null),
  );
  const band = ruleABand(pack.row.spread);
  const peers = packUids();

  return (
    <div className="space-y-8">
      <nav className="chip-row" aria-label="Packs">
        {peers.map((uid) => {
          const peer = getPack(uid);
          return (
            <Link
              key={uid}
              href={`/pack/${uid}`}
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
          <Link href="/" className="pack-link">
            Fleet
          </Link>
          {" · "}
          <Link href={`/slot/${pack.label}`} className="pack-link">
            {pack.label}
          </Link>
          {" · "}
          {pack.brand} {pack.model} · {pack.capacityMah} mAh · {pack.series}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="h1">{pack.label}</h1>
          <Lamp status={pack.call.status} />
          {pack.badge ? <span className="badge">{pack.badge}</span> : null}
        </div>
        <p className="font-mono text-sm text-[var(--muted)]">Pack ID {pack.uid}</p>
        {pack.lineage ? <p className="text-lg">{pack.lineage}</p> : null}
        <p className="max-w-3xl text-lg leading-relaxed">{pack.call.reason}</p>
        <p className="note">
          Parallel {pack.row.parallel || pack.call.status}
          {pack.row.service ? ` · Service ${pack.row.service}` : ""} · {pack.row.chargeCount} storage charges
        </p>
        {pack.row.restPool ? (
          <p className="note">
            Rest pool · day 0 {pack.row.restDay0} · 7-day reading due {pack.row.restDue}. Off every board
            and not charged during the test. {pack.label} keeps this slot.
          </p>
        ) : null}
        <p className="note">
          Status call {pack.call.session}
          {pack.call.session !== pack.call.date ? ` (dated ${pack.call.date})` : ""} ·{" "}
          {pack.chargeMode === "individual" ? "charged on its own" : "charged in parallel"}
        </p>
        <p className="note">
          Purchase {pack.purchaseDate} · price {pack.priceUsd} · vendor {pack.vendor}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <article className="stat" data-tone="signal">
          <p className="eyebrow">Latest avg IR</p>
          <p className="stat-value">
            {formatValue("ir", pack.row.avg)}
            <span className="ml-1 text-sm text-[var(--muted)]">{IR_UNIT}</span>
          </p>
          <p className="stat-sub">{pack.row.latestSession}</p>
        </article>
        <article className="stat" data-tone={band === "Go" ? "ok" : band === "Caution" ? "caution" : "off"}>
          <p className="eyebrow">Spread</p>
          <p className="stat-value">
            {formatValue("ir", pack.row.spread)}
            <span className="ml-1 text-sm text-[var(--muted)]">{IR_UNIT}</span>
          </p>
          <p className="stat-sub">
            {band} on this spread alone. Caution starts at {thresholds.spread_mohm.caution_gte} {IR_UNIT},
            individual at {thresholds.spread_mohm.individual_gte} {IR_UNIT}. The status call is separate.
          </p>
        </article>
        <article className="stat" data-tone="floor">
          <p className="eyebrow">Start floor</p>
          <p className="stat-value">
            {pack.row.floor ?? "—"}
            <span className="ml-1 text-sm text-[var(--muted)]">mV</span>
          </p>
          <p className="stat-sub">
            {pack.row.floor != null && pack.row.floor < thresholds.floor_eye_mv
              ? `Below the ${thresholds.floor_eye_mv} mV watch`
              : `Floor watch ${thresholds.floor_eye_mv} mV`}
          </p>
        </article>
        <article className="stat" data-tone="ruleb">
          <p className="eyebrow">Rule B · rest</p>
          <p className="stat-value text-[1.15rem]">{pack.ruleB ?? "Charged in parallel"}</p>
          <p className="stat-sub">
            {pack.row.lowGap != null ? `Low-cell gap ${pack.row.lowGap} mV` : "Low-cell gap —"}
            {pack.row.rest != null ? ` · rest ${volts(pack.row.rest)} V` : ""}
            {pack.row.sr != null ? ` · S_R ${formatValue("ir", pack.row.sr)} ${IR_UNIT}` : ""}
          </p>
        </article>
      </div>

      {pack.restDays.length ? (
        <Panel accent="floor" eyebrow="Not a parallel charge" title="Rest test day 0">
          <p className="note mb-3">
            This individual top-up is the day-0 baseline. It is not the latest IR, not a fleet or series
            mean, and not a Rule B night.
          </p>
          <div className="table-wrap">
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
                      {point.session}
                    </th>
                    <td className="font-mono text-sm">{formatValue("ir", point.avg)}</td>
                    <td className="font-mono text-sm">{formatValue("ir", point.spread)}</td>
                    <td className="font-mono text-sm">{point.sr == null ? "—" : formatValue("ir", point.sr)}</td>
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
                7-day reading due {test.due}. {test.result === "pending" ? "Pending." : test.result}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel accent="muted" eyebrow="History" title="Label history">
          <ol className="space-y-3">
            {pack.events.map((event) => (
              <li key={`${event.date}-${event.event}`} className="text-sm">
                <p className="font-mono text-[var(--ink)]">
                  {event.date} · {historyVerb(event.event)}
                  {event.from ? ` · ${event.from}` : ""} → {event.to}
                </p>
                <p className="note mt-1">{historyNote(event)}</p>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel accent="signal" eyebrow="Calls" title="Status timeline">
          <ol className="space-y-3">
            {pack.calls.map((call, index) => (
              <li key={`${call.date}-${call.session}-${call.status}-${index}`} className="text-sm">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-mono">{call.session}</span>
                  <Lamp status={call.status} />
                  <span className="note">{call.label}</span>
                </p>
                <p className="mt-1 leading-relaxed">{call.reason}</p>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <Panel accent="signal" eyebrow={pack.row.latestSession} title="Latest IR cell heatmap">
        <Heatmap
          columnLabels={["Cell 1", "Cell 2", "Cell 3", "Cell 4", "Cell 5", "Cell 6"]}
          min={Math.min(...latestCells)}
          max={Math.max(...latestCells)}
          caption="Color scale is this snapshot only."
          rows={[{ key: pack.uid, label: pack.label, values: latestCells }]}
        />
      </Panel>

      <Panel accent="signal" eyebrow="Every night for this pack" title="Cell IR across nights">
        <p className="note mb-3">
          The line follows this pack under whatever label it had that night. A night it was not
          charged, between two readings, is a faint dotted line with no value on that night. A
          skipped night before the first reading or after the last is a small hollow ring on the
          bottom edge, also with no value. A star on the night label is a partial night and is
          separate. Nights after a move to another slot are not marked, and the line is not joined
          across that move.
        </p>
        <LineChart
          categories={pack.categories}
          series={pack.cellSeries}
          yDomain={pack.irDomain}
          format="ir"
          unit={IR_UNIT}
          height={260}
          ariaLabel={`${pack.uid} per-cell internal resistance, milliohms`}
        />
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel heading="h3" accent="rulea" eyebrow="Rules v3" title="Intra-pack spread">
          <LineChart
            categories={pack.categories}
            series={pack.spreadSeries}
            guides={ruleAGuides}
            bands={ruleABands}
            yDomain={pack.spreadDomain}
            format="ir"
            unit={IR_UNIT}
            ariaLabel={`${pack.uid} intra-pack spread with Rules v3 caution and individual guides, milliohms`}
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
            ariaLabel={`${pack.uid} start floor with a 3600 millivolt watch line`}
          />
        </Panel>
      </div>

      <Panel accent="muted" eyebrow="All measured nights" title="Night by cell IR">
        <Heatmap
          columnLabels={["Cell 1", "Cell 2", "Cell 3", "Cell 4", "Cell 5", "Cell 6"]}
          min={Math.min(...historyValues)}
          max={Math.max(...historyValues)}
          caption="Each night is one line. A dash is a night this pack was not charged. Between two readings the line chart uses a faint dotted join, with no value. Before the first reading or after the last, that night is a hollow ring on the bottom edge, also with no value."
          rows={pack.categories.map((category, index) => ({
            key: category.id,
            label: (
              <span className="font-mono text-xs">
                {category.label}
                {category.partial ? "*" : ""}
              </span>
            ),
            values: pack.cellSeries.map((series) => series.values[index] ?? null),
          }))}
        />
      </Panel>

      <details className="panel" data-accent="muted">
        <summary className="cursor-pointer font-medium">Night table</summary>
        <p className="note mt-3">
          Cell, average, and spread figures are {IR_UNIT}. Not charged means this pack was in
          service and was not logged that night. On the charts, a
          faint dotted line joins the readings on either side when both exist, and that night has no
          value. A skipped night before the first reading or after the last is a hollow ring on the
          bottom edge, also with no value. A star is a partial night, which is different. Nights
          before this pack was commissioned, and nights after it moved slots, are not marked.
        </p>
        <div className="table-wrap mt-3">
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
                      {night.session}
                      {night.partial ? "*" : ""}
                    </th>
                    <td className="font-mono text-sm">{night.label}</td>
                    <td className="text-sm" colSpan={8}>
                      Rest pool
                    </td>
                  </tr>
                ) : night.kind === "measured" ? (
                  <tr key={night.session}>
                    <th scope="row" className="font-mono text-sm font-normal">
                      {night.point.session}
                      {night.partial ? "*" : ""}
                    </th>
                    <td className="font-mono text-sm">{night.point.label}</td>
                    {night.point.cells.map((cell, index) => (
                      <td key={`${night.session}-${index}`} className="font-mono text-sm">
                        {formatValue("ir", cell)}
                      </td>
                    ))}
                    <td className="font-mono text-sm">{formatValue("ir", night.point.avg)}</td>
                    <td className="font-mono text-sm">{formatValue("ir", night.point.spread)}</td>
                    <td className="font-mono text-sm">{night.point.floor ?? "—"}</td>
                  </tr>
                ) : (
                  <tr key={night.session}>
                    <th scope="row" className="font-mono text-sm font-normal">
                      {night.session}
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
