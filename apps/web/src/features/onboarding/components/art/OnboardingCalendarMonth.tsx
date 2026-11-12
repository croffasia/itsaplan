import { useLocale } from 'next-intl';
import { SOFT, SUB, sampleDate } from '../../utils/art';

const CELL = 480 / 7;
const ROW = 40;
const TODAY = 12;
const GRAY = '#94A3B8';
// The issues due on a day, as the colour of each one's state. November 2026 starts on a
// Sunday, so the 1st sits in the first cell.
const DUE: Record<number, string[]> = {
  8: [GRAY, GRAY],
  9: [GRAY, '#22A06B'],
  10: [GRAY, GRAY],
  11: ['#4C7DEB', GRAY],
  12: ['#22A06B', '#22A06B'],
  13: ['#EAB308', GRAY],
  14: ['#EAB308', '#4C7DEB'],
  15: [GRAY],
  16: ['#F97316'],
  17: [GRAY],
  19: ['#EAB308'],
  20: ['#EAB308'],
  28: [GRAY],
};

// Four weeks of a month with the issues due on each day.
export default function OnboardingCalendarMonth() {
  const weekday = new Intl.DateTimeFormat(useLocale(), { weekday: 'short' });
  const days = Array.from({ length: 28 }, (_, i) => ({
    day: i + 1,
    left: 60 + (i % 7) * CELL,
    top: 104 + Math.floor(i / 7) * ROW,
  }));
  const lines = [
    ...[0, 1, 2, 3].map((r) => `M60 ${104 + r * ROW} H540`),
    ...[1, 2, 3, 4, 5, 6].map((c) => `M${60 + c * CELL} 104 V266`),
  ];

  return (
    <g>
      {days.slice(0, 7).map(({ day, left }) => (
        <text
          key={day}
          x={left + CELL / 2}
          y="100"
          textAnchor="middle"
          fontSize="8.5"
          fontWeight="600"
          className={SUB}
        >
          {weekday.format(sampleDate(day))}
        </text>
      ))}
      <path d={lines.join(' ')} className="stroke-muted" />
      {days.map(({ day, left, top }) => (
        <g key={day}>
          {day === TODAY && <circle cx={left + CELL - 12.75} cy={top + 9} r="7.5" fill="#4C7DEB" />}
          <text
            x={left + CELL - 8}
            y={top + 12}
            textAnchor="end"
            fontSize="8.5"
            fontWeight={day === TODAY ? 700 : 500}
            className={day === TODAY ? 'fill-white' : SUB}
          >
            {day}
          </text>
          {(DUE[day] ?? []).map((color, k) => (
            <g key={k}>
              <rect
                x={left + 5}
                y={top + 17 + k * 11}
                width={CELL - 10}
                height="9"
                rx="3"
                className={SOFT}
              />
              <circle cx={left + 10} cy={top + 21.5 + k * 11} r="2.2" fill={color} />
              <rect
                x={left + 15}
                y={top + 20 + k * 11}
                width={CELL - 26}
                height="3"
                rx="1.5"
                className="fill-border"
              />
            </g>
          ))}
        </g>
      ))}
    </g>
  );
}
