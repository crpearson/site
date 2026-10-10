export type LampTone = "ok" | "caution" | "off" | "pool" | "rest";

export function splitCall(status: string): { parallel: string; service: string } {
  const match = status.match(/^PARALLEL\s+([\s\S]+?)\s+\|\s+SERVICE\s+([\s\S]+)$/i);
  if (!match) return { parallel: status.trim(), service: "" };
  return { parallel: match[1].trim(), service: match[2].trim() };
}

/** Lamp for the parallel half of a Rules v3 call. Older one-word calls still map. */
export function parallelTone(status: string): LampTone {
  const parallel = splitCall(status).parallel.toUpperCase();
  if (parallel.includes("REST POOL")) return "rest";
  if (parallel.includes("INDIVIDUAL-ONLY") || parallel.includes("DO NOT PARALLEL")) return "off";
  if (/\bOFF\b/.test(parallel) || /\bPULL\b/.test(parallel)) return "off";
  if (parallel.includes("CAUTION") || parallel.includes("EYE")) return "caution";
  if (/\bGO\b/.test(parallel) || /\bOK\b/.test(parallel)) return "ok";
  if (parallel.includes("D POOL")) return "pool";
  return "pool";
}

/** Lamp for the service half: In service, Watch, D pool, Retire. */
export function serviceTone(status: string): LampTone {
  const service = splitCall(status).service.toUpperCase();
  if (!service) return parallelTone(status);
  if (service.includes("RETIRE")) return "off";
  if (service.includes("D POOL")) return "pool";
  if (service.includes("WATCH")) return "caution";
  if (service.includes("IN SERVICE")) return "ok";
  return "pool";
}

/**
 * Map a free-text status call onto one lamp.
 * Rules v3 uses the parallel half. "D pool" with no parallel half stays neutral.
 */
export function lampTone(status: string): LampTone {
  if (/^PARALLEL\s+/i.test(status)) return parallelTone(status);
  const text = status.toUpperCase();
  if (text.includes("D POOL")) return "pool";
  if (text.includes("DO NOT PARALLEL") || /\bOFF\b/.test(text) || /\bPULL\b/.test(text)) return "off";
  if (text.includes("CAUTION") || text.includes("WATCH") || text.includes("EYE")) return "caution";
  if (/\bGO\b/.test(text) || /\bOK\b/.test(text)) return "ok";
  return "pool";
}
