import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export const BANNER_BUTTON = 'h-7 px-2.5 text-[13px] has-[>svg]:px-2.5';

// A full-width notice between the page header and the page.
export default function DocumentBanner({
  icon: Icon,
  tone = 'neutral',
  spin = false,
  actions,
  children,
}: {
  icon: LucideIcon;
  tone?: 'neutral' | 'warn' | 'danger';
  spin?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex min-h-11 shrink-0 flex-wrap items-center gap-x-2.5 gap-y-2 px-[clamp(16px,3vw,40px)] py-1.5 text-[13px]',
        tone === 'neutral' && 'bg-[color-mix(in_oklab,var(--muted)_60%,var(--background))]',
        tone === 'warn' && 'bg-[color-mix(in_oklab,var(--warning)_13%,var(--background))]',
        tone === 'danger' && 'bg-[color-mix(in_oklab,var(--destructive)_11%,var(--background))]',
      )}
    >
      <Icon
        className={cn(
          'size-4 shrink-0 text-muted-foreground',
          tone === 'warn' && 'text-warning',
          tone === 'danger' && 'text-destructive',
          spin && 'animate-spin motion-reduce:animate-none',
        )}
        aria-hidden
      />
      <span className="min-w-[200px] flex-1">{children}</span>
      {actions && <span className="flex shrink-0 gap-1.5">{actions}</span>}
    </div>
  );
}
