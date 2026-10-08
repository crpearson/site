import type { Metadata } from "next";
import { Panel } from "@/components/Panel";
import { usd } from "@/lib/format";
import { brandCards, headline, siteMeta } from "@/lib/fleet";

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
  const checked = brands[0]?.priceChecked ?? "2026-09-23";

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow">Catalog comparison · prices checked {checked}</p>
        <h1 className="h1 mt-2">Brand bake-off</h1>
        <p className="page-intro mt-4">
          C1 and C2 are owned CNHL Black Series V2 packs. The other cards are buy-summary prices
          for packs that are not in the fleet. Bars share one scale. Cost per cycle is omitted:
          there is no real cycle data.
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
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <article className="rounded-xl border border-[var(--line)] p-3">
              <p className="eyebrow">C1 health</p>
              <p className="mt-2 font-mono text-sm">
                {counts.ok.filter((row) => row.fleet === "C1").length} OK ·{" "}
                {counts.caution.filter((row) => row.fleet === "C1").length} Caution ·{" "}
                {counts.off.filter((row) => row.fleet === "C1").length} OFF
              </p>
              <p className="stat-sub">Call {siteMeta.callDateC1}</p>
            </article>
            <article className="rounded-xl border border-[var(--line)] p-3">
              <p className="eyebrow">C2 health</p>
              <p className="mt-2 font-mono text-sm">
                {counts.ok.filter((row) => row.fleet === "C2").length} OK ·{" "}
                {counts.caution.filter((row) => row.fleet === "C2").length} Caution ·{" "}
                {counts.off.filter((row) => row.fleet === "C2").length} OFF
              </p>
              <p className="stat-sub">Call {siteMeta.callDateC2}</p>
            </article>
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
        <p className="note mt-2">No packs and no sessions yet. The Ovonic cards above stay candidates.</p>
      </article>
    </div>
  );
}
