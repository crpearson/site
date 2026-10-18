/**
 * Rules v6 run order. This is the site's planner. The validator and the
 * /next-charge page both call it; there is no second copy.
 *
 * Which slots are included is planner_rules.include_states (active only in
 * the current fixtures). A pulled slot stays out while that list is
 * ["active"]. Adding "pulled" there is the switch if that changes.
 */

export const PLANNER_SERIES = ["C1", "C2", "C3", "C4"];
export const PLANNER_CHANNELS = [
  ["DX8-1", 1],
  ["DX8-1", 2],
  ["DX8-2", 1],
  ["DX8-2", 2],
];

export function channelName(charger, channel) {
  return `${charger} Channel ${channel}`;
}

/**
 * rows = home_channels; flown = series ticked; dFlown = D-1 ticked.
 * Returns { channels, rounds, files }.
 */
export function planRuns(rows, rules, flown, dFlown) {
  const order = rules.series_order;
  const channels = {};
  for (const [charger, channel] of PLANNER_CHANNELS) {
    channels[channelName(charger, channel)] = rows
      .filter((row) => row.charger === charger && row.channel === channel && rules.include_states.includes(row.state))
      .filter((row) => (row.series === "D" ? dFlown : flown.includes(row.series)))
      .sort((x, y) => order.indexOf(x.series) - order.indexOf(y.series) || x.slot - y.slot)
      .map((row) => row.label);
  }
  const rounds = {};
  const files = {};
  for (const charger of ["DX8-1", "DX8-2"]) {
    const [first, second] = rules.channel_start_order.map((channel) => channels[channelName(charger, channel)]);
    const count = Math.max(first.length, second.length);
    rounds[charger] = Array.from({ length: count }, (_, k) => [first[k] ?? null, second[k] ?? null]);
    files[charger] = first.length + second.length;
  }
  return { channels, rounds, files };
}
