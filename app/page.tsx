import Link from "next/link";
import { CellExplorer } from "@/components/CellExplorer";
import { seriesColor } from "@/lib/color";
import { Heatmap } from "@/components/Heatmap";
import { IrFigure } from "@/components/IrFigure";
import { Lamp } from "@/components/Lamp";
import { PackTile } from "@/components/PackTile";
import { LineChart } from "@/components/LineChart";
import { Panel } from "@/components/Panel";
import { ProvisionalLegend, ProvisionalMark } from "@/components/ProvisionalMark";
import { StatusChip } from "@/components/StatusChip";
import { conditionalJoinNote } from "@/lib/lamp";
import { formatValue, isSessionId, publicProse, publicSession, shownWhen } from "@/lib/format";
import { IR_UNIT } from "@/lib/ir";
import {
  allRestTests,
  chargedIndividually,
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
  const individualPacks = chargedIndividually();
  const restPacks = stats.rest.map((row) => row.label);
  const rows = statusRows();
  const spreadWatch = rows
    .filter((row) => !row.excluded && !row.restPool && row.spread >= thresholds.spread_mohm.individual_gte)
    .map((row) => row.label);
  const blocks = seriesBlocks();
  const model = fleetModel();
  const next = nextParallel();
  const heatRows = rows.filter((row) => row.cells.length > 0);
  const heatValues = heatRows.flatMap((row) => row.cells);
  const heatMin = Math.min(...heatValues);
  const heatMax = Math.max(...heatValues);
  const measured = model.fleets.filter((fleet) => fleet.packs.length > 0);
  const fleetIncludesProvisional = rows.some((row) => !row.excluded && row.provisional);

  return (
    <div className="space-y-10">
      <header className="space-y-5">
        <div>
          <p className="eyebrow">{blocks.map((block) => block.id).join(" · ")} · CNHL Black Series V2</p>
          <h1 className="h1 mt-2">Fleet health</h1>
          <p className="page-intro mt-4">
            Each series has its own as-of date. The calls below are the latest status. Fleet charts
            follow a pack through every measured night, including nights under an earlier label. A
            solid line runs straight through a night with no reading. No value is filled in, and
            those charts have no dotted join and no hollow ring. Nights before the pack or series
            existed, and nights after a move, are not marked. A single reading is a dot. A pack's
            own page, and the sparkline on its tile, still use a dotted join for a night that pack
            was not charged, and a hollow ring only at a true start or end.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
          <article className="stat" data-tone="ok">
            <p className="eyebrow">Parallel Go</p>
            <p className="stat-value">
              <span className="num">
                {stats.ok.length} {stats.ok.length === 1 ? "pack" : "packs"}
              </span>
            </p>
            <p className="stat-sub">{stats.ok.map((row) => row.label).join(" · ") || "None"}</p>
          </article>
          <article className="stat" data-tone="caution">
            <p className="eyebrow">Parallel Caution</p>
            <p className="stat-value">
              <span className="num">
                {stats.caution.length} {stats.caution.length === 1 ? "pack" : "packs"}
              </span>
            </p>
            <p className="stat-sub">{stats.caution.map((row) => row.label).join(" · ") || "None"}</p>
          </article>
          <article className="stat" data-tone="off">
            <p className="eyebrow">Charged individually</p>
            <p className="stat-value">
              <span className="num">
                {individualPacks.length} {individualPacks.length === 1 ? "pack" : "packs"}
              </span>
            </p>
            <p className="stat-sub">{individualPacks.join(" · ") || "None"}</p>
          </article>
          <article className="stat" data-tone="floor">
            <p className="eyebrow">Rest pool</p>
            <p className="stat-value">
              <span className="num">
                {restPacks.length} {restPacks.length === 1 ? "pack" : "packs"}
              </span>
            </p>
            <p className="stat-sub">{restPacks.join(" · ") || "None"}</p>
          </article>
          <article className="stat" data-tone="off">
            <p className="eyebrow">
              Watch note at {formatValue("ir", thresholds.spread_mohm.individual_gte)} {IR_UNIT} or more
            </p>
            <p className="stat-value">
              <span className="num">
                {spreadWatch.length} {spreadWatch.length === 1 ? "pack" : "packs"}
              </span>
            </p>
            <p className="stat-sub">Spread only. The pack stays on its board. {spreadWatch.join(" · ") || "None."}</p>
          </article>
          <article className="stat" data-tone="signal">
            <p className="eyebrow">Mean IR</p>
            <p className="stat-value">
              <span className="num">
                {stats.mean.toFixed(2)}
                {fleetIncludesProvisional ? <ProvisionalMark /> : null} {IR_UNIT}
              </span>
            </p>
            <p className="stat-sub">
              <IrFigure value={stats.mean} provisional={fleetIncludesProvisional} unit /> across {stats.counted}{" "}
              packs still in a slot. Rest-test day 0 is not included.
              {fleetIncludesProvisional ? <ProvisionalLegend /> : null}
            </p>
          </article>
        </div>
      </header>

      <section className="panel" data-accent="floor" aria-labelledby="rest-pool-heading">
        <p className="eyebrow">Off every board</p>
        <h2 id="rest-pool-heading" className="panel-title mt-1">
          Rest pool
        </h2>
        <p className="note mt-2">
          Day 0 {stats.rest[0]?.restDay0 ?? "2026-10-09"}. 7-day reading due {stats.rest[0]?.restDue ?? "2026-10-16"}.
          These packs are not charged during the test. C1-P4 and C2-P2 keep their slots.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {stats.rest.map((row) => (
            <li key={row.uid}>
              <Link href={`/pack/${row.uid}`} className="pack-link">
                {row.label}
              </Link>
              <span className="note">
                {" "}
                · day 0 {row.restDay0} · due {row.restDue} · {row.series}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <Panel
        accent="signal"
        eyebrow="Measured packs only"
        title="Series mean IR"
        action={
          <span className="note">
            {IR_UNIT} · one reading is a dot. The line is solid through a night that series was not
            measured. No value is filled in there. Nights before that series existed are not marked.
            Rest-test day 0 is left off this mean. D-1 on 10-09 stays on series D.
          </span>
        }
      >
        <LineChart
          categories={model.categories}
          series={model.mean.map((fleet) => ({
            id: fleet.id,
            label: fleet.id,
            color: fleet.color,
            values: fleet.values,
            service: fleet.service,
            unpublished: fleet.unpublished,
            provisional: fleet.provisional,
          }))}
          yDomain={model.meanDomain}
          format="ir"
          unit={IR_UNIT}
          height={200}
          mode="aggregate"
          ariaLabel="Mean pack IR by series across nights, true milliohms"
        />
      </Panel>

      <section className="space-y-3" aria-labelledby="boards-heading">
        <div>
          <h2 id="boards-heading" className="section-title">
            Next parallel
          </h2>
          <p className="note mt-1">{next.note}</p>
          {next.resting.length ? (
            <p className="note mt-1">
              Rest pool until {next.resting[0]?.until}: {next.resting.map((pack) => pack.label).join(", ")}.
            </p>
          ) : null}
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {next.series.map((board) => (
            <article key={board.series} className="panel" data-accent="signal">
              <p className="eyebrow">
                {board.series}
                {" · last public measurement "}
                {publicSession(blocks.find((block) => block.id === board.series)?.lastMeasured ?? "")}
              </p>
              <h3 className="panel-title mt-1">{board.labels.join(" + ")}</h3>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {board.labels.map((label) => {
                  const row = rows.find((item) => item.label === label);
                  const condition = row ? conditionalJoinNote(row.status) : null;
                  return (
                    <Link key={label} href={`/slot/${label}`} className="chip-btn">
                      <span>{label}</span>
                      {condition && row ? (
                        <>
                          <StatusChip status={row.status} chargeMode={row.chargeMode} />
                          <span className="chip-condition">{condition}</span>
                        </>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="packs-heading">
        <h2 id="packs-heading" className="section-title">
          Packs
        </h2>
        <p className="note">
          Each card shows one status word. The full note from the latest check is under the small
          chart, and in full on the pack page.
        </p>
        {blocks.map((block) => (
          <div key={block.id}>
            <p className="eyebrow mb-2">
              {block.id}
              {block.individual ? " · individual, not parallel" : ""}
              {" · status as of "}
              {block.asOf}
              {" · last measured "}
              {publicSession(block.lastMeasured)}
            </p>
            <div className="pack-grid">
              {block.slots.map((slot) => (
                <PackTile key={slot.label} slot={slot} />
              ))}
            </div>
            {block.slots.some((slot) => slot.provisional) ? <ProvisionalLegend /> : null}
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
          {rows.some((row) => row.provisional) ? <ProvisionalLegend /> : null}
          <div className="table-wrap hidden md:block" data-scroll-ok="">
            <table className="status-table">
              <thead>
                <tr>
                  <th scope="col">Pack</th>
                  <th scope="col">Status</th>
                  <th scope="col">Reason</th>
                  <th scope="col">Call</th>
                  <th scope="col">Latest IR ({IR_UNIT})</th>
                  <th scope="col">Spread ({IR_UNIT})</th>
                  <th scope="col">Floor (mV)</th>
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
                      <Lamp status={row.parallel || row.status} />
                      <p className="mt-1 text-sm">{row.parallel || row.status}</p>
                      {row.service ? <p className="note mt-1">Service {row.service}</p> : null}
                      {row.restPool ? (
                        <p className="note mt-1">
                          Rest pool · day 0 {row.restDay0} · due {row.restDue}
                        </p>
                      ) : null}
                    </td>
                    <td>
                      <p className="reason">{publicProse(row.reason)}</p>
                      {row.badge ? <p className="note mt-1">{row.badge}</p> : null}
                    </td>
                    <td className="font-mono text-sm whitespace-nowrap">
                      {!isSessionId(row.session) && row.session !== row.callDate
                        ? `${row.callDate} · ${row.session}`
                        : shownWhen(row.session, row.callDate)}
                    </td>
                    <td className="font-mono text-sm whitespace-nowrap">
                      <IrFigure value={row.avg} provisional={row.provisional} />
                      <span className="mt-1 block text-[10px] text-[var(--faint)]">
                        {publicSession(row.latestSession)}
                      </span>
                    </td>
                    <td className="font-mono text-sm">
                      <IrFigure value={row.spread} provisional={row.provisional} />
                    </td>
                    <td className="font-mono text-sm">{row.floor ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="cards md:hidden">
            {rows.map((row) => (
              <article key={row.uid} className="rounded-xl border border-[var(--line)] p-3">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <Link href={`/pack/${row.uid}`} className="pack-link">
                    {row.label}
                  </Link>
                  <Lamp status={row.parallel || row.status} />
                </div>
                <p className="mt-1 font-mono text-[10px] text-[var(--faint)]">{row.uid}</p>
                <p className="mt-2 text-sm leading-relaxed">{publicProse(row.reason)}</p>
                {row.badge ? <p className="note mt-1">{row.badge}</p> : null}
                {row.restPool ? (
                  <p className="note mt-1">Rest pool · day 0 {row.restDay0} · due {row.restDue}</p>
                ) : null}
                <p className="note mt-2 font-mono">
                  {row.parallel || row.status}
                  {row.service ? ` · Service ${row.service}` : ""} · IR{" "}
                  <IrFigure value={row.avg} provisional={row.provisional} unit /> · spread{" "}
                  <IrFigure value={row.spread} provisional={row.provisional} unit /> · floor{" "}
                  {row.floor == null ? "—" : `${row.floor} mV`}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <Panel accent="floor" eyebrow="7-day rest" title="Rest tests">
        <p className="note mb-3">
          Day-0 baselines are recorded. Each test shows its result once the 7-day reading is in. C1-P3 has
          no rest test.
        </p>
        <ul className="space-y-2 text-sm">
          {allRestTests().map((test) => (
            <li key={`${test.id}-${test.uid}`}>
              <span className="font-mono">{test.label}</span> cell {test.cell} · started {test.start} ·
              day-0 {test.readingDate || test.start} · 7-day due {test.due} ·{" "}
              {test.result === "unread" ? "not read yet" : `read ${test.readDate} · ${test.result}`}
            </li>
          ))}
        </ul>
      </Panel>

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
            provisional: row.provisional,
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
            incomplete. On these fleet charts a solid line runs through a night with no reading. No
            value is filled in, and there is no dotted join or hollow ring. Nights before the series
            existed are not marked. A single reading is a dot. A partial night with a reading is
            still a normal point. A pack that changed labels stays on the series it was measured in.
            The line is not joined across a move, and nights after the move are not marked.
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
                unit={IR_UNIT}
                mode="aggregate"
                ariaLabel={`${fleet.id} pack average internal resistance, true milliohms`}
              />
            </Panel>
          ))}
          {measured.map((fleet) => (
            <Panel
              key={`${fleet.id}-spread`}
              heading="h3"
              accent="rulea"
              eyebrow={`Rules v5 · ${fleet.id}`}
              title="Intra-pack spread"
              action={
                <span className="note">
                  Go under {formatValue("ir", thresholds.spread_mohm.caution_gte)} · Watch note ≥{" "}
                  {formatValue("ir", thresholds.spread_mohm.caution_gte)} · Watch note, look first ≥{" "}
                  {formatValue("ir", thresholds.spread_mohm.individual_gte)} {IR_UNIT}
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
                format="ir"
                unit={IR_UNIT}
                mode="aggregate"
                ariaLabel={`${fleet.id} intra-pack IR spread in milliohms, with watch-note guides`}
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
                mode="aggregate"
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
              <span className="note">Go ≤ {thresholds.inter_pack_rest_delta_v.go_lte.toFixed(2)} V</span>
            }
          >
            <p className="note mb-3">
              One line per series. The line is solid through a night that series did not run. No
              value is filled in there. Nights before that series existed are not marked.               Rule B needs two packs charged together on that night's board. A night the series did
              run, but not as a board, is not a point. A recorded board night uses that night's
              recorded figure. A next-night outlook is not drawn here. On 2026-10-10 the points are
              C1 0.135 V and C2 0.479 V. On 2026-10-11 they are C1 0.186 V and C2 0.230 V. C3 and C4
              have no board night yet, so they are not on this chart. The rest-test day-0 rows are
              not a parallel charge and are not on this line. Series D, pack D-1, is charged on its
              own, so Rule B does not apply and it is not a line here. Series do not share a board.
            </p>
            <LineChart
              categories={model.categories}
              series={model.fleets
                .filter((fleet) => fleet.rest.some((value) => value != null))
                .map((fleet) => ({
                  id: fleet.id,
                  label: fleet.id,
                  color: seriesColor(fleet.id),
                  values: fleet.rest,
                  na: fleet.restNa,
                  service: fleet.restService,
                  unpublished: fleet.unpublished,
                }))}
              guides={ruleBGuides}
              bands={ruleBBands}
              yDomain={model.restDomain}
              format="volt"
              unit="V"
              mode="aggregate"
              ariaLabel="Inter-pack rest voltage delta by series with Rule B guides"
            />
            <ul className="note mt-3 space-y-1">
              {model.fleets
                .filter((fleet) => fleet.id !== "C3" && fleet.id !== "C4")
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
            mode="aggregate"
            domain={model.irDomain}
              packs={measured.flatMap((fleet) =>
              fleet.packs.map((pack) => ({
                id: pack.id,
                tone: pack.tone,
                cells: pack.cells,
                service: pack.service,
                logged: pack.logged,
                rest: pack.rest,
                unpublished: pack.unpublished,
                provisional: pack.provisional,
              })),
            )}
          />
        </Panel>
      </section>
    </div>
  );
}
