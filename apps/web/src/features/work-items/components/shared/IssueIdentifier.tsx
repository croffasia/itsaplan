import { Fragment } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Issue } from '@/lib/api/endpoints/issues';
import { noDragProps } from '@/lib/dnd';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAncestors } from '../../context/useSubtasks';

// The issue's identifier, preceded by the identifiers of the issues above it when
// the issue is a subtask: the top one and the parent, with an ellipsis for any in
// between. A subtask gets a card or a row of its own once the Subtasks display
// option is on, and nothing else on it says what it belongs to. Each identifier
// opens its issue; without onOpenAncestor (the drag preview) they are inert.
export function IssueIdentifier({
  issue,
  className,
  onOpenAncestor,
}: {
  issue: Issue;
  className?: string;
  onOpenAncestor?: (id: number) => void;
}) {
  const ancestors = useAncestors(issue.parentId);
  const hidden = ancestors.slice(1, -1);
  const shown = hidden.length > 0 ? [ancestors[0], ancestors[ancestors.length - 1]] : ancestors;
  const separator = (
    <ChevronRight className="size-3 shrink-0 text-muted-foreground/60 rtl:rotate-180" />
  );

  return (
    <span className={cn('flex shrink-0 items-center gap-0.5', className)}>
      {shown.map((ancestor, index) => (
        <Fragment key={ancestor.id}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                // The card and the row start a drag on press and open themselves
                // on click; the link must do neither.
                {...noDragProps}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onOpenAncestor?.(ancestor.id);
                }}
                className={cn(
                  'text-muted-foreground/60',
                  onOpenAncestor && 'cursor-pointer hover:text-foreground hover:underline',
                )}
              >
                {ancestor.identifier}
              </button>
            </TooltipTrigger>
            <TooltipContent>{ancestor.title}</TooltipContent>
          </Tooltip>
          {separator}
          {index === 0 && hidden.length > 0 && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-muted-foreground/60">…</span>
                </TooltipTrigger>
                <TooltipContent>{hidden.map((h) => h.identifier).join(' › ')}</TooltipContent>
              </Tooltip>
              {separator}
            </>
          )}
        </Fragment>
      ))}
      {issue.identifier}
    </span>
  );
}
