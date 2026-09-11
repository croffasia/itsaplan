'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Issue } from '@/lib/api/endpoints/issues';

// A subtask never shows as a card or a row of its own: it is rendered under its
// parent, the way a relation is. The layouts read the project's issues before the
// filter bar narrows them, so a parent shows every subtask it has.
const SubtaskContext = createContext<Map<number, Issue[]>>(new Map());

// Every issue by id, which is how a subtask resolves the parent it names.
const IssueContext = createContext<Map<number, Issue>>(new Map());

// Whether a card starts with its subtasks folded. Read by the cards rather than
// passed down, which would thread one boolean through every layout between the
// board and the card.
const CollapsedContext = createContext(false);

const NONE: Issue[] = [];

// Holds the project's subtasks by parent for the cards and rows below. Empty
// while the Subtasks display option is off, which is what leaves a subtask
// visible only inside its parent issue.
export function SubtasksProvider({
  issues,
  enabled,
  collapsed = false,
  children,
}: {
  issues: Issue[];
  enabled: boolean;
  collapsed?: boolean;
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
  const byId = useMemo(() => new Map(issues.map((issue) => [issue.id, issue])), [issues]);
  return (
    <IssueContext.Provider value={byId}>
      <CollapsedContext.Provider value={collapsed}>
        <SubtaskContext.Provider value={byParent}>{children}</SubtaskContext.Provider>
      </CollapsedContext.Provider>
    </IssueContext.Provider>
  );
}

// Whether cards start with their subtasks folded. A card may unfold itself from
// there, until this changes again.
export function useSubtasksCollapsed(): boolean {
  return useContext(CollapsedContext);
}

export interface SubtaskFold {
  open: boolean;
  toggle: () => void;
}

// Whether one card or row shows its subtasks. It follows the display setting until
// this one is folded or unfolded by hand; changing the setting takes that back, so
// the switch moves every card and row at once. Nothing is stored: a reload starts
// from the setting again.
export function useSubtaskFold(): SubtaskFold {
  const collapsed = useSubtasksCollapsed();
  const [unfolded, setUnfolded] = useState<boolean | null>(null);
  useEffect(() => setUnfolded(null), [collapsed]);
  const open = unfolded ?? !collapsed;
  return { open, toggle: () => setUnfolded(!open) };
}

// One issue's fold, shared by the parts that draw it. The Timeline needs this: the
// chevron sits on the issue row and the rows it folds are its siblings, so neither
// can own the state. A card and a table row draw both halves themselves and call
// useSubtaskFold directly.
const FoldContext = createContext<SubtaskFold>({ open: true, toggle: () => {} });

export function SubtaskFoldProvider({
  value,
  children,
}: {
  value: SubtaskFold;
  children: ReactNode;
}) {
  return <FoldContext.Provider value={value}>{children}</FoldContext.Provider>;
}

export function useIssueSubtaskFold(): SubtaskFold {
  return useContext(FoldContext);
}

// The issue's subtasks, by issue number. Empty for a subtask, which has none.
export function useSubtasks(issueId: number): Issue[] {
  return useContext(SubtaskContext).get(issueId) ?? NONE;
}

// The issue a subtask belongs to. Undefined for an issue that stands on its own,
// and for one whose parent is archived and therefore not on the board.
export function useParentIssue(parentId: number | null): Issue | undefined {
  const byId = useContext(IssueContext);
  return parentId === null ? undefined : byId.get(parentId);
}
