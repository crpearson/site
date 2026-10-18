"use client";

import { useEffect, useState } from "react";
import { PLANNER_SERIES, planRuns } from "@/lib/plan-runs.mjs";
import type { PlanRow, PlanRules } from "@/lib/plan-runs.mjs";
import { FileCount, RunSheet } from "@/components/RunSheet";

export function ChargePlanner({ rows, rules }: { rows: PlanRow[]; rules: PlanRules }) {
  const [flown, setFlown] = useState<string[]>([]);
  const [dFlown, setDFlown] = useState(false);
  const [ready, setReady] = useState(false);
  const plan = planRuns(rows, rules, flown, dFlown);
  const selected = flown.length > 0 || dFlown;

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    const node = document.getElementById("planner-static");
    if (node) node.hidden = selected;
  }, [selected]);

  function toggleSeries(series: string) {
    setFlown((current) => (current.includes(series) ? current.filter((item) => item !== series) : [...current, series]));
  }

  return (
    <section className="planner" data-planner-ready={ready ? "" : undefined} aria-label="Next charge planner">
      <div className="planner-checks">
        <fieldset>
          <legend className="sr-only">Series flown</legend>
          {PLANNER_SERIES.map((series) => (
            <label key={series} className="planner-check" htmlFor={`fly-${series}`}>
              <input
                id={`fly-${series}`}
                type="checkbox"
                checked={flown.includes(series)}
                onChange={() => toggleSeries(series)}
              />
              <span>{series}</span>
            </label>
          ))}
        </fieldset>
        <fieldset className="planner-d1">
          <legend className="sr-only">D-1</legend>
          <label className="planner-check" htmlFor="fly-D-1">
            <input id="fly-D-1" type="checkbox" checked={dFlown} onChange={() => setDFlown((current) => !current)} />
            <span>D-1</span>
          </label>
        </fieldset>
      </div>
      <FileCount files={plan.files} live />
      {selected ? (
        <div className="planner-live">
          <RunSheet plan={plan} />
        </div>
      ) : (
        <p className="note">No series ticked. Set A, set B, and all four are listed below, each with and without D-1.</p>
      )}
    </section>
  );
}
