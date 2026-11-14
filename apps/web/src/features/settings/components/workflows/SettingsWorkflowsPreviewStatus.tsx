'use client';

import { Check, LoaderCircle, Undo2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SettingsWorkflowsPreviewState = 'done' | 'running' | 'failed' | 'back';

const ICONS = {
  done: { Icon: Check, className: 'text-green-500' },
  running: { Icon: LoaderCircle, className: 'text-foreground' },
  failed: { Icon: X, className: 'text-destructive' },
  back: { Icon: Undo2, className: 'text-warning' },
};

export default function SettingsWorkflowsPreviewStatus({
  state,
}: {
  state: SettingsWorkflowsPreviewState;
}) {
  const { Icon, className } = ICONS[state];
  return <Icon strokeWidth={2.5} className={cn('size-3.5 shrink-0', className)} />;
}
