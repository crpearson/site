"use client";

import { useEffect, useState } from "react";
import { planRuns } from "@/lib/plan-runs.mjs";
import type { PlanRow, PlanRules } from "@/lib/plan-runs.mjs";
import { FileCount, RunSheet } from "@/components/RunSheet";

export function ChargePlanner({
  rows,
  rules,
  series,
}: {
  rows: PlanRow[];
  rules: PlanRules;
  series: string[];
}) {
  const [flown, setFlown] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const plan = planRuns(rows, rules, flown);
  const selected = flown.length > 0;

  useEffect(() => {
    setReady(true);
  }, []);

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
          <RunSheet plan={plan} />
        </div>
      ) : (
        <p className="note">No series ticked. Set A, set B, and all four are listed below.</p>
      )}
    </section>
  );
}
