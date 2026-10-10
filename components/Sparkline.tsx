import { missBridges, openEndIndices } from "@/lib/bridges";
import { formatValue } from "@/lib/format";
import { IR_UNIT } from "@/lib/ir";
import type { ChartSeries } from "@/lib/types";

export function Sparkline({
  values,
  color,
  service,
  logged,
  rest,
}: {
  values: (number | null)[];
  color: string;
  service?: (string | null)[];
  logged?: boolean[];
  rest?: boolean[];
}) {
  const present = values.filter((value): value is number => value != null);
  if (present.length < 2) return null;
  const min = Math.min(...present);
  const max = Math.max(...present);
  const span = max - min || 1;
  const width = 100;
  const height = 32;
  const step = width / Math.max(1, values.length - 1);
  const xy = (index: number, value: number) => {
    const x = index * step;
    const y = height - ((value - min) / span) * (height - 4) - 2;
    return `${x.toFixed(2)} ${y.toFixed(2)}`;
  };
  let path = "";
  values.forEach((value, index) => {
    if (value == null) return;
    const command = index > 0 && values[index - 1] != null ? "L" : "M";
    path += `${command}${xy(index, value)}`;
  });
  const series: ChartSeries = { id: "spark", label: "", color, values, service, logged, rest };
  const latest = [...values].reverse().find((value) => value != null);
  const ends = openEndIndices(series);
  const dash = missBridges(series, values.map((_, index) => String(index)))
    .map((bridge) => {
      const from = values[bridge.from];
      const to = values[bridge.to];
      if (from == null || to == null) return "";
      return `M${xy(bridge.from, from)} L${xy(bridge.to, to)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-8 w-full"
      role="img"
      aria-label={
        latest == null ? "IR sparkline" : `IR sparkline, latest ${formatValue("ir", latest)} ${IR_UNIT}`
      }
    >
      {ends.map((index) => (
        <circle
          key={index}
          cx={index * step}
          cy={height - 3}
          r={2.1}
          fill="none"
          stroke={color}
          strokeOpacity={0.45}
          strokeWidth={1.2}
        />
      ))}
      {dash ? (
        <path
          d={dash}
          fill="none"
          stroke={color}
          strokeOpacity={0.4}
          strokeWidth="1.7"
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray="1.2 3.2"
          pathLength="28"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
