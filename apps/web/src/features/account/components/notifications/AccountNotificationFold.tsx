import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export default function AccountNotificationFold({
  title,
  description,
  closedMark,
  heading: Heading = 'div',
  openClassName,
  children,
}: {
  title: string;
  description?: string;
  closedMark?: string;
  heading?: 'h2' | 'div';
  openClassName?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn('-mx-3 rounded-lg', open && openClassName)}
    >
      <div
        className={cn(
          'relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 transition-colors',
          !open && 'hover:bg-accent',
        )}
      >
        <div className="min-w-0 flex-1">
          <Heading
            className={cn('text-sm wrap-anywhere', Heading === 'h2' && 'font-medium')}
            dir="auto"
          >
            <CollapsibleTrigger className="text-start outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50">
              {title}
            </CollapsibleTrigger>
          </Heading>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {!open && closedMark && <span className="text-sm text-muted-foreground">{closedMark}</span>}
        <ChevronRight
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            open ? 'rotate-90' : 'rtl:rotate-180',
          )}
        />
      </div>
      <CollapsibleContent className="px-3 pb-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}
