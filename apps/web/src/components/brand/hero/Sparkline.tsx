import styles from './hero.module.css';

export default function Sparkline() {
  return (
    <svg aria-hidden="true" viewBox="0 0 80 32" fill="none" className="size-full">
      <path
        d="M 0 26 L 12 22 L 24 24 L 36 14 L 48 17 L 60 8 L 80 4"
        stroke="var(--brand-mint)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="120"
        className={styles.draw}
      />
      <circle cx="80" cy="4" r="2.5" fill="var(--brand-mint)" className={styles.node} />
    </svg>
  );
}
