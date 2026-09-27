'use client';

import { createContext, useContext, type ReactNode } from 'react';

// The projects (by ref) an issue identifier is linked for, and whether the link may read
// the issue it names to show its state and title.
type IssueRefs = { refs: readonly string[]; resolve: boolean };

const IssueRefsContext = createContext<IssueRefs>({ refs: [], resolve: false });

export function IssueRefsProvider({
  refs,
  resolve = true,
  children,
}: {
  refs: readonly string[];
  resolve?: boolean;
  children: ReactNode;
}) {
  return (
    <IssueRefsContext.Provider value={{ refs, resolve }}>{children}</IssueRefsContext.Provider>
  );
}

export function useIssueRefs() {
  return useContext(IssueRefsContext);
}
