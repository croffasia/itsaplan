import { useId } from 'react';
import { CARD } from '../../utils/art';
import OnboardingSparkle from './OnboardingSparkle';

const PINK = '#DB5B92';
// Each sticky note: its corner, colour and tilt.
const NOTES = [
  { x: 92, y: 46, color: '#FFE28A', tilt: -5 },
  { x: 206, y: 64, color: '#FFC3DA', tilt: 4 },
  { x: 322, y: 40, color: '#BFE0FF', tilt: -3 },
  { x: 430, y: 78, color: '#C8EFD2', tilt: 6 },
  { x: 150, y: 158, color: '#E0D3FF', tilt: 3 },
  { x: 290, y: 160, color: '#FFE28A', tilt: -4 },
];

// Sticky notes on a dotted board, one pinned and two joined by an arrow.
export default function OnboardingNotesArt() {
  const dots = `${useId().replace(/[^a-zA-Z0-9]/g, '')}dots`;

  return (
    <svg viewBox="0 0 600 280" className="absolute inset-0 size-full" aria-hidden="true">
      <defs>
        <pattern id={dots} width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.3" className="fill-border" />
        </pattern>
      </defs>
      <rect x="54" y="20" width="492" height="244" rx="16" className={CARD} />
      <rect x="54" y="20" width="492" height="244" rx="16" fill={`url(#${dots})`} />
      {NOTES.map((note) => (
        <g key={`${note.x}`} transform={`rotate(${note.tilt} ${note.x + 46} ${note.y + 43})`}>
          <rect
            x={note.x}
            y={note.y}
            width="92"
            height="86"
            rx="6"
            fill={note.color}
            className="drop-shadow-[0_8px_14px_rgba(24,24,48,0.1)]"
          />
          {[64, 52, 58].map((width, i) => (
            <rect
              key={i}
              x={note.x + 12}
              y={note.y + 18 + i * 12}
              width={width}
              height="5"
              rx="2.5"
              fill="#000"
              fillOpacity=".16"
            />
          ))}
        </g>
      ))}
      <path
        d="M246 214 C 262 226, 276 222, 286 210"
        stroke={PINK}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M277.5 213.1 L286 210 L284.4 218.9"
        stroke={PINK}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="368" cy="44" r="6" fill={PINK} />
      <circle cx="366" cy="42" r="2" fill="#fff" fillOpacity=".7" />
      <circle cx="512" cy="232" r="14" fill={PINK} />
      <path d="M512 225 v14 M505 232 h14" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <OnboardingSparkle x={570} y={40} size={8} color={PINK} />
      <OnboardingSparkle x={32} y={250} size={6} color={PINK} />
    </svg>
  );
}
