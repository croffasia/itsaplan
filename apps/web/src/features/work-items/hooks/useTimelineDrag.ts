import { useState } from 'react';
import { type Issue, type IssuePatch, type ProjectDetail } from '@/lib/api';
import { addDays, toDateStr } from '@/utils/dates';
import { buildGroups, groupKeyOf } from '@/utils/project';
import { useUpdateIssue } from '@/services/issues.service';
import type { GroupField } from '@/utils/viewSettings';
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
  origGroupKey: string;
  targetGroupKey: string;
}

// Pointer-drag state and handlers for the timeline bars. A drag moves the bar
// (rewriting start/due dates and, on a vertical move, the selected group) or resizes one
// end; a gesture with no change opens the issue. `preview` is the in-progress
// span for the dragged issue; `dropGroupKey` is the group under the cursor
// during a move (null when it matches the origin), used to highlight the target.
export function useTimelineDrag({
  project,
  group,
  dayW,
  onOpenIssue,
}: {
  project: ProjectDetail;
  group: GroupField;
  dayW: number;
  onOpenIssue: (id: number) => void;
}) {
  const updateIssue = useUpdateIssue(project.project.key);
  const groupByKey = new Map(
    buildGroups(project, group).map((issueGroup) => [issueGroup.key, issueGroup]),
  );
  const [preview, setPreview] = useState<{ issueId: number; start: Date; end: Date } | null>(null);
  const [dropGroupKey, setDropGroupKey] = useState<string | null>(null);

  function beginDrag(e: React.PointerEvent, issue: Issue, mode: TimelineDragMode) {
    e.preventDefault();
    e.stopPropagation();
    const span = effSpan(issue);
    const issueGroupKey = groupKeyOf(issue, group);
    const session: DragSession = {
      startX: e.clientX,
      origStart: span.start,
      origEnd: span.end,
      curStart: span.start,
      curEnd: span.end,
      deltaDays: 0,
      origGroupKey: issueGroupKey,
      targetGroupKey: issueGroupKey,
    };

    const onMove = (ev: PointerEvent) => {
      const deltaDays = Math.round((ev.clientX - session.startX) / dayW);
      session.deltaDays = deltaDays;
      let start = session.origStart;
      let end = session.origEnd;
      if (mode === 'move') {
        start = addDays(session.origStart, deltaDays);
        end = addDays(session.origEnd, deltaDays);
        const rowEl = document
          .elementFromPoint(ev.clientX, ev.clientY)
          ?.closest('[data-group-key]');
        if (rowEl) {
          session.targetGroupKey = rowEl.getAttribute('data-group-key') ?? session.origGroupKey;
          setDropGroupKey(
            session.targetGroupKey === session.origGroupKey ? null : session.targetGroupKey,
          );
        }
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
      setDropGroupKey(null);

      const patch: IssuePatch = {};
      if (mode === 'move') {
        // Only rewrite the dates on a horizontal move, so a purely vertical drag
        // changes the status without materializing the inferred start date.
        if (session.deltaDays !== 0) {
          patch.startDate = toDateStr(session.curStart);
          patch.dueDate = toDateStr(session.curEnd);
        }
        if (session.targetGroupKey !== session.origGroupKey) {
          const assign = groupByKey.get(session.targetGroupKey)?.assign;
          if (assign) Object.assign(patch, assign);
        }
      } else if (session.deltaDays !== 0) {
        if (mode === 'start') patch.startDate = toDateStr(session.curStart);
        else patch.dueDate = toDateStr(session.curEnd);
      }

      // Nothing changed — treat the gesture as a click that opens the issue.
      if (Object.keys(patch).length === 0) {
        onOpenIssue(issue.id);
        return;
      }
      updateIssue.mutate({ id: issue.id, patch });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  return { preview, dropGroupKey, beginDrag };
}
