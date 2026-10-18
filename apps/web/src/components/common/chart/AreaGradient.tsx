// A vertical fade of `color` for an area fill, strongest along the line. Placed in a
// chart's <defs> and referenced as `url(#id)`.
export default function AreaGradient({ id, color }: { id: string; color: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={0.35} />
      <stop offset="100%" stopColor={color} stopOpacity={0.02} />
    </linearGradient>
  );
}
