export default function OnboardingSparkle({
  x,
  y,
  size,
  color,
}: {
  x: number;
  y: number;
  size: number;
  color: string;
}) {
  const s = size;
  return (
    <path
      transform={`translate(${x} ${y})`}
      d={`M0 ${-s} Q0 0 ${s} 0 Q0 0 0 ${s} Q0 0 ${-s} 0 Q0 0 0 ${-s}Z`}
      fill={color}
    />
  );
}
