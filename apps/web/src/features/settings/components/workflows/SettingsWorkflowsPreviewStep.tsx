'use client';

import type { CSSProperties } from 'react';
import { Bot } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import SettingsWorkflowsPreviewStatus, {
  type SettingsWorkflowsPreviewState,
} from './SettingsWorkflowsPreviewStatus';

// A step of the workflow: its agent, its name, how far the run got with it and, on the wide
// steps, a line under them.
export default function SettingsWorkflowsPreviewStep({
  name,
  state,
  note = false,
  className,
  style,
}: {
  name: string;
  state?: SettingsWorkflowsPreviewState;
  note?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn('absolute rounded-[10px] border bg-card px-3 py-2.5', className)}
      style={style}
    >
      <div className="flex items-center gap-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
          <Bot className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-3" style={{ width: name }} />
          <Skeleton className="h-2.5 w-2/5" />
        </div>
        {state && <SettingsWorkflowsPreviewStatus state={state} />}
      </div>
      {note && <Skeleton className="mt-3 h-2.5 w-3/4" />}
    </div>
  );
}
