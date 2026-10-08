import Link from "next/link";
import { CellExplorer } from "@/components/CellExplorer";
import { Heatmap } from "@/components/Heatmap";
import { Lamp } from "@/components/Lamp";
import { LineChart } from "@/components/LineChart";
import { Panel } from "@/components/Panel";
import { Sparkline } from "@/components/Sparkline";
import {
  fleetModel,
  floorBands,
  floorGuide,
  headline,
  nextParallel,
  ruleABands,
  ruleAGuides,
  ruleBBands,
  ruleBGuides,
  seriesBlocks,
  seriesOf,
  statusRows,
  thresholds,
} from "@/lib/fleet";

export default function Home() {
  const stats = headline();
  const rows = statusRows();
  const blocks = seriesBlocks();
  const model = fleetModel();
  const next = nextParallel();
  const heatRows = rows.filter((row) => row.cells.length > 0);
  const heatValues = heatRows.flatMap((row) => row.cells);
  const heatMin = Math.min(...heatValues);
  const heatMax = Math.max(...heatValues);
  const measured = model.fleets.filter((fleet) => fleet.packs.length > 0);

  return (
    <div className="space-y-10">
      <header className="space-y-5">
        <div>
          <p className="eyebrow">{blocks.map((block) => block.id).join(" · ")} · CNHL Black Series V2</p>
          <h1 className="h1 mt-2">Fleet health</h1>
          <p className="page-intro mt-4">
            Each series has its own as-of date. The calls below are the latest status. Charts follow
            a pack through every measured night, including nights under an earlier label. A night a
            pack was not charged, between two measured nights, is a faint dotted line with no value
            on that night. An open end stays open. Nothing is filled in.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <article className="stat" data-tone="ok">
            <p className="eyebrow">OK</p>
            <p className="stat-value">{stats.ok.length}</p>
            <p className="stat-sub">{stats.ok.map((row) => row.label).join(" · ") || "—"}</p>
          </article>
          <article className="stat" data-tone="caution">
            <p className="eyebrow">Caution / watch</p>
            <p className="stat-value">{stats.caution.length}</p>
            <p className="stat-sub">{stats.caution.map((row) => row.label).join(" · ") || "—"}</p>
          </article>
          <article className="stat" data-tone="off">
            <p className="eyebrow">Off / pull</p>
            <p className="stat-value">{stats.off.length}</p>
            <p className="stat-sub">{stats.off.map((row) => row.label).join(" · ") || "None"}</p>
          </article>
          <article className="stat" data-tone="signal">
            <p className="eyebrow">Mean IR</p>
            <p className="stat-value">
              {stats.mean.toFixed(1)}
              <span className="ml-1 text-sm text-[var(--muted)]">mΩ</span>
            </p>
            <p className="stat-sub">Latest averages of {stats.counted} packs still in a slot</p>
          </article>
        </div>
      </header>

      <Panel
        accent="signal"
        eyebrow="Measured packs only"
        title="Series mean IR"
        action={<span className="note">mΩ · the series line stops when that series was not measured</span>}
      >
        <LineChart
          categories={model.categories}
          series={model.mean.map((fleet) => ({
            id: fleet.id,
            label: fleet.id,
            color: fleet.color,
            values: fleet.values,
          }))}
          yDomain={model.meanDomain}
          format="ir"
          unit="mΩ"
          height={200}
          ariaLabel="Mean pack IR by series across nights"
        />
      </Panel>

      <section className="space-y-3" aria-labelledby="boards-heading">
        <div>
          <h2 id="boards-heading" className="section-title">
            Next parallel
          </h2>
          <p className="note mt-1">
            As of {next.as_of}. {next.note}
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {next.series.map((board) => (
            <article key={board.series} className="panel" data-accent="signal">
              <p className="eyebrow">{board.series}</p>
              <h3 className="panel-title mt-1">{board.labels.join(" + ")}</h3>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {board.labels.map((label) => (
                  <Link key={label} href={`/slot/${label}`} className="chip-btn">
                    {label}
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="packs-heading">
        <h2 id="packs-heading" className="section-title">
          Packs
        </h2>
        {blocks.map((block) => (
          <div key={block.id}>
            <p className="eyebrow mb-2">
              {block.id}
              {block.individual ? " · individual, not parallel" : ""}
              {" · status as of "}
              {block.asOf}
              {" · last measured "}
              {block.lastMeasured}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {block.slots.map((slot) =>
                slot.empty || !slot.uid ? (
                  <Link
                    key={slot.label}
                    href={`/slot/${slot.label}`}
                    className="tile is-empty"
                    data-tone="pool"
                  >
                    <span className="font-mono text-sm">{slot.label}</span>
                    <span className="note">empty</span>
                  </Link>
                ) : (
                  <Link
                    key={slot.label}
                    href={`/pack/${slot.uid}`}
                    className={slot.excluded ? "tile is-retired" : "tile"}
                    data-tone={slot.tone ?? "pool"}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm">{slot.label}</span>
                      {slot.status ? <Lamp status={slot.status} /> : null}
                    </span>
                    {slot.badge ? <span className="badge">{slot.badge}</span> : null}
                    <Sparkline
                      values={slot.avgSeries}
                      color={slot.color}
                      service={slot.service}
                      logged={slot.logged}
                    />
                    <span className="grid grid-cols-3 gap-1">
                      <span>
                        <span className="metric-label">IR</span>
                        <span className="metric-value block">{slot.avg?.toFixed(0) ?? "—"}</span>
                      </span>
                      <span>
                        <span className="metric-label">Spread</span>
                        <span className="metric-value block">{slot.spread ?? "—"}</span>
                      </span>
                      <span>
                        <span className="metric-label">Floor</span>
                        <span className="metric-value block">{slot.floor ?? "—"}</span>
                      </span>
                    </span>
                  </Link>
                ),
              )}
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-3" aria-labelledby="calls-heading">
        <div>
          <h2 id="calls-heading" className="section-title">
            Status calls
          </h2>
          <p className="note mt-1">
            Latest call per pack, in the analyst&apos;s own words. Morning and evening of the same day
            stay separate. Lamp colour follows the wording.
          </p>
        </div>
        <div className="panel" data-accent="off">
          <div className="table-wrap hidden md:block">
            <table className="status-table">
              <thead>
                <tr>
                  <th scope="col">Pack</th>
                  <th scope="col">Status</th>
                  <th scope="col">Reason</th>
                  <th scope="col">Call</th>
                  <th scope="col">Latest IR</th>
                  <th scope="col">Spread</th>
                  <th scope="col">Floor</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.uid} className={row.excluded ? "opacity-70" : undefined}>
                    <th scope="row">
                      <Link href={`/pack/${row.uid}`} className="pack-link">
                        {row.label}
                      </Link>
                      <span className="mt-1 block font-mono text-[10px] font-normal text-[var(--faint)]">
                        {row.uid}
                      </span>
                    </th>
                    <td>
                      <Lamp status={row.status} />
                    </td>
                    <td>
                      <p className="reason">{row.reason}</p>
                      {row.badge ? <p className="note mt-1">{row.badge}</p> : null}
                    </td>
                    <td className="font-mono text-sm whitespace-nowrap">
                      {row.session === row.callDate ? row.callDate : `${row.callDate} · ${row.session}`}
                    </td>
                    <td className="font-mono text-sm whitespace-nowrap">
                      {row.avg.toFixed(1)}
                      <span className="mt-1 block text-[10px] text-[var(--faint)]">{row.latestSession}</span>
                    </td>
                    <td className="font-mono text-sm">{row.spread}</td>
                    <td className="font-mono text-sm">{row.floor ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="cards md:hidden">
            {rows.map((row) => (
              <article key={row.uid} className="rounded-xl border border-[var(--line)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/pack/${row.uid}`} className="pack-link">
                    {row.label}
                  </Link>
                  <Lamp status={row.status} />
                </div>
                <p className="mt-1 font-mono text-[10px] text-[var(--faint)]">{row.uid}</p>
                <p className="mt-2 text-sm leading-relaxed">{row.reason}</p>
                {row.badge ? <p className="note mt-1">{row.badge}</p> : null}
                <p className="note mt-2 font-mono">
                  Call {row.session} · IR {row.avg.toFixed(1)} · spread {row.spread} · floor {row.floor ?? "—"}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <Panel accent="signal" eyebrow="Latest night per pack" title="Cell IR heatmap">
        <Heatmap
          columnLabels={["Cell 1", "Cell 2", "Cell 3", "Cell 4", "Cell 5", "Cell 6"]}
          min={heatMin}
          max={heatMax}
          caption="Color is the latest-cell range on this page. A pack that moved keeps the measurement from its last storage charge. DX8 absolute IR is not a manufacturer rating."
          rows={heatRows.map((row) => ({
            key: row.uid,
            label: (
              <Link href={`/pack/${row.uid}`} className="pack-link">
                {row.label}
              </Link>
            ),
            values: row.cells,
          }))}
        />
      </Panel>

      <section className="space-y-3" aria-labelledby="trends-heading">
        <div>
          <h2 id="trends-heading" className="section-title">
            Trends
          </h2>
          <p className="note mt-1">
            A star marks a partial night: that night did not include every pack, and it is left
            incomplete. On a pack line, a faint dotted join means that pack was not charged between
            two measured nights, with no value on the skipped night. A partial night the pack was
            charged is still a normal point. The series average above stops when that series was not
            measured. An open end stays open. A pack that changed labels stays on the series it was
            measured in, and the line is not joined across a move.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {measured.map((fleet) => (
            <Panel key={fleet.id} heading="h3" accent="signal" eyebrow={fleet.id} title="Pack average IR">
              <LineChart
                categories={model.categories}
                series={seriesOf(fleet.packs, "avg")}
                yDomain={model.irDomain}
                format="ir"
                unit="mΩ"
                ariaLabel={`${fleet.id} pack average internal resistance`}
              />
            </Panel>
          ))}
          {measured.map((fleet) => (
            <Panel
              key={`${fleet.id}-spread`}
              heading="h3"
              accent="rulea"
              eyebrow={`Rule A · ${fleet.id}`}
              title="Intra-pack spread"
              action={
                <span className="note">
                  Go &lt; {thresholds.intra_pack_spread_mohm.go_lt} · Caution{" "}
                  {thresholds.intra_pack_spread_mohm.caution_lo}–
                  {thresholds.intra_pack_spread_mohm.caution_hi} · Pull ≥{" "}
                  {thresholds.intra_pack_spread_mohm.pull_gte} mΩ
                </span>
              }
            >
              <p className="note mb-3">Inside one pack. Max cell IR minus min cell IR. Applies to every pack.</p>
              <LineChart
                categories={model.categories}
                series={seriesOf(fleet.packs, "spread")}
                guides={ruleAGuides}
                bands={ruleABands}
                yDomain={model.spreadDomain}
                format="int"
                unit="mΩ"
                ariaLabel={`${fleet.id} intra-pack IR spread with Rule A guides`}
              />
            </Panel>
          ))}
          {measured.map((fleet) => (
            <Panel
              key={`${fleet.id}-floor`}
              heading="h3"
              accent="floor"
              eyebrow={fleet.id}
              title="Start floor"
              action={<span className="note">{thresholds.floor_eye_mv} mV watch</span>}
            >
              <LineChart
                categories={model.categories}
                series={seriesOf(fleet.packs, "floor")}
                guides={floorGuide}
                bands={floorBands}
                yDomain={model.floorDomain}
                format="int"
                unit="mV"
                ariaLabel={`${fleet.id} start floor voltage with a 3600 millivolt watch line`}
              />
            </Panel>
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.45fr)_minmax(16rem,0.7fr)]">
          <Panel
            accent="ruleb"
            eyebrow="Rule B"
            title="Inter-pack rest-Δ"
            action={
              <span className="note">
                Go ≤ {thresholds.inter_pack_rest_delta_v.go_lte.toFixed(2)} · Caution{" "}
                {thresholds.inter_pack_rest_delta_v.caution_lo.toFixed(2)}–
                {thresholds.inter_pack_rest_delta_v.caution_hi.toFixed(2)} · Hard stop &gt;{" "}
                {thresholds.inter_pack_rest_delta_v.hard_stop_gt.toFixed(2)} V
              </span>
            }
          >
            <p className="note mb-3">
              Per series and night, only packs that charged in parallel, and only when at least
              two of them did. Otherwise the night is N/A, charged individually.
            </p>
            <LineChart
              categories={model.categories}
              series={model.fleets
                .filter((fleet) => fleet.rest.some((value) => value != null))
                .map((fleet) => ({
                  id: fleet.id,
                  label: fleet.id,
                  color: fleet.id === "C2" ? "#c4a1ff" : "#2ee6c7",
                  values: fleet.rest,
                }))}
              guides={ruleBGuides}
              bands={ruleBBands}
              yDomain={model.restDomain}
              format="volt"
              unit="V"
              ariaLabel="Inter-pack rest voltage delta by series with Rule B guides"
            />
            <ul className="note mt-3 space-y-1">
              {model.fleets
                .filter((fleet) => fleet.individual || fleet.rest.every((value) => value == null))
                .map((fleet) => (
                  <li key={fleet.id}>
                    {fleet.id}: N/A, charged individually
                  </li>
                ))}
            </ul>
          </Panel>
          <Panel accent="muted" eyebrow="Reserved" title="Capacity in / out">
            <div className="empty-slot">
              <div>
                <p className="font-mono text-sm text-[var(--ink)]">not in the storage-charge logs yet</p>
                <p className="note mt-2">
                  Storage logs are IR and voltage only. No capacity in, capacity out, or cost per
                  cycle.
                </p>
              </div>
            </div>
          </Panel>
        </div>
        <Panel accent="signal" eyebrow="Six cells" title="Per-cell IR">
          <CellExplorer
            categories={model.categories}
            domain={model.irDomain}
              packs={measured.flatMap((fleet) =>
              fleet.packs.map((pack) => ({
                id: pack.id,
                tone: pack.tone,
                cells: pack.cells,
                service: pack.service,
                logged: pack.logged,
              })),
            )}
          />
        </Panel>
      </section>
    </div>
  );
}
