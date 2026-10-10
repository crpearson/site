import type { Metadata } from "next";
import { LineChart } from "@/components/LineChart";
import { Panel } from "@/components/Panel";
import { usd } from "@/lib/format";
import { IR_UNIT } from "@/lib/ir";
import { brandCards, fleetModel, headline, seriesBlocks } from "@/lib/fleet";

export const metadata: Metadata = {
  title: "Brand bake-off",
  description:
    "Catalog prices for CNHL Black Series V2 and bake-off candidates, checked 2026-09-23. No cost per cycle.",
};

function PriceBar({
  label,
  value,
  max,
  text,
  candidate = false,
}: {
  label: string;
  value: number;
  max: number;
  text: string;
  candidate?: boolean;
}) {
  const width = Math.max(6, (value / max) * 100);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
        <span className="text-[var(--muted)]">{label}</span>
        <span className="font-mono">{text}</span>
      </div>
      <div className="bar-track" aria-hidden="true">
        <div
          className={candidate ? "bar-fill is-candidate" : "bar-fill"}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export default function BakeoffPage() {
  const brands = brandCards();
  const owned = brands.filter((brand) => brand.ownedFleets.length > 0);
  const candidates = brands.filter((brand) => brand.ownedFleets.length === 0);
  const maxPack = Math.max(...brands.map((brand) => brand.pricePack));
  const maxAh = Math.max(...brands.map((brand) => brand.priceAh));
  const counts = headline();
  const blocks = seriesBlocks();
  const model = fleetModel();
  const checked = brands[0]?.priceChecked ?? "2026-09-23";
  const countFor = (series: string, tone: "ok" | "caution" | "off") =>
    counts[tone].filter((row) => row.series === series).length;

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow">Catalog comparison · prices checked {checked}</p>
        <h1 className="h1 mt-2">Brand bake-off</h1>
        <p className="page-intro mt-4">
          Owned series are the ones in service. Catalog prices are shop prices, not what was paid
          for a pack. Purchase date, price, and vendor are blank until they are supplied. C3 and C4
          are not commissioned, so they are not listed as packs. Bars share one scale. Cost per
          cycle is omitted: there is no cycle count yet.
        </p>
      </header>

      {owned.map((brand) => (
        <Panel key={brand.id} accent="signal" eyebrow="Owned" title={`${brand.brand} ${brand.series}`}>
          <p className="note">
            Fleets {brand.ownedFleets.join(" and ")} · {brand.cells}S · catalog {brand.capacityMah}{" "}
            mAh · {brand.connector} · {brand.chemistry}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <PriceBar label="Per pack" value={brand.pricePack} max={maxPack} text={usd(brand.pricePack)} />
            <PriceBar label="Per Ah" value={brand.priceAh} max={maxAh} text={`${usd(brand.priceAh)} / Ah`} />
          </div>
          {brand.priceNote ? <p className="note mt-3">{brand.priceNote}</p> : null}
          <p className="note mt-2">
            Price checked {brand.priceChecked}.{" "}
            <a className="pack-link" href={brand.priceSource} target="_blank" rel="noreferrer">
              Price source
            </a>
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {blocks.map((block) => (
              <article key={block.id} className="rounded-xl border border-[var(--line)] p-3">
                <p className="eyebrow">{block.id}</p>
                <p className="mt-2 font-mono text-sm">
                  {countFor(block.id, "ok")} OK · {countFor(block.id, "caution")} Caution ·{" "}
                  {countFor(block.id, "off")} OFF
                </p>
                <p className="stat-sub">
                  Status as of {block.asOf}
                  {block.individual ? " · individual, not parallel" : ""}
                </p>
              </article>
            ))}
          </div>
          <div className="mt-4">
            <p className="eyebrow">Measured IR by series</p>
            <p className="note mt-1">
              A night that series was not measured is a faint dotted join, or a hollow ring on the
              bottom edge before the first reading or after the last. No value is filled in.
            </p>
            <div className="mt-2">
              <LineChart
                categories={model.categories}
                series={model.mean.map((series) => ({ ...series, label: series.id }))}
                yDomain={model.meanDomain}
                format="ir"
                unit={IR_UNIT}
                height={180}
                ariaLabel="Mean internal resistance by series, true milliohms"
              />
            </div>
          </div>
        </Panel>
      ))}

      <div className="grid gap-3 md:grid-cols-2">
        {candidates.map((brand) => (
          <article key={brand.id} className="panel" data-accent="ruleb">
            <p className="eyebrow">Not owned · bake-off</p>
            <h2 className="panel-title mt-1">
              {brand.brand} {brand.series}
            </h2>
            <p className="note mt-2">
              {brand.cells}S · catalog {brand.capacityMah} mAh · {brand.connector}
            </p>
            <div className="mt-4 space-y-3">
              <PriceBar
                label="Per pack"
                value={brand.pricePack}
                max={maxPack}
                text={usd(brand.pricePack)}
                candidate
              />
              <PriceBar
                label="Per Ah"
                value={brand.priceAh}
                max={maxAh}
                text={`${usd(brand.priceAh)} / Ah`}
                candidate
              />
            </div>
            {brand.priceNote ? <p className="note mt-3">{brand.priceNote}</p> : null}
            <p className="note mt-2">
              Price checked {brand.priceChecked}.{" "}
              <a className="pack-link" href={brand.priceSource} target="_blank" rel="noreferrer">
                Price source
              </a>
            </p>
          </article>
        ))}
      </div>

      <article className="future-slot">
        <p className="eyebrow">Future fleet</p>
        <h2 className="mt-2 font-mono text-3xl tracking-tight">C3</h2>
        <p className="mt-3 max-w-xl text-lg">Empty slot for when Ovonic is added as C3.</p>
        <p className="note mt-2">No packs and no nights yet. The Ovonic cards above stay candidates.</p>
      </article>
    </div>
  );
}
