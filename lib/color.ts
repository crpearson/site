export const CELL_COLORS = [
  "#2ee6c7",
  "#5eb1ff",
  "#c4a1ff",
  "#ff7ad9",
  "#ffb020",
  "#ff6b6b",
] as const;

export const FLEET_COLOR = {
  C1: "#2ee6c7",
  C2: "#c4a1ff",
} as const;

const PACK_COLORS = ["", ...CELL_COLORS];

export function packColor(packId: string): string {
  const n = Number(packId.slice(-1));
  return PACK_COLORS[n] ?? "#9aafc0";
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(rgb: [number, number, number]): number {
  return (
    0.2126 * channel(rgb[0]) +
    0.7152 * channel(rgb[1]) +
    0.0722 * channel(rgb[2])
  );
}

function lerp(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/** Low IR is cool teal, high IR runs through amber into rose. */
export function heatRgb(t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, t));
  const low: [number, number, number] = [16, 118, 112];
  const mid: [number, number, number] = [244, 186, 72];
  const high: [number, number, number] = [224, 68, 96];
  if (x < 0.55) return lerp(low, mid, x / 0.55);
  return lerp(mid, high, (x - 0.55) / 0.45);
}

export function heatStyle(
  value: number,
  min: number,
  max: number,
): { background: string; color: string } {
  const t = max === min ? 0.5 : (value - min) / (max - min);
  const rgb = heatRgb(t);
  const text = luminance(rgb) > 0.42 ? "#14181d" : "#f4f8fb";
  return {
    background: `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`,
    color: text,
  };
}

export function heatGradient(): string {
  const a = heatRgb(0);
  const b = heatRgb(0.55);
  const c = heatRgb(1);
  return `linear-gradient(90deg, rgb(${a.join(",")}), rgb(${b.join(",")}), rgb(${c.join(",")}))`;
}
