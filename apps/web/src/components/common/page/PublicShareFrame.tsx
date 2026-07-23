import { type ReactNode } from 'react';

// The bare wrapper for a public read-only share page (a shared issue or board).
// No app navigation, header or session — just the shared content on a full-height
// background, so the page shows only the board or the issue.
export default function PublicShareFrame({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
}
