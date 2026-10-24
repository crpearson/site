import type { Metadata } from "next";
import { LineChart } from "@/components/LineChart";
import { Panel } from "@/components/Panel";
import { usd } from "@/lib/format";
import { IR_UNIT } from "@/lib/ir";
import { brandCards, fleetModel, headline, seriesBlocks } from "@/lib/fleet";
import { callChipText } from "@/lib/lamp";

export const metadata: Metadata = {
  title: "Brand bake-off",
  description:
    "Catalog prices for my CNHL Black Series V2 packs and the brands I'm comparing them with, checked 2026-09-23. No cost per cycle yet.",
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
          This puts the packs I own next to brands I haven&apos;t bought. The owned series are the ones in
          service. Catalog prices are shop prices, not what I paid, and purchase date, price and vendor stay
          blank until they&apos;re filled in. C3 and C4 (CNHL V2 6S 1300 Black, purchased 2026-10-13) are in
          rotation, and their storage night 2 was 2026-10-16. Charts show one series at a time, and the price
          bars share one scale. I&apos;ve left out cost per cycle because there&apos;s no cycle count yet.
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
                {block.id === "C3" || block.id === "C4" ? (
                  <ul className="mt-2 space-y-1 font-mono text-sm">
                    {block.slots
                      .filter((slot) => slot.status)
                      .map((slot) => (
                        <li key={slot.label}>
                          {slot.label}: {callChipText(slot.status ?? "")}
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="mt-2 font-mono text-sm">
                    {countFor(block.id, "ok")} packs Go · {countFor(block.id, "caution")} packs Caution ·{" "}
                    {countFor(block.id, "off")} packs individual only
                  </p>
                )}
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
              The line runs solid through a night that series wasn&apos;t measured, with nothing filled in. A
              series with one reading is a single point, and later readings stay on one line.
            </p>
            <div className="mt-2">
              <LineChart
                categories={model.categories}
                series={model.mean.map((series) => ({ ...series, label: series.id }))}
                yDomain={model.meanDomain}
                format="ir"
                unit={IR_UNIT}
                height={180}
                mode="aggregate"
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

    </div>
  );
}
