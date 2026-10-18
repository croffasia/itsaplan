export default function RadialProgress({ percent }: { percent: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" fill="none" className="h-full">
      <circle cx="16" cy="16" r="13" stroke="white" strokeOpacity="0.2" strokeWidth="3" />
      <circle
        cx="16"
        cy="16"
        r="13"
        stroke="var(--brand-mint)"
        strokeWidth="3"
        strokeLinecap="round"
        pathLength="100"
        strokeDasharray={`${percent} 100`}
        transform="rotate(-90 16 16)"
      />
    </svg>
  );
}
