import { heatGradient, heatStyle } from "@/lib/color";
import { IR_UNIT_SHORT } from "@/lib/format";
import type { ReactNode } from "react";

export function Heatmap({
  columnLabels,
  rows,
  min,
  max,
  caption,
}: {
  columnLabels: string[];
  rows: {
    key: string;
    label: ReactNode;
    values: (number | null)[];
  }[];
  min: number;
  max: number;
  caption?: string;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <span className="font-mono text-[11px] text-[var(--muted)]">
          {min} {IR_UNIT_SHORT}
        </span>
        <div
          className="h-2 flex-1 rounded-full"
          style={{ background: heatGradient() }}
          aria-hidden="true"
        />
        <span className="font-mono text-[11px] text-[var(--muted)]">
          {max} {IR_UNIT_SHORT}
        </span>
      </div>
      {caption ? (
        <p className="mb-3 text-xs leading-relaxed text-[var(--muted)]">{caption}</p>
      ) : null}
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[36rem] gap-1"
          style={{
            gridTemplateColumns: `minmax(5.5rem, 7.5rem) repeat(${columnLabels.length}, minmax(2.6rem, 1fr))`,
          }}
        >
          <span />
          {columnLabels.map((label) => (
            <span
              key={label}
              className="pb-1 text-center font-mono text-[10px] tracking-wide text-[var(--muted)] uppercase"
            >
              {label}
            </span>
          ))}
          {rows.map((row) => (
            <div key={row.key} className="contents">
              <div className="flex items-center pr-2 text-sm">{row.label}</div>
              {row.values.map((value, index) => {
                if (value == null) {
                  return (
                    <div
                      key={`${row.key}-${columnLabels[index]}`}
                      className="grid h-11 place-items-center rounded-md border border-dashed border-[var(--line)] font-mono text-[10px] text-[var(--faint)]"
                      title={`${columnLabels[index]} not charged`}
                    >
                      —
                    </div>
                  );
                }
                const style = heatStyle(value, min, max);
                return (
                  <div
                    key={`${row.key}-${columnLabels[index]}`}
                    className="grid h-11 place-items-center rounded-md font-mono text-[12px] font-medium"
                    style={style}
                    title={`${columnLabels[index]} ${value} ${IR_UNIT_SHORT}`}
                  >
                    {value}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
