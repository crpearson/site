import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AliasStub } from "@/components/AliasStub";
import { Heatmap } from "@/components/Heatmap";
import { Lamp } from "@/components/Lamp";
import { LineChart } from "@/components/LineChart";
import { Panel } from "@/components/Panel";
import { SlotDetail } from "@/components/SlotDetail";
import { volts } from "@/lib/format";
import {
  floorBands,
  floorGuide,
  getPack,
  packRouteIds,
  packUids,
  resolvePackRoute,
  ruleABand,
  ruleABands,
  ruleAGuides,
  thresholds,
} from "@/lib/fleet";

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
        <p className="font-mono text-sm text-[var(--muted)]">{pack.uid}</p>
        {pack.lineage ? <p className="text-lg">{pack.lineage}</p> : null}
        <p className="max-w-3xl text-lg leading-relaxed">{pack.call.reason}</p>
        <p className="note">
          Status call {pack.call.session}
          {pack.call.session !== pack.call.date ? ` (dated ${pack.call.date})` : ""} · charge{" "}
          {pack.chargeMode}
        </p>
        <p className="note">
          Purchase {pack.purchaseDate} · price {pack.priceUsd} · vendor {pack.vendor}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <article className="stat" data-tone="signal">
          <p className="eyebrow">Latest avg IR</p>
          <p className="stat-value">
            {pack.row.avg.toFixed(1)}
            <span className="ml-1 text-sm text-[var(--muted)]">mΩ</span>
          </p>
          <p className="stat-sub">{pack.row.latestSession}</p>
        </article>
        <article className="stat" data-tone={band === "Go" ? "ok" : band === "Caution" ? "caution" : "off"}>
          <p className="eyebrow">Spread · Rule A</p>
          <p className="stat-value">
            {pack.row.spread}
            <span className="ml-1 text-sm text-[var(--muted)]">mΩ</span>
          </p>
          <p className="stat-sub">{band} on this spread. The status call is separate.</p>
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
          <p className="stat-value text-[1.15rem]">{pack.ruleB ?? "Parallel"}</p>
          <p className="stat-sub">
            SD watch {thresholds.self_discharge_imbalance_mv} mV
            {pack.row.imbalance != null ? ` · imb ${pack.row.imbalance} mV` : ""}
            {pack.row.rest != null ? ` · rest ${volts(pack.row.rest)} V` : ""}
          </p>
        </article>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel accent="muted" eyebrow="pack_events" title="Label history">
          <ol className="space-y-3">
            {pack.events.map((event) => (
              <li key={`${event.date}-${event.event}`} className="text-sm">
                <p className="font-mono text-[var(--ink)]">
                  {event.date} · {event.event}
                  {event.from ? ` · ${event.from}` : ""} → {event.to}
                </p>
                <p className="note mt-1">{event.reason}</p>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel accent="signal" eyebrow="status_calls" title="Status timeline">
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

      <Panel accent="signal" eyebrow="Every row for this pack" title="Cell IR over sessions">
        <p className="note mb-3">
          The line follows {pack.uid} under whatever label it had that night. A missing session is
          a gap.
        </p>
        <LineChart
          categories={pack.categories}
          series={pack.cellSeries}
          yDomain={pack.irDomain}
          format="ir"
          unit="mΩ"
          height={260}
          ariaLabel={`${pack.uid} per-cell internal resistance`}
        />
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel heading="h3" accent="rulea" eyebrow="Rule A" title="Intra-pack spread">
          <LineChart
            categories={pack.categories}
            series={pack.spreadSeries}
            guides={ruleAGuides}
            bands={ruleABands}
            yDomain={pack.spreadDomain}
            format="int"
            unit="mΩ"
            ariaLabel={`${pack.uid} intra-pack spread with Rule A guides`}
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

      <Panel accent="muted" eyebrow="All measured nights" title="Session × cell IR">
        <Heatmap
          columnLabels={["Cell 1", "Cell 2", "Cell 3", "Cell 4", "Cell 5", "Cell 6"]}
          min={Math.min(...historyValues)}
          max={Math.max(...historyValues)}
          caption="Every session is a row. An em dash is a night this pack was not logged."
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
        <summary className="cursor-pointer font-medium">Session table</summary>
        <div className="table-wrap mt-3">
          <table className="status-table">
            <thead>
              <tr>
                <th scope="col">Session</th>
                <th scope="col">Label</th>
                <th scope="col">Cell 1</th>
                <th scope="col">Cell 2</th>
                <th scope="col">Cell 3</th>
                <th scope="col">Cell 4</th>
                <th scope="col">Cell 5</th>
                <th scope="col">Cell 6</th>
                <th scope="col">Avg</th>
                <th scope="col">Spread</th>
                <th scope="col">Floor</th>
              </tr>
            </thead>
            <tbody>
              {pack.points.map((point) => (
                <tr key={point.session}>
                  <th scope="row" className="font-mono text-sm font-normal">
                    {point.session}
                  </th>
                  <td className="font-mono text-sm">{point.label}</td>
                  {point.cells.map((cell, index) => (
                    <td key={`${point.session}-${index}`} className="font-mono text-sm">
                      {cell}
                    </td>
                  ))}
                  <td className="font-mono text-sm">{point.avg.toFixed(1)}</td>
                  <td className="font-mono text-sm">{point.spread}</td>
                  <td className="font-mono text-sm">{point.floor ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
