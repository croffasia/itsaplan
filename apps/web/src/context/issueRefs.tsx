'use client';

import { createContext, useContext, type ReactNode } from 'react';

// The project keys an issue identifier is linked for, and whether the link may read
// the issue it names to show its state and title.
type IssueRefs = { keys: readonly string[]; resolve: boolean };

const IssueRefsContext = createContext<IssueRefs>({ keys: [], resolve: false });

export function IssueRefsProvider({
  keys,
  resolve = true,
  children,
}: {
  keys: readonly string[];
  resolve?: boolean;
  children: ReactNode;
}) {
  return (
    <IssueRefsContext.Provider value={{ keys, resolve }}>{children}</IssueRefsContext.Provider>
  );
}

export function useIssueRefs() {
  return useContext(IssueRefsContext);
}
