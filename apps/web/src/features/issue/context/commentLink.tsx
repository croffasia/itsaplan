'use client';

import { createContext, useContext, type ReactNode } from 'react';

// What a comment of the live feed needs to copy its own link and to show that a link
// brought the reader to it. Provided by the feed so the comments deep in its threads
// read it instead of every list between them passing it down.
type CommentLink = { projectKey: string; sequenceNumber: number; highlightedId: number | null };

const CommentLinkContext = createContext<CommentLink | null>(null);

export function CommentLinkProvider({
  projectKey,
  sequenceNumber,
  highlightedId,
  children,
}: CommentLink & { children: ReactNode }) {
  return (
    <CommentLinkContext.Provider value={{ projectKey, sequenceNumber, highlightedId }}>
      {children}
    </CommentLinkContext.Provider>
  );
}

// Null outside the live feed: the share page and the timeline popover offer no link.
export function useCommentLink(): CommentLink | null {
  return useContext(CommentLinkContext);
}
