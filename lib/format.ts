import type { ValueFormat } from "@/lib/types";

/**
 * Name for the DX8 raw IR integers. The physical unit is not confirmed, so this
 * is not milliohms. Change these two strings when the scale is known.
 * Numbers are not scaled here.
 */
export const IR_UNIT = "DX8 IR (charger units)";
export const IR_UNIT_SHORT = "IR (charger units)";

export function isIrUnit(unit: string): boolean {
  return unit === IR_UNIT || unit === IR_UNIT_SHORT;
}

export function formatValue(kind: ValueFormat, n: number): string {
  if (kind === "volt") return n.toFixed(3);
  if (kind === "ir") return n.toFixed(1);
  return Math.round(n).toString();
}

export function formatAxis(kind: ValueFormat, n: number): string {
  if (kind === "volt") return n.toFixed(2);
  if (kind === "ir") return Math.round(n).toString();
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

export function shortSession(id: string): string {
  if (id === "2026-09-26-eve") return "09-26e";
  if (id.startsWith("2026-")) return id.slice(5);
  return id;
}
