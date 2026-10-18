import type { ValueFormat } from "@/lib/types";

/** Milliohms with a third decimal when it is not zero, so 2.875 stays 2.875 and 0.65 stays 0.65. */
export function formatIr(n: number): string {
  const thousandths = n.toFixed(3);
  if (thousandths.endsWith("00")) return n.toFixed(1);
  if (thousandths.endsWith("0")) return n.toFixed(2);
  return thousandths;
}

export function formatValue(kind: ValueFormat, n: number): string {
  if (kind === "volt") return n.toFixed(3);
  if (kind === "ir") return formatIr(n);
  return Math.round(n).toString();
}

export function formatAxis(kind: ValueFormat, n: number): string {
  if (kind === "volt") return n.toFixed(2);
  if (kind === "ir") return n.toFixed(2);
  return Math.round(n).toString();
}

export function usd(n: number): string {
  return `$${n.toFixed(2)}`;
}

/** Volts with trailing zeros trimmed, keeping at least two decimals. */
export function volts(n: number): string {
  const fixed = n.toFixed(3);
  return fixed.endsWith("0") ? n.toFixed(2) : fixed;
}

/** Internal night id from the log catalog, such as S263. Not a calendar date. */
export function isSessionId(id: string): boolean {
  return /^S\d+$/.test(id.trim());
}

/**
 * One night, for a label. A session id is not a date. None of these ids carry
 * a calendar date in the record, so the public label is "undated".
 */
export function publicSession(id: string): string {
  if (isSessionId(id)) return "undated";
  return id;
}

/**
 * A span that was stored with a session id as its start. Drop that start.
 * "until {end}" when the end is a real date. "since earliest records" when
 * there is no end date. Never invent a date.
 */
export function occupancyLabel(start: string, end: string | null): string {
  const startDate = isSessionId(start) ? null : start;
  const endIsId = end != null && isSessionId(end);
  const endDate = end == null || endIsId ? null : end;
  if (!startDate) {
    if (endDate) return `until ${endDate}`;
    return "since earliest records";
  }
  if (endIsId) return `${startDate} → undated`;
  return `${startDate} → ${endDate ?? "present"}`;
}

/**
 * A session id used as a date. Prefer another field on the same row when that
 * field is a calendar date. Otherwise "undated".
 */
export function shownWhen(primary: string, alternate?: string): string {
  if (!isSessionId(primary)) return primary;
  if (alternate && !isSessionId(alternate)) return alternate;
  return "undated";
}

/** Prose stays verbatim except an internal session id is not shown. */
export function publicProse(text: string): string {
  const withoutLists = text.replace(/\(\s*S\d+(?:\s*\/\s*S\d+)+\s*\)/g, "");
  const replaced = withoutLists.replace(/\bS\d+\b/g, "an undated night");
  return replaced.replace(/[ \t]{2,}/g, " ").replace(/\s+([,.;:])/g, "$1").trim();
}

export function shortSession(id: string): string {
  if (isSessionId(id)) return publicSession(id);
  if (id === "2026-09-26-eve") return "09-26e";
  if (id.endsWith("-restday0")) return `${id.slice(5, 10)}r`;
  if (id.endsWith("-charge")) return `${id.slice(5, 10)}c`;
  if (id.startsWith("2026-")) return id.slice(5);
  return id;
}
