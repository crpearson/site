export function Sparkline({
  values,
  color,
}: {
  values: (number | null)[];
  color: string;
}) {
  const present = values.filter((value): value is number => value != null);
  if (present.length < 2) return null;
  const min = Math.min(...present);
  const max = Math.max(...present);
  const span = max - min || 1;
  const width = 100;
  const height = 32;
  const step = width / Math.max(1, values.length - 1);
  let path = "";
  values.forEach((value, index) => {
    if (value == null) return;
    const x = index * step;
    const y = height - ((value - min) / span) * (height - 4) - 2;
    const command = index > 0 && values[index - 1] != null ? "L" : "M";
    path += `${command}${x.toFixed(2)} ${y.toFixed(2)}`;
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-8 w-full"
      aria-hidden="true"
    >
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
