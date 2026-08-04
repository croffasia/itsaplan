'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { type Issue, type IssueLinkInputKind, type IssueLinkRef } from '@/lib/api';
import { LINK_RELATIONS } from '@/utils/issueLinks';

// One relation as a card or a table row shows it: how it reads from the issue it
// is shown on, and the issue on the other end.
export interface IssueLinkView {
  id: number;
  relation: IssueLinkInputKind;
  issue: Issue;
}

const IssueLookupContext = createContext<Map<number, Issue>>(new Map());

const RELATION_ORDER = new Map(LINK_RELATIONS.map((relation, index) => [relation, index]));

// Holds the project's issues for the cards and rows below to resolve the other
// end of a relation against. `issues` are the project's issues before the filter
// bar narrows them, so a relation to a filtered-out issue still reads. Empty
// while the Links display property is off, which is what turns the relations off
// everywhere at once.
export function IssueLinksProvider({
  issues,
  enabled,
  children,
}: {
  issues: Issue[];
  enabled: boolean;
  children: ReactNode;
}) {
  const byId = useMemo(
    () => (enabled ? new Map(issues.map((issue) => [issue.id, issue])) : new Map<number, Issue>()),
    [enabled, issues],
  );
  return <IssueLookupContext.Provider value={byId}>{children}</IssueLookupContext.Provider>;
}

const NONE: IssueLinkView[] = [];

// An issue's relations with the issue on the other end of each resolved, ordered
// by relation and then by that issue's number.
export function useIssueLinks(links: IssueLinkRef[] | undefined): IssueLinkView[] {
  const byId = useContext(IssueLookupContext);
  return useMemo(() => {
    if (!links?.length || byId.size === 0) return NONE;
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
  }, [links, byId]);
}
