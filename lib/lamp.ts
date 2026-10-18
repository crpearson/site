export type LampTone = "ok" | "caution" | "off" | "pool" | "rest";

export type StatusChipName = "GO" | "CAUTION" | "ALONE" | "REST" | "WATCH";

export const STATUS_CHIPS: readonly StatusChipName[] = ["GO", "CAUTION", "ALONE", "REST", "WATCH"];

/**
 * One chip for a pack card. First match wins, so every call maps to exactly one word.
 *
 * 1. REST — the call says Rest pool. That pack is off every board, even when the
 *    service half also says D pool or Watch, and even when it is charged alone.
 * 2. GO (watch) — the parallel half says Go (watch). Charging alone does not replace it.
 * 3. ALONE — Individual only, or charged individually (the call, or charge mode).
 *    This outranks Caution and Watch, so a pack charged on its own stays ALONE.
 * 4. CAUTION — the parallel half says Caution.
 * 5. GO — the parallel half says Go. A service Watch note does not replace a
 *    parallel Go; the Watch words stay in the full call under the chip.
 * 6. WATCH — D pool or Watch, when the parallel half is not already Rest, Alone,
 *    Caution, or Go.
 */
export function statusChip(status: string, chargeMode?: string | null): StatusChipName {
  const text = status.toUpperCase();
  const parallel = splitCall(status).parallel.toUpperCase();
  const service = splitCall(status).service.toUpperCase();
  if (text.includes("REST POOL")) return "REST";
  // Go (watch) and Go (new) are the recorded calls. Charging alone is not a demotion.
  if (isGoWatch(status) || isGoNew(status)) return "GO";
  if (
    parallel.includes("INDIVIDUAL") ||
    text.includes("INDIVIDUALLY") ||
    text.includes("DO NOT PARALLEL") ||
    chargeMode === "individual"
  ) {
    return "ALONE";
  }
  if (parallel.includes("CAUTION") || (!service && text.includes("CAUTION"))) return "CAUTION";
  if (/\bGO\b/.test(parallel) || /\bOK\b/.test(parallel)) return "GO";
  if (service.includes("D POOL") || service.includes("WATCH") || text.includes("D POOL") || text.includes("WATCH")) {
    return "WATCH";
  }
  throw new Error(`No status chip for call: ${status}`);
}

/**
 * A Go call can still be conditional. The chip stays the one word GO.
 * The note is the rest-voltage limit written in the call, when it has one.
 */
export function conditionalJoinNote(status: string): string | null {
  const parallel = splitCall(status).parallel;
  if (!/\bconditional\b/i.test(parallel)) return null;
  const volts = parallel.match(/within\s+(\d+(?:\.\d+)?)\s*V/i);
  if (!volts) return null;
  return `joins only if within ${volts[1]} V`;
}

export function chipTone(chip: StatusChipName): LampTone {
  if (chip === "GO") return "ok";
  if (chip === "CAUTION") return "caution";
  if (chip === "ALONE") return "off";
  if (chip === "REST") return "rest";
  return "pool";
}

/** Recorded Go (watch). The chip stays Go; the recheck sentence stays with it. */
export function isGoWatch(status: string): boolean {
  return /\bgo\s*\(\s*watch\s*\)/i.test(splitCall(status).parallel);
}

/** Recorded Go (new). The words are Lary's status, shown in full. */
export const GO_NEW_STATUS =
  "Go (new): charges alone until 2 clean storage nights, night 1 of 2 on 2026-10-14";

export function isGoNew(status: string): boolean {
  return /\bgo\s*\(\s*new\s*\)/i.test(splitCall(status).parallel);
}

export function goNewText(status: string): string | null {
  if (!isGoNew(status)) return null;
  const parallel = splitCall(status).parallel;
  return parallel.toLowerCase().includes(GO_NEW_STATUS.toLowerCase()) ? GO_NEW_STATUS : parallel;
}

export const WATCH_RECHECK = "watch, recheck next storage night";

export function watchRecheckText(status: string, reason = ""): string | null {
  if (!isGoWatch(status)) return null;
  const haystack = `${status}\n${reason}`.toLowerCase();
  return haystack.includes(WATCH_RECHECK) ? WATCH_RECHECK : null;
}

export function splitCall(status: string): { parallel: string; service: string } {
  const match = status.match(/^PARALLEL\s+([\s\S]+?)\s+\|\s+SERVICE\s+([\s\S]+)$/i);
  if (!match) return { parallel: status.trim(), service: "" };
  return { parallel: match[1].trim(), service: match[2].trim() };
}

/** A leading shout (GO, CAUTION) reads as a sentence. The rest of the phrase stays as recorded. */
function softenLead(text: string): string {
  return text.replace(/^[A-Z][A-Z0-9-]*/, (word) => word.charAt(0) + word.slice(1).toLowerCase());
}

/**
 * Lamp text. The recorded call keeps its PARALLEL and SERVICE field labels.
 * The chip drops both labels, because the service value already says the tier
 * ("In service", "Watch", "In service (watch)").
 */
export function callChipText(status: string): string {
  const match = status.match(/^PARALLEL\s+([\s\S]+?)\s+\|\s+SERVICE\s+([\s\S]+)$/i);
  if (match) return `Parallel ${softenLead(match[1].trim())} | ${match[2].trim()}`;
  if (/^PARALLEL\s+/i.test(status)) return `Parallel ${softenLead(status.replace(/^PARALLEL\s+/i, "").trim())}`;
  return softenLead(status.trim());
}

/** Lamp for the parallel half of a Rules v3 call. Older one-word calls still map. */
export function parallelTone(status: string): LampTone {
  const parallel = splitCall(status).parallel.toUpperCase();
  if (parallel.includes("REST POOL")) return "rest";
  if (/\bGO\s*\(\s*WATCH\s*\)/.test(parallel) || /\bGO\s*\(\s*NEW\s*\)/.test(parallel)) return "ok";
  if (parallel.includes("INDIVIDUAL-ONLY") || parallel.includes("DO NOT PARALLEL")) return "off";
  if (parallel.includes("INDIVIDUAL")) return "pool";
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
