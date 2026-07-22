import { type ReactNode } from 'react';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// A borderless section of the agent form: a quiet header (optional leading icon, a
// title, an optional one-line hint) over the fields, separated from its neighbours by
// whitespace and a hairline divider under the header, not by a card. This follows the
// project's borderless-first rule (see DESIGN.md) instead of boxing every group.
//
// The header toggles the section. Open state is controlled by the parent so its
// section nav can expand a section on jump.
export function AgentFormSection({
  id,
  icon: Icon,
  title,
  hint,
  headerRight,
  open,
  onOpenChange,
  children,
}: {
  // Anchor id, used by the section nav to scroll to and highlight this section.
  id?: string;
  icon?: LucideIcon;
  title: string;
  hint?: string;
  // Optional content pinned to the right of the header (e.g. a selected/total count).
  headerRight?: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    // The anchor id lives on a plain wrapper (not the Radix primitive, which does not
    // forward it) so the section nav's querySelector and scrollIntoView can find it.
    <div id={id} className="scroll-mt-4">
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CollapsibleTrigger className="group/section flex w-full items-center gap-2.5 border-b border-border/60 pb-2.5 text-left">
          {Icon && (
            <Icon className="size-4 shrink-0 text-muted-foreground transition-colors group-hover/section:text-foreground" />
          )}
          <span className="min-w-0 flex-1">
            <span className="text-sm font-medium">{title}</span>
            {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
          </span>
          {headerRight && (
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {headerRight}
            </span>
          )}
          <ChevronRight
            className={`size-4 shrink-0 text-muted-foreground/60 transition group-hover/section:text-muted-foreground ${
              open ? 'rotate-90' : ''
            }`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-4 pt-4">{children}</div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
