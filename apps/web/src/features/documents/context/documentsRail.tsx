'use client';

import { createContext, useContext, type ReactNode } from 'react';

// Whether the Docs rail shows: as a drawer on a narrow screen (`open`), beside the page on a
// wide one (`shown`). The Docs page provides it, so a header deep in the page toggles the rail
// without every component between passing it down.
type DocumentsRail = {
  open: boolean;
  setOpen: (open: boolean) => void;
  shown: boolean;
  toggleShown: () => void;
};

const DocumentsRailContext = createContext<DocumentsRail | null>(null);

export function DocumentsRailProvider({
  children,
  ...rail
}: DocumentsRail & { children: ReactNode }) {
  return <DocumentsRailContext.Provider value={rail}>{children}</DocumentsRailContext.Provider>;
}

// Null outside the Docs page: the inbox shows a page without the rail.
export function useDocumentsRail(): DocumentsRail | null {
  return useContext(DocumentsRailContext);
}
