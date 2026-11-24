export type OnboardingState = 'todo' | 'inProgress' | 'review' | 'done';

// The state circle the app draws beside an issue: empty, half, three quarters, checked.
export default function OnboardingStateIcon({
  state,
  cx,
  cy,
}: {
  state: OnboardingState;
  cx: number;
  cy: number;
}) {
  if (state === 'done') {
    return (
      <g>
        <circle cx={cx} cy={cy} r="4.5" fill="#22A06B" />
        <path
          d={`M${cx - 2} ${cy} l1.4 1.4 l2.8 -3`}
          stroke="#fff"
          strokeWidth="1.4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    );
  }
  if (state === 'todo') {
    return (
      <circle
        cx={cx}
        cy={cy}
        r="4.5"
        fill="none"
        strokeWidth="1.5"
        className="stroke-muted-foreground"
      />
    );
  }
  const color = state === 'inProgress' ? '#EAB308' : '#8B5CF6';
  const fill =
    state === 'inProgress'
      ? `M${cx} ${cy - 4.5} A4.5 4.5 0 0 1 ${cx} ${cy + 4.5} Z`
      : `M${cx} ${cy - 4.5} A4.5 4.5 0 1 1 ${cx - 4.5} ${cy} L${cx} ${cy} Z`;
  return (
    <g>
      <circle cx={cx} cy={cy} r="4.5" fill="none" stroke={color} strokeWidth="1.5" />
      <path d={fill} fill={color} />
    </g>
  );
}
