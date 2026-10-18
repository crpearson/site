import type { ChartSeries } from "@/lib/types";

export type MissBridge = {
  from: number;
  to: number;
  nights: string[];
};

export type GapKind = "value" | "skip" | "na" | "out" | "rest" | "nolog";

/** Pack charts mark skips. Aggregate charts draw a solid line through them. */
export type ChartMode = "aggregate" | "pack";

export const SKIP_LEGEND = "dotted = not charged";

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
  // A recorded value is always a point. Span, label, and publish state do not hide it.
  if (series.values[index] != null) return "value";
  if (series.rest?.[index]) return "rest";
  if (spanAt(series, index) == null) return "out";
  if (series.na?.[index]) return "na";
  if (series.nolog?.[index]) return "nolog";
  if (series.logged) {
    if (!series.logged[index]) return "skip";
    return "out";
  }
  return "skip";
}

export function seriesNotCharged(series: ChartSeries, index: number): boolean {
  return gapKind(series, index) === "skip";
}

export function seriesChargedNoLog(series: ChartSeries, index: number): boolean {
  return gapKind(series, index) === "nolog";
}

export function seriesNa(series: ChartSeries, index: number): boolean {
  return gapKind(series, index) === "na";
}

export function seriesRest(series: ChartSeries, index: number): boolean {
  return gapKind(series, index) === "rest";
}

/**
 * A date tick stays when a plotted line has a value, a real skip, N/A, or a
 * rest-pool mark. It is hidden when every line is unpublished, and when
 * nothing is plotted (a rest-baseline column, or a night outside every line).
 * A rest-baseline night stays hidden unless a line actually has a value there.
 */
export function axisNightVisible(series: ChartSeries[], index: number, nightId?: string): boolean {
  if (series.length === 0) return true;
  const plotted = series.some((item) => {
    const kind = gapKind(item, index);
    if (item.unpublished?.[index]) return kind === "value" || kind === "skip" || kind === "na" || kind === "nolog";
    return kind === "value" || kind === "skip" || kind === "na" || kind === "rest" || kind === "nolog";
  });
  if (!plotted) return false;
  if (nightId?.endsWith("-restday0") || nightId?.endsWith("-charge")) {
    return series.some((item) => gapKind(item, index) === "value");
  }
  return true;
}

function isReading(series: ChartSeries, index: number): boolean {
  return series.values[index] != null && gapKind(series, index) === "value";
}

export function readingIndices(series: ChartSeries): number[] {
  const indices: number[] = [];
  series.values.forEach((_, index) => {
    if (isReading(series, index)) indices.push(index);
  });
  return indices;
}

/**
 * A night between two readings where the pack was not charged, or the metric is N/A.
 * Charge is a pack fact (the logged mask), shared by every cell. A cell with no
 * number on a night the pack was charged is a hole in that cell, and the join
 * stays solid so the six cells match.
 */
function unchargedBetween(series: ChartSeries, from: number, to: number): boolean {
  for (let cursor = from + 1; cursor < to; cursor += 1) {
    if (series.logged?.[cursor]) continue;
    const kind = gapKind(series, cursor);
    if (kind === "skip" || kind === "na" || kind === "rest") return true;
  }
  return false;
}

export type LineSegment = {
  from: number;
  to: number;
  style: "solid" | "dotted";
};

/**
 * One segment between each successive recorded reading. Pack charts dot that
 * segment when a night between the readings was not charged. Aggregate charts
 * stay solid through those nights. Empty nights are not given a value.
 * A move, a rest-test column, or an unpublished night does not break the line.
 */
export function lineSegments(series: ChartSeries, mode: ChartMode = "pack"): LineSegment[] {
  const readings = readingIndices(series);
  const segments: LineSegment[] = [];
  for (let index = 1; index < readings.length; index += 1) {
    const from = readings[index - 1];
    const to = readings[index];
    const dotted = mode === "pack" && unchargedBetween(series, from, to);
    segments.push({ from, to, style: dotted ? "dotted" : "solid" });
  }
  return segments;
}

/** The earlier reading this point joins with a solid stroke, or -1 when that join is dotted. */
export function solidFrom(series: ChartSeries, index: number, mode: ChartMode = "pack"): number {
  const segment = lineSegments(series, mode).find((item) => item.to === index && item.style === "solid");
  return segment ? segment.from : -1;
}

/** A night with no value because the pack was not charged, or the metric does not apply. */
export function seriesGap(series: ChartSeries, index: number): boolean {
  const kind = gapKind(series, index);
  return kind === "skip" || kind === "na";
}

/** Dotted joins on a pack chart. Aggregate charts have none; their stroke stays solid. */
export function missBridges(series: ChartSeries, nightIds: string[], mode: ChartMode = "pack"): MissBridge[] {
  if (mode === "aggregate") return [];
  return lineSegments(series, mode)
    .filter((segment) => segment.style === "dotted")
    .map((segment) => ({
      from: segment.from,
      to: segment.to,
      nights: nightIds.slice(segment.from + 1, segment.to),
    }));
}

export function hasMissBridge(series: ChartSeries[], nightIds: string[], mode: ChartMode = "pack"): boolean {
  return series.some((item) => missBridges(item, nightIds, mode).length > 0);
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
  const noLog = new Set<string>();
  for (const item of series) {
    if (gapKind(item, index) === "rest") resting.add(nightIds[index]);
    if (gapKind(item, index) === "nolog") noLog.add(nightIds[index]);
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
  const noLogOrdered = nightIds.filter((night) => noLog.has(night) && !chartHasValue(series, nightIds.indexOf(night)));
  if (restOrdered.length) parts.push(`Rest pool: ${restOrdered.join(", ")}`);
  if (skipOrdered.length) parts.push(`Not charged: ${skipOrdered.join(", ")}`);
  if (noLogOrdered.length) parts.push(`Charged, no log: ${noLogOrdered.join(", ")}`);
  if (naOrdered.length) parts.push(`N/A: ${naOrdered.join(", ")}`);
  return parts.join(". ");
}

export function allNotCharged(series: ChartSeries[], nightIds: string[]): string[] {
  return nightIds.filter((night, index) => {
    if (chartHasValue(series, index)) return false;
    return series.some((item) => seriesNotCharged(item, index));
  });
}

export function allChargedNoLog(series: ChartSeries[], nightIds: string[]): string[] {
  return nightIds.filter((night, index) => {
    if (chartHasValue(series, index)) return false;
    return series.some((item) => seriesChargedNoLog(item, index));
  });
}

export function allNa(series: ChartSeries[], nightIds: string[]): string[] {
  return nightIds.filter((_, index) => {
    if (chartHasValue(series, index)) return false;
    return series.some((item) => seriesNa(item, index));
  });
}

/**
 * Hollow edge rings are not drawn. A skipped night before the first reading
 * or after the last has no marker. The line only exists between real readings.
 */
export function openEndIndices(series: ChartSeries, mode: ChartMode = "pack"): number[] {
  void series;
  void mode;
  return [];
}

/**
 * Rings that sit between two real readings of the same span. A leading ring
 * has no earlier reading. A trailing ring has no later reading. Anything else
 * is an interior gap and must not be a ring.
 */
export function interiorRingIndices(series: ChartSeries, mode: ChartMode = "pack"): number[] {
  return openEndIndices(series, mode).filter((index) => {
    const span = spanAt(series, index);
    if (span == null) return false;
    let earlier = false;
    let later = false;
    series.values.forEach((_, cursor) => {
      if (cursor === index || spanAt(series, cursor) !== span || !isReading(series, cursor)) return;
      if (cursor < index) earlier = true;
      if (cursor > index) later = true;
    });
    return earlier && later;
  });
}

/**
 * The only lone marker is a series with exactly one recorded reading: a pack's
 * first point, before it has a second reading to join.
 */
export function lonePointIndices(series: ChartSeries, mode: ChartMode = "pack"): number[] {
  void mode;
  const readings = readingIndices(series);
  return readings.length === 1 ? readings : [];
}

export function hasOpenEnd(series: ChartSeries[], mode: ChartMode = "pack"): boolean {
  return series.some((item) => openEndIndices(item, mode).length > 0);
}

export function legendNote(series: ChartSeries[], nightIds: string[], mode: ChartMode = "pack"): string | null {
  const usesNa = series.some((item) => item.values.some((_, index) => seriesNa(item, index)));
  if (mode === "aggregate") return usesNa ? "N/A = ran, metric does not apply" : null;
  if (!hasMissBridge(series, nightIds, mode) && !hasOpenEnd(series, mode)) return null;
  return usesNa ? `${SKIP_LEGEND} · N/A = ran, metric does not apply` : SKIP_LEGEND;
}
