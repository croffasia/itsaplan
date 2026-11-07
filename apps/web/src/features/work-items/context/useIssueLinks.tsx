'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Column } from '@/lib/api/endpoints/columns';
import type {
  BoardIssue,
  Issue,
  IssueLinkInputKind,
  IssueLinkRef,
} from '@/lib/api/endpoints/issues';
import { isBlocked, LINK_RELATIONS } from '@/utils/issueLinks';

// One relation as a card or a table row shows it: how it reads from the issue it
// is shown on, and the issue on the other end.
export interface IssueLinkView {
  id: number;
  relation: IssueLinkInputKind;
  issue: Issue;
}

interface IssueLookup {
  byId: Map<number, Issue>;
  columnById: Map<number, Column>;
  showLinks: boolean;
}

const IssueLookupContext = createContext<IssueLookup>({
  byId: new Map(),
  columnById: new Map(),
  showLinks: false,
});

const RELATION_ORDER = new Map(LINK_RELATIONS.map((relation, index) => [relation, index]));

// Holds the project's issues for the cards and rows below to resolve the other
// end of a relation against. `issues` are the project's issues before the filter
// bar narrows them, so a relation to a filtered-out issue still reads. The Links
// display property turns the relations off everywhere at once, but the blocked
// tint still reads the blockers here.
export function IssueLinksProvider({
  issues,
  columns,
  enabled,
  children,
}: {
  issues: Issue[];
  columns: Column[];
  enabled: boolean;
  children: ReactNode;
}) {
  const lookup = useMemo(
    () => ({
      byId: new Map(issues.map((issue) => [issue.id, issue])),
      columnById: new Map(columns.map((column) => [column.id, column])),
      showLinks: enabled,
    }),
    [issues, columns, enabled],
  );
  return <IssueLookupContext.Provider value={lookup}>{children}</IssueLookupContext.Provider>;
}

const NONE: IssueLinkView[] = [];

// An issue's relations with the issue on the other end of each resolved, ordered
// by relation and then by that issue's number.
export function useIssueLinks(links: IssueLinkRef[] | undefined): IssueLinkView[] {
  const { byId, showLinks } = useContext(IssueLookupContext);
  return useMemo(() => {
    if (!showLinks || !links?.length) return NONE;
    const views = links.flatMap((link) => {
      const issue = byId.get(link.issueId);
      return issue ? [{ id: link.id, relation: link.relation, issue }] : [];
    });
    views.sort(
      (a, b) =>
        RELATION_ORDER.get(a.relation)! - RELATION_ORDER.get(b.relation)! ||
        a.issue.sequenceNumber - b.issue.sequenceNumber,
    );
    return views;
  }, [links, byId, showLinks]);
}

// Whether an issue still open holds this one up (see isBlocked).
export function useIsBlocked(issue: BoardIssue): boolean {
  const { byId, columnById } = useContext(IssueLookupContext);
  return isBlocked(issue, byId, columnById);
}
