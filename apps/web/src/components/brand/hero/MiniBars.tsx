import styles from './hero.module.css';

export default function MiniBars() {
  const heights = [12, 20, 15, 26, 18, 30];
  return (
    <svg aria-hidden="true" viewBox="0 0 60 32" className="size-full">
      {heights.map((h, i) => (
        <rect
          key={i}
          x={i * 10 + 1}
          y={32 - h}
          width="6"
          height={h}
          rx="2"
          fill="var(--brand-mint)"
          fillOpacity={0.5 + i * 0.1}
          className={styles.bar}
          style={{ animationDelay: `${i * -0.4}s` }}
        />
      ))}
    </svg>
  );
}
