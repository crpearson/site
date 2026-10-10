import type { ValueFormat } from "@/lib/types";

export function formatValue(kind: ValueFormat, n: number): string {
  if (kind === "volt") return n.toFixed(3);
  if (kind === "ir") return n.toFixed(2);
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

export function shortSession(id: string): string {
  if (id === "2026-09-26-eve") return "09-26e";
  if (id.endsWith("-restday0")) return `${id.slice(5, 10)}r`;
  if (id.startsWith("2026-")) return id.slice(5);
  return id;
}
