/**
 * Maintenance mode switch.
 *
 * true  — every page returns 503 with the maintenance screen.
 * false — the static site is served as usual.
 *
 * Turn it off by changing this one line to false, then redeploy.
 * No other file needs to change.
 */
export const MAINTENANCE = true;

/** Seconds for the Retry-After header while maintenance mode is on. */
export const RETRY_AFTER_SECONDS = "3600";
