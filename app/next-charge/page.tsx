import type { Metadata } from "next";
import { ChargePlanner } from "@/components/ChargePlanner";
import { FileCount, RunSheet } from "@/components/RunSheet";
import { loadNextChargeV3, planRuns } from "@/lib/next-charge.mjs";

export const metadata: Metadata = {
  title: "Next charge",
  description: "Tick the series that flew. Run order and file counts for DX8-1 and DX8-2.",
};

const STATIC_CASES = [
  { id: "set-a", title: "Set A (C1 and C2)", series: ["C1", "C2"], d1: false },
  { id: "set-a-d1", title: "Set A (C1 and C2) with D-1", series: ["C1", "C2"], d1: true },
  { id: "set-b", title: "Set B (C3 and C4)", series: ["C3", "C4"], d1: false },
  { id: "set-b-d1", title: "Set B (C3 and C4) with D-1", series: ["C3", "C4"], d1: true },
  { id: "all-four", title: "All four (C1, C2, C3 and C4)", series: ["C1", "C2", "C3", "C4"], d1: false },
  { id: "all-four-d1", title: "All four (C1, C2, C3 and C4) with D-1", series: ["C1", "C2", "C3", "C4"], d1: true },
] as const;

export default function NextChargePage() {
  const doc = loadNextChargeV3();
  const rows = doc.home_channels.map((row) => ({
    label: row.label,
    series: row.series,
    slot: row.slot,
    charger: row.charger,
    channel: row.channel,
    state: row.state,
  }));
  const rules = {
    series_order: doc.planner_rules.series_order,
    channel_start_order: doc.planner_rules.channel_start_order,
    include_states: doc.planner_rules.include_states,
  };
  const cases = STATIC_CASES.map((item) => ({
    ...item,
    plan: planRuns(doc.home_channels, doc.planner_rules, [...item.series], item.d1),
  }));

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow">Rules v6</p>
        <h1 className="h1 mt-2">Next charge</h1>
        <p className="page-intro mt-4">
          Tick every series that flew. Packs run on DX8-1 Channel 1, DX8-1 Channel 2, DX8-2 Channel 1 and DX8-2
          Channel 2, each on its home channel. Empty slots and pulled packs are skipped and nothing is reordered.
          D-1, when ticked, is last on DX8-2 Channel 1.
        </p>
      </header>
      <ChargePlanner rows={rows} rules={rules} />
      <div id="planner-static" className="space-y-8">
        <h2 className="section-title">Common run lists</h2>
        {cases.map((item) => (
          <section key={item.id} className="space-y-3" aria-labelledby={`${item.id}-heading`}>
            <h3 id={`${item.id}-heading`} className="section-title">
              {item.title}
            </h3>
            <FileCount files={item.plan.files} />
            <RunSheet plan={item.plan} />
          </section>
        ))}
      </div>
    </div>
  );
}
