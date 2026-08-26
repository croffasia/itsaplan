import { ChevronRight } from 'lucide-react';
import { type Issue } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useParentIssue } from '../../context/useSubtasks';

// The issue's identifier, preceded by its parent's when the issue is a subtask.
// A subtask gets a card or a row of its own once the Subtasks display option is
// on, and nothing else on it says what it belongs to. The parent's identifier
// opens the parent; without onOpenParent (the drag preview) it is inert.
export function IssueIdentifier({
  issue,
  className,
  onOpenParent,
}: {
  issue: Issue;
  className?: string;
  onOpenParent?: (id: number) => void;
}) {
  const parent = useParentIssue(issue.parentId);

  return (
    <span className={cn('flex shrink-0 items-center gap-0.5', className)}>
      {parent && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                // The card and the row start a drag on pointerdown and open
                // themselves on click; the parent link must do neither.
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenParent?.(parent.id);
                }}
                className={cn(
                  'text-muted-foreground/60',
                  onOpenParent && 'cursor-pointer hover:text-foreground hover:underline',
                )}
              >
                {parent.identifier}
              </button>
            </TooltipTrigger>
            <TooltipContent>{parent.title}</TooltipContent>
          </Tooltip>
          <ChevronRight className="size-3 shrink-0 text-muted-foreground/60 rtl:rotate-180" />
        </>
      )}
      {issue.identifier}
    </span>
  );
}
