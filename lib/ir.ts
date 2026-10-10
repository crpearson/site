/**
 * IR on this site is already milliohms from ir_store_v4 (median of the DX8
 * ;128; samples, divided by 10 in the published file).
 *
 * IR_STORE_IS_DX8_INTEGER is false, so scaleStoredIr applies a factor of 1.
 * Do not divide these rows again. The old ;130; line is charge taken per cell
 * in mAh and is not IR.
 *
 * IR_SCALE remains 0.01 only as the historical DX8-integer factor. Ingest now
 * divides the ;128; sample by 10 when it parses a raw log, which is the same
 * physical scale as a published v4 row.
 */
export const IR_SCALE = 0.01;
export const IR_UNIT = "mΩ";
export const IR_STORE_IS_DX8_INTEGER = false;
/** Sanity cap on a cell after the ;128; ÷10 conversion. Not a Rules v3 cut. */
export const MAX_PLAUSIBLE_IR_MOHM = 10;

export function scaleStoredIr(value: number): number {
  if (!IR_STORE_IS_DX8_INTEGER) return value;
  if (!Number.isFinite(value)) return value;
  return value * IR_SCALE;
}
