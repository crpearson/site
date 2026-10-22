import assert from "node:assert/strict";
import { CELL_IR_MOHM, CELL_VOLTS, PACK_IR_MOHM } from "../lib/bounds.mjs";

function outOfRange(value, [lo, hi]) {
  return !Number.isFinite(value) || value < lo || value > hi;
}

assert.deepEqual(CELL_IR_MOHM, [0.5, 15]);
assert.deepEqual(PACK_IR_MOHM, [5, 60]);
assert.deepEqual(CELL_VOLTS, [2.5, 4.35]);
assert.equal(outOfRange(0.5, CELL_IR_MOHM), false);
assert.equal(outOfRange(15, CELL_IR_MOHM), false);
assert.equal(outOfRange(0.49, CELL_IR_MOHM), true);
assert.equal(outOfRange(15.01, CELL_IR_MOHM), true);
assert.equal(outOfRange(5, PACK_IR_MOHM), false);
assert.equal(outOfRange(60, PACK_IR_MOHM), false);
assert.equal(outOfRange(4.99, PACK_IR_MOHM), true);
assert.equal(outOfRange(2.5, CELL_VOLTS), false);
assert.equal(outOfRange(4.35, CELL_VOLTS), false);
assert.equal(outOfRange(2.49, CELL_VOLTS), true);
assert.equal(outOfRange(Number.NaN, CELL_IR_MOHM), true);

console.log("sane-range checks passed");
