/** Rules v3 parallel call from true-IR history. Display still uses Lary's status text. */

export function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return 0;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function usualLowCell(points) {
  const counts = new Map();
  for (const point of points) {
    counts.set(point.floorCell, (counts.get(point.floorCell) ?? 0) + 1);
  }
  let best = points[points.length - 1]?.floorCell ?? 1;
  let seen = -1;
  for (const [cell, count] of counts) {
    if (count > seen) {
      best = cell;
      seen = count;
    }
  }
  return best;
}

export function parallelBucket(points, facts) {
  const reasons = [];
  let rank = 0;
  const bump = (next, why) => {
    const table = { GO: 0, CAUTION: 1, "INDIVIDUAL-ONLY": 2 };
    if (table[next] > rank) rank = table[next];
    reasons.push(why);
  };
  if (!points.length) return { call: "GO", reasons: ["no measurements"] };
  const hot = (point, spreadCut, ratio) => {
    const mid = median(point.cells);
    return point.spread >= spreadCut || point.cells.some((cell) => cell >= ratio * mid);
  };
  const last2 = points.slice(-2);
  if (last2.length === 2 && last2.every((point) => hot(point, 2, 1.5))) {
    bump("CAUTION", "spread ≥ 2.0 mΩ or a cell ≥ 1.5× the pack median, two nights in a row");
  }
  if (last2.length === 2 && last2.every((point) => hot(point, 3, 2))) {
    bump("INDIVIDUAL-ONLY", "spread ≥ 3.0 mΩ or a cell ≥ 2× the pack median, two nights in a row");
  }
  const last3 = points.slice(-3);
  if (last3.filter((point) => point.gap >= 60).length >= 2) {
    bump("CAUTION", "low-cell gap ≥ 60 mV on 2 of the last 3 nights");
  }
  if (last3.filter((point) => point.gap >= 100).length >= 2) {
    bump("INDIVIDUAL-ONLY", "low-cell gap ≥ 100 mV on 2 of the last 3 nights");
  }
  const last = points[points.length - 1];
  if (last.floor < 3600 && last.floorCell === usualLowCell(points)) {
    bump("CAUTION", "floor under 3600 mV on the usual low cell");
  }
  if (last.starts.some((value) => value < 3300)) {
    bump("INDIVIDUAL-ONLY", "a cell under 3.30 V");
  }
  if (facts.inDPool) bump("INDIVIDUAL-ONLY", "D pool");
  if (facts.failedRest) bump("INDIVIDUAL-ONLY", "failed rest test");
  if (facts.selfDischargeWatch) bump("INDIVIDUAL-ONLY", "watch for self-discharge");
  const call = rank === 2 ? "INDIVIDUAL-ONLY" : rank === 1 ? "CAUTION" : "GO";
  return { call, reasons };
}

export function laryParallelBucket(status) {
  const parallel = status.split("|")[0].replace(/^PARALLEL\s+/i, "").trim().toUpperCase();
  if (parallel.includes("INDIVIDUAL-ONLY")) return "INDIVIDUAL-ONLY";
  if (parallel.includes("CAUTION")) return "CAUTION";
  if (/\bGO\b/.test(parallel)) return "GO";
  return parallel;
}
