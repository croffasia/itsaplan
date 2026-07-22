import type { StateType } from '@/lib/api';

// Linear-style status icon, colored by the column color. One glyph per state
// type: backlog is a dashed ring, unstarted an empty ring, started a ring with
// a filled sector, completed a filled check, canceled a filled cross.
export function StateIcon({
  stateType,
  color,
  className,
}: {
  stateType: StateType;
  color: string;
  className?: string;
}) {
  const common = {
    width: 14,
    height: 14,
    viewBox: '0 0 14 14',
    className,
    'aria-hidden': true,
  } as const;
  switch (stateType) {
    case 'backlog':
      return (
        <svg {...common}>
          <circle
            cx="7"
            cy="7"
            r="5.5"
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            strokeDasharray="1.6 1.8"
          />
        </svg>
      );
    case 'unstarted':
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="5.5" fill="none" stroke={color} strokeWidth="1.5" />
        </svg>
      );
    case 'started':
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="5.5" fill="none" stroke={color} strokeWidth="1.5" />
          <path d="M7 7 L7 2.5 A4.5 4.5 0 0 1 11.5 7 Z" fill={color} />
          <circle cx="7" cy="7" r="4.5" fill="none" stroke={color} strokeWidth="1" />
        </svg>
      );
    case 'completed':
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="6" fill={color} />
          <path
            d="M4.3 7.1 L6.2 9 L9.7 5"
            fill="none"
            stroke="var(--card)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'canceled':
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="6" fill={color} />
          <path
            d="M5 5 L9 9 M9 5 L5 9"
            fill="none"
            stroke="var(--card)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return null;
  }
}

const PRIORITY_BARS: Record<string, number> = { low: 1, medium: 2, high: 3 };

// Linear-style priority glyph: three bars of rising height, filled up to the
// level. Urgent is a filled square with an exclamation mark instead of bars.
export function PriorityIcon({ priority, className }: { priority: string; className?: string }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: '0 0 14 14',
    className,
    'aria-hidden': true,
  } as const;
  if (priority === 'urgent') {
    return (
      <svg {...common}>
        <rect x="1" y="1" width="12" height="12" rx="2.5" fill="var(--priority-urgent)" />
        <rect x="6.2" y="3.2" width="1.6" height="4.6" rx="0.8" fill="var(--card)" />
        <rect x="6.2" y="9" width="1.6" height="1.8" rx="0.8" fill="var(--card)" />
      </svg>
    );
  }
  const level = PRIORITY_BARS[priority] ?? 0;
  const bars = [
    { x: 1.5, y: 8.5, h: 3.5 },
    { x: 5.75, y: 5.5, h: 6.5 },
    { x: 10, y: 2.5, h: 9.5 },
  ];
  return (
    <svg {...common}>
      {bars.map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={b.y}
          width="2.5"
          height={b.h}
          rx="1"
          fill={i < level ? 'var(--foreground)' : 'var(--muted-foreground)'}
          opacity={i < level ? 1 : 0.35}
        />
      ))}
    </svg>
  );
}
