// The "It's a Plan" brand mark: two shapes in tandem — a filled circle (the human/team)
// and an outlined square (the agent), joined by a short link. Roles read from the shapes
// themselves, so the mark works in a single color via currentColor and stays legible at
// small sizes. Decorative — the caller sets size/color via className.
export default function ItsAPlanMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="13" y="14.3" width="6" height="3.4" rx="1.7" fill="currentColor" opacity="0.4" />
      <circle cx="9.5" cy="16" r="6" fill="currentColor" />
      <rect
        x="17"
        y="10.5"
        width="11"
        height="11"
        rx="3.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      />
    </svg>
  );
}
