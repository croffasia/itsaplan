import { cn } from '@/lib/utils';

// A ring filled to `percent` (0–100), read beside the figure it illustrates; the
// figure itself is printed as text, so the ring is decorative.
export default function RadialGauge({
  percent,
  tone = 'primary',
  className,
}: {
  percent: number;
  tone?: 'primary' | 'destructive';
  className?: string;
}) {
  const value = Math.max(0, Math.min(100, percent));
  return (
    <svg aria-hidden="true" viewBox="0 0 36 36" fill="none" className={cn('size-14', className)}>
      <circle cx="18" cy="18" r="15" stroke="var(--muted)" strokeWidth="3.5" />
      <circle cx="18" cy="18" r="9" stroke="var(--border)" strokeWidth="0.75" />
      <circle
        cx="18"
        cy="18"
        r="15"
        stroke={tone === 'primary' ? 'var(--primary)' : 'var(--destructive)'}
        strokeWidth="3.5"
        strokeLinecap="round"
        pathLength="100"
        strokeDasharray={`${value} 100`}
        transform="rotate(-90 18 18)"
      />
    </svg>
  );
}
