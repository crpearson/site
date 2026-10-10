/**
 * DX8 IR integer ÷ 100 = mΩ (a log integer of 281 is 2.81 mΩ).
 *
 * IR_STORE_IS_DX8_INTEGER
 *   true  — data/store.csv and data/v2/ir_store_v2.public.csv still hold the
 *           raw DX8 integer. scaleStoredIr applies IR_SCALE on read.
 *   false — those CSVs are already milliohms (corrected files, or a re-ingest
 *           that wrote scaled rows). scaleStoredIr returns the value unchanged
 *           so it is not scaled twice.
 *
 * scripts/ingest.py mirrors both constants. Raw logs are always DX8 integers.
 * Ingest scales them once when it assigns log.ir. While this flag is true it
 * will not append those milliohm rows onto the integer CSV. Flip the flag in
 * both files in the same change that replaces the CSVs.
 *
 * TODO(lary): set IR_STORE_IS_DX8_INTEGER false when the corrected CSVs arrive.
 * TODO(lary): confirm MAX_PLAUSIBLE_IR_MOHM. 10 is the old 1000-integer cap
 * after ÷100, not a new measurement limit.
 */
export const IR_SCALE = 0.01;
export const IR_UNIT = "mΩ";
export const IR_STORE_IS_DX8_INTEGER = true;
export const MAX_PLAUSIBLE_IR_MOHM = 10;

export function scaleStoredIr(value: number): number {
  if (!IR_STORE_IS_DX8_INTEGER) return value;
  if (!Number.isFinite(value)) return value;
  return value * IR_SCALE;
}
