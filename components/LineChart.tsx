"use client";

import {
  allNa,
  allNotCharged,
  gapPhrase,
  legendNote,
  missBridges,
  openEndIndices,
  seriesGap,
  seriesNa,
  seriesNotCharged,
} from "@/lib/bridges";
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

function linePaths(values: (number | null)[], domain: [number, number]): string[] {
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

function bridgePath(series: ChartSeries, domain: [number, number], nightIds: string[]): string[] {
  return missBridges(series, nightIds).map((bridge) => {
    const from = series.values[bridge.from];
    const to = series.values[bridge.to];
    if (from == null || to == null) return "";
    const x1 = (bridge.from + 0.5).toFixed(3);
    const y1 = yPos(from, domain).toFixed(3);
    const x2 = (bridge.to + 0.5).toFixed(3);
    const y2 = yPos(to, domain).toFixed(3);
    return `M${x1} ${y1} L${x2} ${y2}`;
  });
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
  const nightIds = categories.map((category) => category.id);
  const note = legendNote(shown, nightIds);
  const missed = allNotCharged(shown, nightIds);
  const naNights = allNa(shown, nightIds);
  const phrase = hover == null ? "" : gapPhrase(shown, nightIds, hover);
  const columnGap =
    hover != null && shown.length > 0 && shown.every((item) => seriesGap(item, hover));
  const endMarks = shown.flatMap((item) =>
    openEndIndices(item).map((index) => ({ id: item.id, color: item.color, index })),
  );

  const live =
    hover == null
      ? ""
      : columnGap
        ? `${categories[hover].id}. ${phrase}.`
        : `${categories[hover].label}${categories[hover].partial ? ", partial night" : ""}. ${
            phrase ? `${phrase}. ` : ""
          }${shown
            .map((item) => {
              const value = item.values[hover];
              if (value != null && !seriesGap(item, hover)) {
                return `${item.label} ${formatValue(format, value)} ${unit}`;
              }
              if (seriesNotCharged(item, hover)) return `${item.label} not charged`;
              if (seriesNa(item, hover)) return `${item.label} N/A`;
              return `${item.label} no value`;
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
        {note ? <p className="legend-note">{note}</p> : null}
      </div>
      <p id={descId} className="sr-only">
        {ariaLabel} Arrow keys and the night labels move between nights. A faint dotted line joins
        the real readings on either side of a skipped night. No value is plotted there. A skipped
        night before the first reading or after the last is a small hollow ring on the bottom edge,
        also with no value. Nights before the pack was commissioned, and nights after it moved
        slots, are not marked. A star on the night label is a partial night and is separate: a pack
        that was charged still has a point.
        {missed.length ? ` Not charged: ${missed.join(", ")}.` : ""}
        {naNights.length ? ` N/A: ${naNights.join(", ")}.` : ""}
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
                bridgePath(item, yDomain, nightIds).map((d, pathIndex) => (
                  <path
                    key={`${item.id}-bridge-${pathIndex}`}
                    d={d}
                    fill="none"
                    stroke={item.color}
                    strokeOpacity={0.4}
                    strokeWidth="1.7"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    strokeDasharray="1.2 3.2"
                    pathLength="28"
                    vectorEffect="non-scaling-stroke"
                  />
                )),
              )}
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
            {endMarks.length
              ? categories.map((_, index) => {
                  const marks = endMarks.filter((mark) => mark.index === index);
                  if (marks.length === 0) return null;
                  return marks.map((mark, slot) => {
                    const span = marks.length === 1 ? 0 : Math.min(0.62, marks.length * 0.1);
                    const start = 0.5 - span / 2;
                    const t = marks.length === 1 ? 0.5 : start + (span * slot) / (marks.length - 1);
                    return (
                      <span
                        key={`${mark.id}-${categories[index].id}`}
                        className="miss-ring"
                        style={{
                          left: `${((index + t) / n) * 100}%`,
                          borderColor: mark.color,
                        }}
                      />
                    );
                  });
                })
              : null}
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
                role="tooltip"
                style={{
                  left: `${((hover + 0.5) / n) * 100}%`,
                  transform:
                    hover > n / 2 ? "translateX(calc(-100% - 10px))" : "translateX(10px)",
                }}
              >
                <p className="tip-title">
                  {categories[hover].id}
                  {!columnGap && categories[hover].partial ? " · partial" : ""}
                </p>
                {phrase ? <p className="tip-miss">{phrase}</p> : null}
                {columnGap ? null : (
                  <ul>
                    {shown.map((item) => {
                      const value = item.values[hover];
                      const missedNight = seriesNotCharged(item, hover);
                      const naNight = seriesNa(item, hover);
                      return (
                        <li key={item.id}>
                          <span className="swatch" style={{ background: item.color }} />
                          <span>{item.label}</span>
                          <span className="font-mono">
                            {value != null && !missedNight && !naNight
                              ? `${formatValue(format, value)} ${unit}`
                              : missedNight
                                ? "not charged"
                                : naNight
                                  ? "N/A"
                                  : "—"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
          <div className="x-axis">
            {categories.map((category, index) => {
              const last = n - 1;
              const hideOnSmall =
                index !== last &&
                (index % 2 === 1 || (index === last - 1 && last % 2 === 1));
              const columnPhrase = gapPhrase(shown, nightIds, index);
              const columnMissed =
                shown.length > 0 && shown.every((item) => seriesGap(item, index));
              const title = columnMissed
                ? columnPhrase
                : [category.partial ? `${category.id} partial night` : category.id, columnPhrase]
                    .filter(Boolean)
                    .join(". ");
              return (
                <button
                  key={category.id}
                  type="button"
                  className={hideOnSmall ? "x-label x-label-alt" : "x-label"}
                  style={{ left: `${((index + 0.5) / n) * 100}%` }}
                  title={title}
                  aria-label={title}
                  onFocus={() => setHover(index)}
                  onClick={() => setHover(index)}
                  onBlur={() => setHover((current) => (current === index ? null : current))}
                >
                  {category.label}
                  {category.partial ? "*" : ""}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
