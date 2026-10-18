import styles from './hero.module.css';

const PATH =
  'M 0 30 H 70 L 82 30 L 92 8 L 104 52 L 114 18 L 122 30 H 200 L 212 30 L 222 4 L 236 56 L 246 20 L 254 30 H 330 L 342 30 L 352 10 L 364 50 L 374 22 L 382 30 H 400';

export default function PulseLine({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 400 60" fill="none" className={className}>
      <path d={PATH} stroke="currentColor" strokeOpacity="0.15" strokeWidth="2" />
      <path
        d={PATH}
        stroke="var(--brand-mint)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="1"
        className={styles.ecg}
      />
    </svg>
  );
}
