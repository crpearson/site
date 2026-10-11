/** Shared with the units check. A row is provisional only when `ir_validation` says so. */
export const PROVISIONAL_MARK = "†";
export const PROVISIONAL_LEGEND = "provisional: charger screen check pending";

export function irValidationIsProvisional(text) {
  return /\bprovisional/i.test(String(text ?? ""));
}
