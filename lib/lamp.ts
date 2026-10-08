export type LampTone = "ok" | "caution" | "off" | "pool";

/**
 * Map a free-text status call onto a lamp.
 * Red keywords win over amber, amber over green. "D pool" is its own neutral tone.
 */
export function lampTone(status: string): LampTone {
  const text = status.toUpperCase();
  if (text.includes("D POOL")) return "pool";
  if (text.includes("DO NOT PARALLEL") || /\bOFF\b/.test(text) || /\bPULL\b/.test(text)) {
    return "off";
  }
  if (text.includes("CAUTION") || text.includes("WATCH") || text.includes("EYE")) return "caution";
  if (/\bGO\b/.test(text) || /\bOK\b/.test(text)) return "ok";
  return "pool";
}
