/**
 * Sane ranges and the IR conversion. One source for the site and the build checks.
 * scripts/ingest.py copies the IR numbers below; it cannot import this module.
 *
 * These are sanity limits, not health / Caution / GO rules.
 */

/** Cell internal resistance, milliohms, inclusive. */
export const CELL_IR_MOHM = [0.5, 15];

/** Pack internal resistance (six-cell sum or S_R), milliohms, inclusive. */
export const PACK_IR_MOHM = [5, 60];

/** One cell's voltage, volts, inclusive. The same window in millivolts is 2500–4350. */
export const CELL_VOLTS = [2.5, 4.35];

/** Whole-pack rest voltage, volts, inclusive. */
export const PACK_REST_VOLTS = [15, 26.5];

/**
 * Historical DX8-integer factor (÷100). v4 rows are already milliohms, so the
 * site does not multiply by this.
 */
export const IR_SCALE = 0.01;

/** `;128;` samples are 0.1 mΩ steps. Ingest divides a raw log by this once. */
export const IR_128_DIVISOR = 10;

/** Sanity cap on one cell after the ÷10 conversion. Not a Rules v3 cut. */
export const MAX_PLAUSIBLE_IR_MOHM = 10;
