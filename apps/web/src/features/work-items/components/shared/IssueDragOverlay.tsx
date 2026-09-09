import { DragOverlay } from '@dnd-kit/core';
import type { Issue } from '@/lib/api/endpoints/issues';

// The card that follows the pointer while a row is dragged, in the table and on
// the timeline. The row itself stays in place, faded, so the drag reads as
// picking the issue up rather than sliding the row around.
//
// dropAnimation is disabled: the row is moved optimistically, so animating the
// overlay back to its source position first makes it look like it snaps back
// before landing in its new place.
export function IssueDragOverlay({ issue }: { issue: Issue | null }) {
  return (
    <DragOverlay dropAnimation={null}>
      {issue ? (
        <div className="flex max-w-[360px] items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm shadow-lg">
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {issue.identifier}
          </span>
          <span className="truncate text-foreground">{issue.title}</span>
        </div>
      ) : null}
    </DragOverlay>
  );
}
