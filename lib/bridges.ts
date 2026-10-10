import type { ChartSeries } from "@/lib/types";

export type MissBridge = {
  from: number;
  to: number;
  nights: string[];
};

export type GapKind = "value" | "skip" | "na" | "out" | "rest";

export const SKIP_LEGEND = "dotted = not charged · ○ = not charged (start/end)";

/** Span while the line is in scope. Omitted service means the whole axis is in scope. */
export function spanAt(series: ChartSeries, index: number): string | null {
  if (!series.service) return "0";
  return series.service[index] ?? null;
}

/**
 * Why a night has no point. "skip" is not charged. "na" means the line ran but
 * the metric does not apply. "out" is before commission, after retirement, or
 * a logged night whose metric is empty and is not a skip.
 */
export function gapKind(series: ChartSeries, index: number): GapKind {
  if (series.rest?.[index] && series.values[index] == null) return "rest";
  if (spanAt(series, index) == null) return "out";
  if (series.na?.[index]) return "na";
  if (series.logged) {
    if (!series.logged[index]) return "skip";
    return series.values[index] != null ? "value" : "out";
  }
  return series.values[index] != null ? "value" : "skip";
}

export function seriesNotCharged(series: ChartSeries, index: number): boolean {
  return gapKind(series, index) === "skip";
}

export function seriesNa(series: ChartSeries, index: number): boolean {
  return gapKind(series, index) === "na";
}

export function seriesRest(series: ChartSeries, index: number): boolean {
  return gapKind(series, index) === "rest";
}

/** A night drawn as a dotted join or a hollow ring, with no value. */
export function seriesGap(series: ChartSeries, index: number): boolean {
  const kind = gapKind(series, index);
  return kind === "skip" || kind === "na";
}

/** Dotted joins between real points in one service span. Open ends and span changes stay open. */
export function missBridges(series: ChartSeries, nightIds: string[]): MissBridge[] {
  const bridges: MissBridge[] = [];
  let prev = -1;
  for (let index = 0; index < series.values.length; index += 1) {
    if (series.values[index] == null || gapKind(series, index) !== "value") continue;
    if (prev >= 0 && index > prev + 1) {
      const span = spanAt(series, prev);
      const between: number[] = [];
      for (let cursor = prev + 1; cursor < index; cursor += 1) between.push(cursor);
      const sameSpan =
        span != null &&
        spanAt(series, index) === span &&
        between.every((cursor) => spanAt(series, cursor) === span && seriesGap(series, cursor));
      if (sameSpan) {
        bridges.push({
          from: prev,
          to: index,
          nights: between.map((cursor) => nightIds[cursor]),
        });
      }
    }
    prev = index;
  }
  return bridges;
}

export function hasMissBridge(series: ChartSeries[], nightIds: string[]): boolean {
  return series.some((item) => missBridges(item, nightIds).length > 0);
}

function nightsForGap(series: ChartSeries, nightIds: string[], index: number): string[] {
  const bridge = missBridges(series, nightIds).find(
    (item) => index > item.from && index < item.to,
  );
  return bridge ? bridge.nights : [nightIds[index]];
}

/** A night still has a plotted point on this chart. */
function chartHasValue(series: ChartSeries[], index: number): boolean {
  return series.some((item) => gapKind(item, index) === "value");
}

/** Tooltip text for skipped nights under the pointer. */
export function gapPhrase(series: ChartSeries[], nightIds: string[], index: number): string {
  const skipped = new Set<string>();
  const na = new Set<string>();
  const resting = new Set<string>();
  for (const item of series) {
    if (gapKind(item, index) === "rest") resting.add(nightIds[index]);
    if (!seriesGap(item, index)) continue;
    for (const night of nightsForGap(item, nightIds, index)) {
      const nightIndex = nightIds.indexOf(night);
      if (nightIndex < 0 || chartHasValue(series, nightIndex)) continue;
      if (gapKind(item, nightIndex) === "na") na.add(night);
      else if (gapKind(item, nightIndex) === "skip") skipped.add(night);
    }
  }
  const parts: string[] = [];
  const skipOrdered = nightIds.filter((night) => skipped.has(night));
  const naOrdered = nightIds.filter((night) => na.has(night));
  const restOrdered = nightIds.filter((night) => resting.has(night));
  if (restOrdered.length) parts.push(`Rest pool: ${restOrdered.join(", ")}`);
  if (skipOrdered.length) parts.push(`Not charged: ${skipOrdered.join(", ")}`);
  if (naOrdered.length) parts.push(`N/A: ${naOrdered.join(", ")}`);
  return parts.join(". ");
}

export function allNotCharged(series: ChartSeries[], nightIds: string[]): string[] {
  return nightIds.filter((night, index) => {
    if (chartHasValue(series, index)) return false;
    return series.some((item) => seriesNotCharged(item, index));
  });
}

export function allNa(series: ChartSeries[], nightIds: string[]): string[] {
  return nightIds.filter((_, index) => {
    if (chartHasValue(series, index)) return false;
    return series.some((item) => seriesNa(item, index));
  });
}

/**
 * The span a line is first in service. Omitted service means the whole axis
 * is span "0". A later span is a move, and those nights are not ringed.
 */
function firstSpan(series: ChartSeries): string | null {
  if (!series.service) return "0";
  return series.service.find((span) => span != null) ?? null;
}

/**
 * In-service misses before the first reading or after the last, inside the
 * line's first service span. Nights with no span are before commission, after
 * retirement, or before this series existed. Nights in a later span are after
 * a move and are not marked.
 */
export function openEndIndices(series: ChartSeries): number[] {
  const allowed = firstSpan(series);
  if (allowed == null) return [];
  const nightIds = series.values.map((_, index) => String(index));
  const interior = new Set<number>();
  for (const bridge of missBridges(series, nightIds)) {
    for (let cursor = bridge.from + 1; cursor < bridge.to; cursor += 1) interior.add(cursor);
  }
  const ends: number[] = [];
  series.values.forEach((_, index) => {
    if (spanAt(series, index) !== allowed) return;
    if (!seriesGap(series, index) || interior.has(index)) return;
    ends.push(index);
  });
  return ends;
}

/**
 * A real reading whose solid path is only a moveto, and which is not an end of
 * a dotted join. A one-point line has no stroke, so the chart draws a dot.
 */
export function lonePointIndices(series: ChartSeries): number[] {
  const nightIds = series.values.map((_, index) => String(index));
  const bridged = new Set<number>();
  for (const bridge of missBridges(series, nightIds)) {
    bridged.add(bridge.from);
    bridged.add(bridge.to);
  }
  const lone: number[] = [];
  let run: number[] = [];
  const flush = () => {
    if (run.length === 1 && !bridged.has(run[0])) lone.push(run[0]);
    run = [];
  };
  series.values.forEach((value, index) => {
    if (value == null || gapKind(series, index) !== "value") {
      flush();
      return;
    }
    run.push(index);
  });
  flush();
  return lone;
}

export function hasOpenEnd(series: ChartSeries[]): boolean {
  return series.some((item) => openEndIndices(item).length > 0);
}

export function legendNote(series: ChartSeries[], nightIds: string[]): string | null {
  if (!hasMissBridge(series, nightIds) && !hasOpenEnd(series)) return null;
  const usesNa = series.some((item) => item.values.some((_, index) => seriesNa(item, index)));
  return usesNa ? `${SKIP_LEGEND} · N/A = ran, metric does not apply` : SKIP_LEGEND;
}
