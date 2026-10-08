import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Heatmap } from "@/components/Heatmap";
import { Lamp } from "@/components/Lamp";
import { LineChart } from "@/components/LineChart";
import { Panel } from "@/components/Panel";
import { volts } from "@/lib/format";
import {
  PACK_IDS,
  floorBands,
  floorGuide,
  getPack,
  ruleABand,
  ruleABands,
  ruleAGuides,
  siteMeta,
  thresholds,
} from "@/lib/fleet";

export const dynamicParams = false;

export function generateStaticParams() {
  return PACK_IDS.map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/pack/[id]">): Promise<Metadata> {
  const { id } = await params;
  return {
    title: id,
    description: `Cell IR, spread, start floor, and status call for pack ${id}.`,
  };
}

export default async function PackPage({ params }: PageProps<"/pack/[id]">) {
  const { id } = await params;
  const pack = getPack(id);
  if (!pack) notFound();

  const latestCells = pack.row.cells;
  const latestMin = Math.min(...latestCells);
  const latestMax = Math.max(...latestCells);
  const historyValues = pack.cellSeries.flatMap((series) =>
    series.values.filter((value): value is number => value != null),
  );
  const historyMin = Math.min(...historyValues);
  const historyMax = Math.max(...historyValues);
  const band = ruleABand(pack.row.spread);

  return (
    <div className="space-y-8">
      <nav className="chip-row" aria-label="Packs">
        {PACK_IDS.map((packId) => (
          <Link
            key={packId}
            href={`/pack/${packId}`}
            className={packId === pack.id ? "switch-link is-on" : "switch-link"}
            aria-current={packId === pack.id ? "page" : undefined}
          >
            {packId}
          </Link>
        ))}
      </nav>

      <header className="space-y-3">
        <p className="eyebrow">
          <Link href="/" className="pack-link">
            Fleet
          </Link>
          {" · "}
          {pack.brand} {pack.seriesName} · {pack.capacityMah} mAh · {pack.connector}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="h1">{pack.id}</h1>
          <Lamp status={pack.row.status} />
        </div>
        <p className="max-w-3xl text-lg leading-relaxed">{pack.row.reason}</p>
        <p className="note">
          Status call {pack.row.callDate}
          {pack.fleet === "C1"
            ? ` · C1 calls as of ${siteMeta.callDateC1}`
            : ` · C2 calls as of ${siteMeta.callDateC2}`}
          {pack.row.detail ? ` · ${pack.row.detail}` : ""}
        </p>
        {pack.note ? <p className="note">Registry note: {pack.note}</p> : null}
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
          <p className="stat-sub">{band} on this spread. Status call is separate.</p>
        </article>
        <article className="stat" data-tone="floor">
          <p className="eyebrow">Start floor</p>
          <p className="stat-value">
            {pack.row.floor}
            <span className="ml-1 text-sm text-[var(--muted)]">mV</span>
          </p>
          <p className="stat-sub">
            {pack.row.floor < thresholds.floor_eye_mv
              ? `Below the ${thresholds.floor_eye_mv} mV watch`
              : `At or above the ${thresholds.floor_eye_mv} mV watch`}
          </p>
        </article>
        <article className="stat" data-tone="ruleb">
          <p className="eyebrow">Imbalance · rest</p>
          <p className="stat-value text-[1.35rem]">
            {pack.row.imbalance ?? "—"}
            <span className="ml-1 text-sm text-[var(--muted)]">mV</span>
          </p>
          <p className="stat-sub">
            SD watch {thresholds.self_discharge_imbalance_mv} mV
            {pack.row.rest != null ? ` · rest ${volts(pack.row.rest)} V` : ""}
          </p>
        </article>
      </div>

      <Panel accent="signal" eyebrow={pack.row.latestSession} title="Latest IR cell heatmap">
        <Heatmap
          columnLabels={["Cell 1", "Cell 2", "Cell 3", "Cell 4", "Cell 5", "Cell 6"]}
          min={latestMin}
          max={latestMax}
          caption="Color scale is this snapshot only, so the hottest cell in the latest charge stands out."
          rows={[
            {
              key: pack.id,
              label: pack.id,
              values: latestCells,
            },
          ]}
        />
      </Panel>

      <Panel accent="signal" eyebrow="This pack" title="Cell IR over sessions">
        <p className="note mb-3">
          Scale is this pack. A missing session is a gap, including the night the other fleet was
          logged alone.
        </p>
        <LineChart
          categories={pack.categories}
          series={pack.cellSeries}
          yDomain={pack.irDomain}
          format="ir"
          unit="mΩ"
          height={260}
          ariaLabel={`${pack.id} per-cell internal resistance`}
        />
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel
          heading="h3"
          accent="rulea"
          eyebrow="Rule A"
          title="Intra-pack spread"
        >
          <LineChart
            categories={pack.categories}
            series={pack.spreadSeries}
            guides={ruleAGuides}
            bands={ruleABands}
            yDomain={pack.spreadDomain}
            format="int"
            unit="mΩ"
            ariaLabel={`${pack.id} intra-pack spread with Rule A guides`}
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
            ariaLabel={`${pack.id} start floor with a 3600 millivolt watch line`}
          />
        </Panel>
      </div>

      <Panel accent="muted" eyebrow="All measured nights" title="Session × cell IR">
        <Heatmap
          columnLabels={["Cell 1", "Cell 2", "Cell 3", "Cell 4", "Cell 5", "Cell 6"]}
          min={historyMin}
          max={historyMax}
          caption="Every session is a row. An em dash is a night this pack was not logged. Those nights are not filled in. Color uses this pack's own IR range."
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
                  {point.cells.map((cell, index) => (
                    <td key={`${point.session}-${index}`} className="font-mono text-sm">
                      {cell}
                    </td>
                  ))}
                  <td className="font-mono text-sm">{point.avg.toFixed(1)}</td>
                  <td className="font-mono text-sm">{point.spread}</td>
                  <td className="font-mono text-sm">{point.floor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
