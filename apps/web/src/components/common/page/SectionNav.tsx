import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SectionNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  // Optional trailing indicator (e.g. the Actions enabled/total count).
  badge?: string;
}

// A sticky rail listing the sections of a long form or settings page. It highlights
// the one currently in view (driven by the caller's scroll spy) and jumps to a
// section on click. Shown only on wide viewports where there is room beside the
// content; the page stays fully usable without it.
export function SectionNav({
  sections,
  activeId,
  label,
  onJump,
  className,
}: {
  sections: SectionNavItem[];
  activeId: string | null;
  label: string;
  onJump: (id: string) => void;
  // Where the rail pins, when the default offset does not suit the page.
  className?: string;
}) {
  return (
    <nav
      className={cn('sticky top-2 hidden w-44 shrink-0 self-start lg:block', className)}
      aria-label={label}
    >
      <ul className="space-y-0.5">
        {sections.map((section) => {
          const active = section.id === activeId;
          const Icon = section.icon;
          return (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => onJump(section.id)}
                aria-current={active ? 'location' : undefined}
                className={cn(
                  'flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                  active
                    ? 'bg-secondary font-medium text-secondary-foreground'
                    : 'text-foreground/85 hover:bg-accent/60 hover:text-foreground',
                )}
              >
                <Icon
                  className={cn(
                    'size-4 shrink-0',
                    active ? 'text-foreground' : 'text-muted-foreground',
                  )}
                />
                <span className="min-w-0 flex-1 truncate">{section.label}</span>
                {section.badge && (
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {section.badge}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
