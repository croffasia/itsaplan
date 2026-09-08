import { useState } from 'react';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { Issue, IssuePatch } from '@/lib/api/endpoints/issues';
import { addDays, toDateStr } from '@/utils/dates';
import { useUpdateIssue } from '@/services/issues.service';
import { effSpan } from '../utils/timeline';

// Whether a bar drag moves the whole span or resizes one end.
export type TimelineDragMode = 'move' | 'start' | 'end';

interface DragSession {
  startX: number;
  origStart: Date;
  origEnd: Date;
  curStart: Date;
  curEnd: Date;
  deltaDays: number;
}

// Pointer-drag state and handlers for the timeline bars. A bar drag only moves
// the issue in time — it shifts the whole span or resizes one end; a gesture with
// no change opens the issue. Moving an issue between sections and reordering it
// is the label column's drag (useIssueReorder).
// `preview` is the in-progress span for the dragged issue.
export function useTimelineDrag({
  project,
  dayW,
  onOpenIssue,
}: {
  project: ProjectDetail;
  dayW: number;
  onOpenIssue: (id: number) => void;
}) {
  const updateIssue = useUpdateIssue(project.project.key);
  const [preview, setPreview] = useState<{ issueId: number; start: Date; end: Date } | null>(null);

  function beginDrag(e: React.PointerEvent, issue: Issue, mode: TimelineDragMode) {
    e.preventDefault();
    e.stopPropagation();
    const span = effSpan(issue);
    const session: DragSession = {
      startX: e.clientX,
      origStart: span.start,
      origEnd: span.end,
      curStart: span.start,
      curEnd: span.end,
      deltaDays: 0,
    };

    const onMove = (ev: PointerEvent) => {
      const deltaDays = Math.round((ev.clientX - session.startX) / dayW);
      session.deltaDays = deltaDays;
      let start = session.origStart;
      let end = session.origEnd;
      if (mode === 'move') {
        start = addDays(session.origStart, deltaDays);
        end = addDays(session.origEnd, deltaDays);
      } else if (mode === 'start') {
        start = addDays(session.origStart, deltaDays);
        if (start > end) start = end;
      } else {
        end = addDays(session.origEnd, deltaDays);
        if (end < start) end = start;
      }
      session.curStart = start;
      session.curEnd = end;
      setPreview({ issueId: issue.id, start, end });
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setPreview(null);

      // Nothing moved — treat the gesture as a click that opens the issue.
      if (session.deltaDays === 0) {
        onOpenIssue(issue.id);
        return;
      }
      const patch: IssuePatch = {};
      if (mode === 'move') {
        patch.startDate = toDateStr(session.curStart);
        patch.dueDate = toDateStr(session.curEnd);
      } else if (mode === 'start') {
        patch.startDate = toDateStr(session.curStart);
      } else {
        patch.dueDate = toDateStr(session.curEnd);
      }
      updateIssue.mutate({ id: issue.id, patch });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  return { preview, beginDrag };
}
