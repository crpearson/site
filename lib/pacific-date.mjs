/** Calendar dates for this site are America/Los_Angeles. Session ids are already those dates. */

export const PACIFIC_TZ = "America/Los_Angeles";

/** YYYY-MM-DD in America/Los_Angeles. en-CA formats that order. */
export function pacificCalendarDate(instant = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PACIFIC_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const part = (type) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** PT calendar date at the start of a session id or call date. S-numbers are not calendar dates. */
export function calendarDate(token) {
  const match = String(token ?? "").match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

/** Latest PT calendar date among session ids and call dates. */
export function latestCalendarDate(tokens) {
  let latest = "";
  for (const token of tokens) {
    const day = calendarDate(token);
    if (day > latest) latest = day;
  }
  return latest;
}
