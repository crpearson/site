/** Canonical pack page. Keyed on the serial, never the slot label. */
export function packPath(serial: string): string {
  return `/batteries/pack/${serial}/`;
}

/** Thin position page for the slot label. */
export function slotPath(label: string): string {
  return `/batteries/slot/${label}/`;
}
