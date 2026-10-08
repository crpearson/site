import Link from "next/link";
import { CellExplorer } from "@/components/CellExplorer";
import { Heatmap } from "@/components/Heatmap";
import { Lamp } from "@/components/Lamp";
import { LineChart } from "@/components/LineChart";
import { Panel } from "@/components/Panel";
import { Sparkline } from "@/components/Sparkline";
import { volts } from "@/lib/format";
import {
  fleetModel,
  floorBands,
  floorGuide,
  headline,
  nextBoards,
  ruleABands,
  ruleAGuides,
  ruleBBands,
  ruleBGuides,
  seriesOf,
  siteMeta,
  statusRows,
  thresholds,
} from "@/lib/fleet";

export default function Home() {
  const stats = headline();
  const rows = statusRows();
  const model = fleetModel();
  const boards = nextBoards();
  const heatValues = rows.flatMap((row) => row.cells);
  const heatMin = Math.min(...heatValues);
  const heatMax = Math.max(...heatValues);

  return (
    <div className="space-y-10">
      <header className="space-y-5">
        <div>
          <p className="eyebrow">C1 and C2 · CNHL Black Series V2</p>
          <h1 className="h1 mt-2">Fleet health</h1>
          <p className="page-intro mt-4">
            Twelve packs, read from iCharger DX8 storage charges. Calls below are the live
            status table. Charts use the IR store and leave partial nights as gaps.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
          <article className="stat" data-tone="ok">
            <p className="eyebrow">OK</p>
            <p className="stat-value">{stats.ok.length}</p>
            <p className="stat-sub">{stats.ok.map((row) => row.id).join(" · ")}</p>
          </article>
          <article className="stat" data-tone="caution">
            <p className="eyebrow">Caution</p>
            <p className="stat-value">{stats.caution.length}</p>
            <p className="stat-sub">{stats.caution.map((row) => row.id).join(" · ")}</p>
          </article>
          <article className="stat" data-tone="off">
            <p className="eyebrow">OFF</p>
            <p className="stat-value">{stats.off.length}</p>
            <p className="stat-sub">{stats.off.map((row) => row.id).join(" · ")}</p>
          </article>
          <article className="stat" data-tone="signal">
            <p className="eyebrow">Last C1 night</p>
            <p className="stat-value text-[1.15rem] sm:text-[1.28rem]">{stats.lastC1}</p>
            <p className="stat-sub">Call date {siteMeta.callDateC1}</p>
          </article>
          <article className="stat" data-tone="ruleb">
            <p className="eyebrow">Last C2 night</p>
            <p className="stat-value text-[1.15rem] sm:text-[1.28rem]">{stats.lastC2}</p>
            <p className="stat-sub">Call date {siteMeta.callDateC2}</p>
          </article>
          <article className="stat" data-tone="floor">
            <p className="eyebrow">Mean IR</p>
            <p className="stat-value">
              {stats.mean.toFixed(1)}
              <span className="ml-1 text-sm text-[var(--muted)]">mΩ</span>
            </p>
            <p className="stat-sub">Mean of the 12 latest pack averages</p>
          </article>
        </div>
      </header>

      <Panel
        accent="signal"
        eyebrow="Measured packs only"
        title="Fleet mean IR"
        action={<span className="note">mΩ · gaps are unmeasured nights</span>}
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
          ariaLabel="Mean pack IR for C1 and C2 across sessions"
        />
      </Panel>

      <section className="space-y-3" aria-labelledby="boards-heading">
        <div>
          <h2 id="boards-heading" className="section-title">
            Next parallel
          </h2>
          <p className="note mt-1">
            Board call from the status file. Rest-Δ here can drop packs marked OFF. The Rule B
            chart further down is the full measured set.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {(["C1", "C2"] as const).map((fleet) => {
            const board = boards[fleet];
            return (
              <article key={fleet} className="panel" data-accent={fleet === "C1" ? "signal" : "ruleb"}>
                <p className="eyebrow">
                  {fleet} · as of {board.as_of}
                </p>
                <h3 className="panel-title mt-1">{fleet === "C1" ? "C1 board" : "C2 board"}</h3>
                <p className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-2xl">{volts(board.rest_delta_v)} V</span>
                  <span className={board.rest_delta_band === "GO" ? "lamp lamp-ok" : "lamp lamp-caution"}>
                    <span className="lamp-dot" aria-hidden="true" />
                    {board.rest_delta_band}
                  </span>
                  <span className="note">{board.amps === "reduced" ? "Reduced amps" : "Normal amps"}</span>
                </p>
                <div className="mt-4 space-y-2">
                  <p className="metric-label">On</p>
                  <div className="flex flex-wrap gap-1.5">
                    {board.packs_on.map((id) => (
                      <Link key={id} href={`/pack/${id}`} className="chip-btn">
                        {id}
                      </Link>
                    ))}
                  </div>
                  <p className="metric-label">Off</p>
                  <div className="flex flex-wrap gap-1.5">
                    {board.packs_off.length === 0 ? (
                      <span className="note">None</span>
                    ) : (
                      board.packs_off.map((id) => (
                        <Link key={id} href={`/pack/${id}`} className="chip-btn">
                          {id}
                        </Link>
                      ))
                    )}
                  </div>
                </div>
                {"note" in board && board.note ? <p className="note mt-3">{board.note}</p> : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="packs-heading">
        <h2 id="packs-heading" className="section-title">
          Packs
        </h2>
        {(["C1", "C2"] as const).map((fleet) => (
          <div key={fleet}>
            <p className="eyebrow mb-2">{fleet}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {rows
                .filter((row) => row.fleet === fleet)
                .map((row) => (
                  <Link
                    key={row.id}
                    href={`/pack/${row.id}`}
                    className="tile"
                    data-status={row.status}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm">{row.id}</span>
                      <Lamp status={row.status} />
                    </span>
                    <Sparkline values={row.avgSeries} color={row.color} />
                    <span className="grid grid-cols-3 gap-1">
                      <span>
                        <span className="metric-label">IR</span>
                        <span className="metric-value block">{row.avg.toFixed(0)}</span>
                      </span>
                      <span>
                        <span className="metric-label">Spr</span>
                        <span className="metric-value block">{row.spread}</span>
                      </span>
                      <span>
                        <span className="metric-label">Floor</span>
                        <span className="metric-value block">{row.floor}</span>
                      </span>
                    </span>
                  </Link>
                ))}
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
            Verbatim from the status file. C1 as of {siteMeta.callDateC1}. C2 as of{" "}
            {siteMeta.callDateC2}. Latest IR, spread, and floor are each pack&apos;s last measured
            night, shown beside the call.
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
                  <th scope="col">Call date</th>
                  <th scope="col">Latest IR</th>
                  <th scope="col">Spread</th>
                  <th scope="col">Floor</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">
                      <Link href={`/pack/${row.id}`} className="pack-link">
                        {row.id}
                      </Link>
                    </th>
                    <td>
                      <Lamp status={row.status} />
                    </td>
                    <td>
                      <p className="reason">{row.reason}</p>
                      {row.detail ? <p className="note mt-1">{row.detail}</p> : null}
                    </td>
                    <td className="font-mono text-sm whitespace-nowrap">{row.callDate}</td>
                    <td className="font-mono text-sm whitespace-nowrap">
                      {row.avg.toFixed(1)}
                      <span className="mt-1 block text-[10px] text-[var(--faint)]">
                        {row.latestSession}
                      </span>
                    </td>
                    <td className="font-mono text-sm">{row.spread}</td>
                    <td className="font-mono text-sm">{row.floor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="cards md:hidden">
            {rows.map((row) => (
              <article key={row.id} className="rounded-xl border border-[var(--line)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/pack/${row.id}`} className="pack-link">
                    {row.id}
                  </Link>
                  <Lamp status={row.status} />
                </div>
                <p className="mt-2 text-sm leading-relaxed">{row.reason}</p>
                {row.detail ? <p className="note mt-1">{row.detail}</p> : null}
                <p className="note mt-2 font-mono">
                  Call {row.callDate} · IR {row.avg.toFixed(1)} · spr {row.spread} · floor {row.floor}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <Panel
        accent="signal"
        eyebrow="Latest night per pack"
        title="Cell IR heatmap"
      >
        <Heatmap
          columnLabels={["Cell 1", "Cell 2", "Cell 3", "Cell 4", "Cell 5", "Cell 6"]}
          min={heatMin}
          max={heatMax}
          caption="Color is this fleet's latest-cell range, cooler for lower IR. C1 rows are 2026-09-27. C2 rows are 2026-09-30. DX8 absolute IR is not a manufacturer rating."
          rows={rows.map((row) => ({
            key: row.id,
            label: (
              <Link href={`/pack/${row.id}`} className="pack-link">
                {row.id}
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
            Starred sessions are partial: 2026-09-26 is C1 only, 2026-09-30 is C2 only. Lines break
            there. Nothing is interpolated. IR scale is shared so C1 and C2 can be compared.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {model.fleets.map((fleet) => (
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
          {model.fleets.map((fleet) => (
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
              <p className="note mb-3">Inside one pack. Max cell IR minus min cell IR.</p>
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
          {model.fleets.map((fleet) => (
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
              Across packs on a fleet: highest rest voltage minus lowest, for every pack measured
              that night. Separate from the next-parallel board delta above.
            </p>
            <LineChart
              categories={model.categories}
              series={model.fleets.map((fleet) => ({
                id: fleet.id,
                label: fleet.id,
                color: fleet.id === "C1" ? "#2ee6c7" : "#c4a1ff",
                values: fleet.rest,
              }))}
              guides={ruleBGuides}
              bands={ruleBBands}
              yDomain={model.restDomain}
              format="volt"
              unit="V"
              ariaLabel="Inter-pack rest voltage delta for C1 and C2 with Rule B guides"
            />
          </Panel>
          <Panel accent="muted" eyebrow="Reserved" title="Capacity in / out">
            <div className="empty-slot">
              <div>
                <p className="font-mono text-sm text-[var(--ink)]">not in DX8 Storage data yet</p>
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
            packs={model.fleets.flatMap((fleet) =>
              fleet.packs.map((pack) => ({
                id: pack.id,
                status: pack.status,
                cells: pack.cells,
              })),
            )}
          />
        </Panel>
      </section>
    </div>
  );
}
