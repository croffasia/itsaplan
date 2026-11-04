'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { SharedDocumentIssue } from '@/lib/api/endpoints/share';

// The projects (by ref) an issue identifier is linked for, and whether the link may read
// the issue it names to show its state and title. A public share page has no session to
// read them with and passes the issues it was given, by sequence, in `shared`.
type IssueRefs = {
  refs: readonly string[];
  resolve: boolean;
  shared?: ReadonlyMap<number, SharedDocumentIssue>;
};

const IssueRefsContext = createContext<IssueRefs>({ refs: [], resolve: false });

export function IssueRefsProvider({
  refs,
  resolve = true,
  shared,
  children,
}: {
  refs: readonly string[];
  resolve?: boolean;
  shared?: ReadonlyMap<number, SharedDocumentIssue>;
  children: ReactNode;
}) {
  return (
    <IssueRefsContext.Provider value={{ refs, resolve, shared }}>
      {children}
    </IssueRefsContext.Provider>
  );
}

export function useIssueRefs() {
  return useContext(IssueRefsContext);
}
