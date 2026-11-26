import type { ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export default function AccountListSection({
  title,
  description,
  help,
  actions,
  sticky = false,
  children,
}: {
  title: string;
  description?: string;
  help?: string;
  actions?: ReactNode;
  sticky?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="border-t py-8 first:border-t-0 first:pt-0">
      <div
        className={cn(
          'mb-1 flex min-h-8 flex-wrap items-center justify-between gap-x-4',
          sticky && 'sticky top-12 z-10 -mx-3 -mt-2 -mb-1 bg-background px-3 py-2',
        )}
      >
        <div className="flex items-center gap-1">
          <h2 className="text-sm font-medium">{title}</h2>
          {help && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={help}
                  className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <HelpCircle className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">{help}</TooltipContent>
            </Tooltip>
          )}
        </div>
        {actions}
      </div>
      {description && <p className="-mt-1 mb-1 text-xs text-muted-foreground">{description}</p>}
      {children}
    </section>
  );
}
