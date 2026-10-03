import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export const sectionNavItemClass =
  'flex h-8 w-full items-center gap-2 rounded-md px-2 text-start text-sm transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

export const sectionNavIdleClass = 'text-foreground/85 hover:bg-accent/60 hover:text-foreground';

export interface SectionNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  // Optional trailing indicator (e.g. the Actions enabled/total count).
  badge?: string;
  // Set when the section is a route of its own; the entry is then a link rather
  // than a button, and `onJump` is not called for it.
  href?: string;
}

// A rail listing the sections of a page. It highlights the active one and reports
// the section clicked. The caller places and sizes it through `className`. Collapsed,
// it shows the icons only, each label in a tooltip; the icons run in a row below `lg`,
// where the page stacks its rails.
export function SectionNav({
  sections,
  activeId,
  label,
  onJump,
  collapsed = false,
  className,
}: {
  sections: SectionNavItem[];
  activeId: string | null;
  label: string;
  onJump?: (id: string) => void;
  collapsed?: boolean;
  className?: string;
}) {
  return (
    <nav className={className} aria-label={label}>
      <ul className={collapsed ? 'flex flex-wrap gap-0.5 lg:flex-col' : 'space-y-0.5'}>
        {sections.map((section) => {
          const active = section.id === activeId;
          const Icon = section.icon;
          const itemClassName = cn(
            sectionNavItemClass,
            collapsed && 'w-8 justify-center px-0',
            active ? 'bg-secondary font-medium text-secondary-foreground' : sectionNavIdleClass,
          );
          const icon = (
            <Icon
              className={cn(
                'size-4 shrink-0',
                active ? 'text-foreground' : 'text-muted-foreground',
              )}
            />
          );
          const content = collapsed ? (
            <>
              {icon}
              <span className="sr-only">{section.label}</span>
            </>
          ) : (
            <>
              {icon}
              <span className="min-w-0 flex-1 truncate">{section.label}</span>
              {section.badge && (
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {section.badge}
                </span>
              )}
            </>
          );
          const entry = section.href ? (
            <Link
              href={section.href}
              aria-current={active ? 'page' : undefined}
              className={itemClassName}
            >
              {content}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => onJump?.(section.id)}
              aria-current={active ? 'location' : undefined}
              className={itemClassName}
            >
              {content}
            </button>
          );
          return (
            <li key={section.id}>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>{entry}</TooltipTrigger>
                  <TooltipContent side="right">{section.label}</TooltipContent>
                </Tooltip>
              ) : (
                entry
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
