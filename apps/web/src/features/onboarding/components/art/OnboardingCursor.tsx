export default function OnboardingCursor({ x, y }: { x: number; y: number }) {
  return (
    <path
      transform={`translate(${x} ${y})`}
      d="M0 0 L0 17 L4.6 12.8 L7.6 19.4 L10.4 18.2 L7.4 11.6 L13.4 11.6 Z"
      className="fill-foreground stroke-card"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  );
}
