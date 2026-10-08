"use client";

import { formatAxis, formatValue } from "@/lib/format";
import type { Band, Category, ChartSeries, Guide, ValueFormat } from "@/lib/types";
import { useId, useMemo, useState } from "react";

function niceStep(span: number, count: number): number {
  const raw = span / Math.max(1, count);
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  const nice = n >= 7.5 ? 10 : n >= 3 ? 5 : n >= 1.5 ? 2 : 1;
  return nice * pow;
}

function axisTicks(domain: [number, number]): number[] {
  const [min, max] = domain;
  const step = niceStep(max - min, 4);
  const start = Math.ceil((min - step * 1e-6) / step) * step;
  const ticks: number[] = [];
  for (let i = 0; i < 8; i += 1) {
    const value = start + i * step;
    if (value > max + step * 1e-6) break;
    if (value >= min - step * 1e-6) ticks.push(Number(value.toPrecision(10)));
  }
  return ticks.length >= 2 ? ticks : [min, max];
}

function yPos(value: number, domain: [number, number]): number {
  const span = domain[1] - domain[0] || 1;
  return ((domain[1] - value) / span) * 100;
}

function linePaths(
  values: (number | null)[],
  domain: [number, number],
): string[] {
  const paths: string[] = [];
  let current = "";
  values.forEach((value, index) => {
    if (value == null) {
      if (current) paths.push(current);
      current = "";
      return;
    }
    const x = (index + 0.5).toFixed(3);
    const y = yPos(value, domain).toFixed(3);
    current += current ? `L${x} ${y}` : `M${x} ${y}`;
  });
  if (current) paths.push(current);
  return paths;
}

export function LineChart({
  categories,
  series,
  guides = [],
  bands = [],
  yDomain,
  format,
  unit,
  height = 228,
  ariaLabel,
}: {
  categories: Category[];
  series: ChartSeries[];
  guides?: Guide[];
  bands?: Band[];
  yDomain: [number, number];
  format: ValueFormat;
  unit: string;
  height?: number;
  ariaLabel: string;
}) {
  const descId = useId();
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [hover, setHover] = useState<number | null>(null);
  const shown = series.filter((item) => !hidden[item.id]);
  const ticks = useMemo(() => axisTicks(yDomain), [yDomain]);
  const n = categories.length;

  const live =
    hover == null
      ? ""
      : `${categories[hover].label}${categories[hover].partial ? ", partial night" : ""}. ${shown
          .map((item) => {
            const value = item.values[hover];
            return `${item.label} ${value == null ? "not measured" : `${formatValue(format, value)} ${unit}`}`;
          })
          .join(". ")}`;

  return (
    <div className="chart">
      <div className="legend" role="group" aria-label="Series">
        {series.map((item) => {
          const on = !hidden[item.id];
          const latest = [...item.values].reverse().find((value) => value != null);
          return (
            <button
              key={item.id}
              type="button"
              className={on ? "legend-btn" : "legend-btn is-off"}
              aria-pressed={on}
              onClick={() =>
                setHidden((current) => ({ ...current, [item.id]: !current[item.id] }))
              }
            >
              <span className="swatch" style={{ background: item.color }} aria-hidden="true" />
              <span>{item.label}</span>
              <span className="font-mono text-[var(--muted)]">
                {latest == null ? "—" : formatValue(format, latest)}
              </span>
            </button>
          );
        })}
      </div>
      <p id={descId} className="sr-only">
        {ariaLabel} Arrow keys move between sessions. Gaps are nights that pack or fleet was not measured.
      </p>
      <div className="sr-only" aria-live="polite">
        {live}
      </div>
      <div className="chart-body">
        <div className="y-axis" style={{ height }}>
          {ticks.map((tick) => (
            <span
              key={tick}
              className="y-tick"
              style={{ top: `${yPos(tick, yDomain)}%` }}
            >
              {formatAxis(format, tick)}
            </span>
          ))}
        </div>
        <div>
          <div
            className="plot"
            style={{ height }}
            tabIndex={0}
            role="group"
            aria-label={ariaLabel}
            aria-describedby={descId}
            onPointerMove={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const index = Math.floor(((event.clientX - rect.left) / rect.width) * n);
              const next = Math.max(0, Math.min(n - 1, index));
              setHover((current) => (current === next ? current : next));
            }}
            onPointerLeave={() => setHover(null)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") {
                event.preventDefault();
                setHover((current) => (current == null ? 0 : Math.min(n - 1, current + 1)));
              } else if (event.key === "ArrowLeft") {
                event.preventDefault();
                setHover((current) => (current == null ? 0 : Math.max(0, current - 1)));
              } else if (event.key === "Escape") {
                setHover(null);
              }
            }}
          >
            {ticks.map((tick) => (
              <span
                key={`grid-${tick}`}
                className="grid-line"
                style={{ top: `${yPos(tick, yDomain)}%` }}
              />
            ))}
            {bands.map((band) => {
              const from = Math.max(band.from, yDomain[0]);
              const to = Math.min(band.to, yDomain[1]);
              if (to <= from) return null;
              const top = yPos(to, yDomain);
              const bottom = yPos(from, yDomain);
              return (
                <span
                  key={`${band.from}-${band.to}-${band.color}`}
                  className="band"
                  style={{ top: `${top}%`, height: `${bottom - top}%`, background: band.color }}
                />
              );
            })}
            <svg
              className="plot-svg"
              viewBox={`0 0 ${n} 100`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {shown.map((item) =>
                linePaths(item.values, yDomain).map((d, pathIndex) => (
                  <path
                    key={`${item.id}-${pathIndex}`}
                    d={d}
                    fill="none"
                    stroke={item.color}
                    strokeWidth="1.7"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                )),
              )}
            </svg>
            {guides.map((guide) =>
              guide.y < yDomain[0] || guide.y > yDomain[1] ? null : (
                <span key={guide.label} className="guide" style={{ top: `${yPos(guide.y, yDomain)}%` }}>
                  <span className="guide-line" style={{ borderColor: guide.color }} />
                  <span className="guide-label" style={{ color: guide.color }}>
                    {guide.label}
                  </span>
                </span>
              ),
            )}
            {hover != null ? (
              <span
                className="crosshair"
                style={{ left: `${((hover + 0.5) / n) * 100}%` }}
              />
            ) : null}
            {shown.map((item) =>
              item.values.map((value, index) => {
                if (value == null || hover !== index) return null;
                return (
                  <span
                    key={`${item.id}-${categories[index].id}`}
                    className="point"
                    style={{
                      left: `${((index + 0.5) / n) * 100}%`,
                      top: `${yPos(value, yDomain)}%`,
                      background: item.color,
                    }}
                  />
                );
              }),
            )}
            {hover != null ? (
              <div
                className="tip"
                style={{
                  left: `${((hover + 0.5) / n) * 100}%`,
                  transform:
                    hover > n / 2 ? "translateX(calc(-100% - 10px))" : "translateX(10px)",
                }}
              >
                <p className="tip-title">
                  {categories[hover].id}
                  {categories[hover].partial ? " · partial" : ""}
                </p>
                <ul>
                  {shown.map((item) => {
                    const value = item.values[hover];
                    return (
                      <li key={item.id}>
                        <span className="swatch" style={{ background: item.color }} />
                        <span>{item.label}</span>
                        <span className="font-mono">
                          {value == null ? "—" : `${formatValue(format, value)} ${unit}`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>
          <div className="x-axis">
            {categories.map((category, index) => (
              <span
                key={category.id}
                className={
                  category.id.startsWith("S") && index % 2 === 1
                    ? "x-label x-label-alt"
                    : "x-label"
                }
                style={{ left: `${((index + 0.5) / n) * 100}%` }}
                title={category.partial ? `${category.id} partial night` : category.id}
              >
                {category.label}
                {category.partial ? "*" : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
