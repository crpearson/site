/**
 * IR on this site is already milliohms from ir_store_v4 (median of the DX8
 * ;128; samples, divided by 10 in the published file). Do not divide these
 * rows again. The old ;130; line is charge taken per cell in mAh and is not IR.
 *
 * The ÷10 divisor, the post-conversion cap, and the old integer factor are
 * lib/bounds.mjs. Ingest copies those numbers; this function does not scale.
 */
export const IR_UNIT = "mΩ";

/** v4 rows are already milliohms. One conversion point for every reader. */
export function scaleStoredIr(value: number): number {
  return value;
}
