import AppLogo from '@/components/common/AppLogo';
import styles from './hero.module.css';

const NODES = [
  { x: 200, y: 52, delay: '0s' },
  { x: 330, y: 270, delay: '-1s' },
  { x: 70, y: 270, delay: '-2s' },
  { x: 354, y: 200, delay: '-0.5s' },
  { x: 46, y: 200, delay: '-1.5s' },
];

export default function OrbitRings({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`relative aspect-square ${className ?? ''}`}>
      <svg viewBox="0 0 400 400" fill="none" className="absolute inset-0 size-full">
        <g stroke="currentColor" strokeOpacity="0.2">
          <circle cx="200" cy="200" r="90" />
          <circle cx="200" cy="200" r="130" strokeDasharray="2 6" />
          <circle cx="200" cy="200" r="168" />
        </g>
        <g className={styles.orbit}>
          <circle
            cx="200"
            cy="200"
            r="130"
            stroke="var(--brand-mint)"
            strokeOpacity="0.7"
            strokeWidth="2"
            strokeDasharray="60 760"
            strokeLinecap="round"
          />
          <circle cx="330" cy="200" r="5" fill="var(--brand-mint)" />
        </g>
        <g className={styles.orbitReverse}>
          <circle
            cx="200"
            cy="200"
            r="168"
            stroke="currentColor"
            strokeOpacity="0.5"
            strokeWidth="2"
            strokeDasharray="40 1016"
            strokeLinecap="round"
          />
          <circle cx="32" cy="200" r="4" fill="currentColor" />
        </g>
        <g stroke="var(--brand-mint)" strokeOpacity="0.25">
          {NODES.map((n) => (
            <line key={`${n.x}-${n.y}`} x1="200" y1="200" x2={n.x} y2={n.y} />
          ))}
          <path d="M 200 52 L 354 200 L 330 270 L 70 270 L 46 200 Z" strokeDasharray="3 5" />
        </g>
        {NODES.map((n) => (
          <circle
            key={`${n.x}-${n.y}`}
            cx={n.x}
            cy={n.y}
            r="5"
            fill="var(--brand-mint)"
            className={styles.node}
            style={{ animationDelay: n.delay }}
          />
        ))}
      </svg>
      <AppLogo
        className={`${styles.float} absolute top-1/2 left-1/2 w-[30%] -translate-x-1/2 -translate-y-1/2`}
      />
    </div>
  );
}
