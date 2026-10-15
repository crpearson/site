"use client";

import { useState, type ReactNode } from "react";

export function SetSwitcher({
  activeLabel,
  alternateLabel,
  active,
  alternate,
}: {
  activeLabel: string;
  alternateLabel: string;
  active: ReactNode;
  alternate: ReactNode;
}) {
  const [which, setWhich] = useState<"active" | "alternate">("active");
  return (
    <div className="space-y-4">
      <div className="chip-row" role="group" aria-label="Charge set">
        <button
          type="button"
          className={which === "active" ? "chip-btn is-on" : "chip-btn"}
          aria-pressed={which === "active"}
          data-set-toggle="active"
          onClick={() => setWhich("active")}
        >
          Tonight · {activeLabel}
        </button>
        <button
          type="button"
          className={which === "alternate" ? "chip-btn is-on" : "chip-btn"}
          aria-pressed={which === "alternate"}
          data-set-toggle="alternate"
          onClick={() => setWhich("alternate")}
        >
          Other night · {alternateLabel}
        </button>
      </div>
      <div data-set-panel="active" hidden={which !== "active"}>
        {active}
      </div>
      <div data-set-panel="alternate" hidden={which !== "alternate"}>
        {alternate}
      </div>
    </div>
  );
}
