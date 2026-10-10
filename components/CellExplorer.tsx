"use client";

import { LineChart } from "@/components/LineChart";
import { CELL_COLORS } from "@/lib/color";
import { IR_UNIT } from "@/lib/ir";
import type { LampTone } from "@/lib/lamp";
import type { Category } from "@/lib/types";
import { useState } from "react";

export function CellExplorer({
  categories,
  packs,
  domain,
}: {
  categories: Category[];
  packs: {
    id: string;
    tone: LampTone;
    cells: (number | null)[][];
    service?: (string | null)[];
    logged?: boolean[];
  }[];
  domain: [number, number];
}) {
  const [selected, setSelected] = useState(packs[0]?.id ?? "");
  const pack = packs.find((item) => item.id === selected) ?? packs[0];
  if (!pack) return null;

  return (
    <div>
      <div className="chip-row" role="group" aria-label="Pack for cell IR">
        {packs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === pack.id ? "chip-btn is-on" : "chip-btn"}
            aria-pressed={item.id === pack.id}
            onClick={() => setSelected(item.id)}
          >
            <span className={`mini-dot dot-${item.tone}`} aria-hidden="true" />
            {item.id}
          </button>
        ))}
      </div>
      <LineChart
        categories={categories}
        series={pack.cells.map((values, index) => ({
          id: `cell-${index + 1}`,
          label: `Cell ${index + 1}`,
          color: CELL_COLORS[index],
          values,
          service: pack.service,
          logged: pack.logged,
        }))}
        yDomain={domain}
        format="ir"
        unit={IR_UNIT}
        height={240}
        ariaLabel={`Per-cell internal resistance for ${pack.id} across measured nights, milliohms`}
      />
    </div>
  );
}
