import { ICONS, type IconName } from './iconData';
import styles from './icons.module.css';

export type IconProps = {
  size?: number;
  className?: string;
  animated?: boolean;
  variant?: 'line' | 'filled';
  // An icon without a label is decorative and hidden from assistive technology.
  label?: string;
};

export default function BrandIcon({
  name,
  size = 24,
  className,
  animated = false,
  variant = 'line',
  label,
}: IconProps & { name: IconName }) {
  const icon = ICONS[name];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-icon={name}
      className={[animated && styles.animated, className].filter(Boolean).join(' ') || undefined}
    >
      {variant === 'filled' && (
        <g fill="currentColor" fillOpacity="0.22" stroke="none" className={styles.fill}>
          {icon.fill}
        </g>
      )}
      {icon.line}
    </svg>
  );
}
