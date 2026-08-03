'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { type Issue } from '@/lib/api';

// A subtask never shows as a card or a row of its own: it is rendered under its
// parent, the way a relation is. The layouts read the project's issues before the
// filter bar narrows them, so a parent shows every subtask it has.
const SubtaskContext = createContext<Map<number, Issue[]>>(new Map());

const NONE: Issue[] = [];

// Holds the project's subtasks by parent for the cards and rows below. Empty
// while the Subtasks display option is off, which is what leaves a subtask
// visible only inside its parent issue.
export function SubtasksProvider({
  issues,
  enabled,
  children,
}: {
  issues: Issue[];
  enabled: boolean;
  children: ReactNode;
}) {
  const byParent = useMemo(() => {
    const map = new Map<number, Issue[]>();
    if (!enabled) return map;
    for (const issue of issues) {
      if (issue.parentId === null) continue;
      const list = map.get(issue.parentId);
      if (list) list.push(issue);
      else map.set(issue.parentId, [issue]);
    }
    for (const list of map.values()) list.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    return map;
  }, [enabled, issues]);
  return <SubtaskContext.Provider value={byParent}>{children}</SubtaskContext.Provider>;
}

// The issue's subtasks, by issue number. Empty for a subtask, which has none.
export function useSubtasks(issueId: number): Issue[] {
  return useContext(SubtaskContext).get(issueId) ?? NONE;
}
