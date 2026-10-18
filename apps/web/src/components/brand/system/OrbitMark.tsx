import type { LucideIcon } from 'lucide-react';
import AppLogo from '@/components/common/AppLogo';
import styles from './system.module.css';

export default function OrbitMark({
  icon: Icon,
  fast = false,
  still = false,
  className,
}: {
  icon?: LucideIcon;
  fast?: boolean;
  still?: boolean;
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={`relative aspect-square text-primary ${className ?? ''}`}>
      <svg viewBox="0 0 120 120" fill="none" className="absolute inset-0 size-full">
        <circle cx="60" cy="60" r="56" stroke="currentColor" strokeOpacity="0.12" />
        <circle
          cx="60"
          cy="60"
          r="44"
          stroke="currentColor"
          strokeOpacity="0.25"
          strokeDasharray="1.5 4.5"
        />
        <circle
          cx="60"
          cy="60"
          r="30"
          fill="currentColor"
          fillOpacity="0.08"
          className={still ? undefined : styles.halo}
        />
        <g className={still ? undefined : `${styles.arc} ${fast ? styles.fast : ''}`}>
          <circle
            cx="60"
            cy="60"
            r="44"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="56 221"
          />
          <circle cx="104" cy="60" r="3" fill="currentColor" />
        </g>
      </svg>
      {Icon ? (
        <Icon className="absolute top-1/2 left-1/2 size-[26%] -translate-x-1/2 -translate-y-1/2" />
      ) : (
        <AppLogo className="absolute top-1/2 left-1/2 w-[32%] -translate-x-1/2 -translate-y-1/2" />
      )}
    </div>
  );
}
