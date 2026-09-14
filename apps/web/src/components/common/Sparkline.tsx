// A compact per-day line. Inline SVG rather than a chart library: it draws one
// series with no axes, no legend and no interaction, and scales to its box.
export default function Sparkline({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return <div className="h-16" />;

  const width = 100;
  const height = 32;
  const peak = Math.max(...values, 1);
  const step = width / (values.length - 1);
  const points = values.map((value, index) => {
    const x = index * step;
    const y = height - (value / peak) * (height - 2) - 1;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-16 w-full"
      role="img"
      aria-label={label}
    >
      <polygon
        points={`0,${height} ${points.join(' ')} ${width},${height}`}
        className="fill-foreground/8"
      />
      <polyline
        points={points.join(' ')}
        fill="none"
        vectorEffect="non-scaling-stroke"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-foreground/70"
      />
    </svg>
  );
}
