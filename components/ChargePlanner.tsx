"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { planRuns } from "@/lib/plan-runs.mjs";
import type { PlanRow, PlanRules } from "@/lib/plan-runs.mjs";
import { FileCount, RunSheet } from "@/components/RunSheet";

const subscribeToHydration = () => () => {};
const hydratedOnClient = () => true;
const notHydratedOnServer = () => false;

export function ChargePlanner({
  rows,
  rules,
  series,
  serialByLabel,
}: {
  rows: PlanRow[];
  rules: PlanRules;
  series: string[];
  serialByLabel: Record<string, string>;
}) {
  const [flown, setFlown] = useState<string[]>([]);
  const ready = useSyncExternalStore(subscribeToHydration, hydratedOnClient, notHydratedOnServer);
  const plan = planRuns(rows, rules, flown);
  const selected = flown.length > 0;

  useEffect(() => {
    const node = document.getElementById("planner-static");
    if (node) node.hidden = selected;
  }, [selected]);

  function toggleSeries(id: string) {
    setFlown((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <section className="planner" data-planner-ready={ready ? "" : undefined} aria-label="Next charge planner">
      <div className="planner-checks">
        <fieldset>
          <legend className="sr-only">Series flown</legend>
          {series.map((id) => (
            <label key={id} className="planner-check" htmlFor={`fly-${id}`}>
              <input id={`fly-${id}`} type="checkbox" checked={flown.includes(id)} onChange={() => toggleSeries(id)} />
              <span>{id}</span>
            </label>
          ))}
        </fieldset>
      </div>
      <FileCount files={plan.files} live />
      {selected ? (
        <div className="planner-live">
          <RunSheet plan={plan} serialByLabel={serialByLabel} />
        </div>
      ) : (
        <p className="note">No series ticked. Set A, set B, and all four are listed below.</p>
      )}
    </section>
  );
}
