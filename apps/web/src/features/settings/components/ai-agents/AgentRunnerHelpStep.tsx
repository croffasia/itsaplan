import type { ReactNode } from 'react';

// One numbered step of the runner walkthrough: the number in a circle, the title, and
// whatever the step needs under it (a hint, a snippet, the per-agent tabs).
export function AgentRunnerHelpStep({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border text-xs text-muted-foreground tabular-nums">
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm font-medium">{title}</p>
        {children}
      </div>
    </div>
  );
}
