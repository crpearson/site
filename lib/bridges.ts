import type { ChartSeries } from "@/lib/types";

export type MissBridge = {
  from: number;
  to: number;
  nights: string[];
};

function rowExists(series: ChartSeries, index: number): boolean {
  if (series.logged) return series.logged[index];
  return series.values[index] != null;
}

/** Dotted joins between real points in one service span. Open ends and span changes stay open. */
export function missBridges(
  series: ChartSeries,
  nightIds: string[],
): MissBridge[] {
  const service = series.service;
  if (!service) return [];
  const bridges: MissBridge[] = [];
  let prev = -1;
  for (let index = 0; index < series.values.length; index += 1) {
    if (series.values[index] == null) continue;
    if (prev >= 0 && index > prev + 1) {
      const span = service[prev];
      const between: number[] = [];
      for (let cursor = prev + 1; cursor < index; cursor += 1) between.push(cursor);
      const sameSpan =
        span != null &&
        service[index] === span &&
        between.every((cursor) => service[cursor] === span && !rowExists(series, cursor));
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

/** Nights to name when the pointer is on a not-charged column. */
export function notChargedPhrase(
  series: ChartSeries[],
  nightIds: string[],
  index: number,
): string {
  const ids = new Set<string>();
  for (const item of series) {
    if (!item.service || item.service[index] == null || rowExists(item, index)) continue;
    const bridge = missBridges(item, nightIds).find(
      (itemBridge) => index > itemBridge.from && index < itemBridge.to,
    );
    if (bridge) bridge.nights.forEach((night) => ids.add(night));
    else ids.add(nightIds[index]);
  }
  const ordered = nightIds.filter((night) => ids.has(night));
  return ordered.length ? `Not charged: ${ordered.join(", ")}` : "";
}

export function allNotCharged(series: ChartSeries[], nightIds: string[]): string[] {
  const ids = new Set<string>();
  for (const item of series) {
    if (!item.service) continue;
    item.values.forEach((_, index) => {
      if (!rowExists(item, index) && item.service?.[index] != null) ids.add(nightIds[index]);
    });
  }
  return nightIds.filter((night) => ids.has(night));
}

export function seriesNotCharged(series: ChartSeries, index: number): boolean {
  return Boolean(series.service && series.service[index] != null && !rowExists(series, index));
}
