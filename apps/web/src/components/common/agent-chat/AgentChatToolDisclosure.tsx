'use client';

import type { ReactNode } from 'react';
import { ChevronRight, Wrench } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// A row in the transcript that opens to show more of a tool call. `withIcon` is for a
// row that stands on its own in the answer; a call listed under such a row is named in
// code instead.
export default function AgentChatToolDisclosure({
  label,
  withIcon = false,
  children,
}: {
  label: string;
  withIcon?: boolean;
  children: ReactNode;
}) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="group flex min-h-8 w-fit max-w-full items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
        <ChevronRight className="size-3.5 shrink-0 transition-transform duration-150 group-data-[state=open]:rotate-90 rtl:group-data-[state=closed]:rotate-180" />
        {withIcon && <Wrench className="size-3.5 shrink-0" />}
        <span className={`min-w-0 truncate ${withIcon ? '' : 'font-mono text-xs'}`}>{label}</span>
      </CollapsibleTrigger>
      {/* Indented to the trigger's label column, past the chevron. */}
      <CollapsibleContent className="overflow-hidden ps-5 motion-safe:data-[state=closed]:animate-collapsible-up motion-safe:data-[state=open]:animate-collapsible-down">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
