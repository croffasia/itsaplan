import { type ReactNode } from 'react';

// The bare wrapper for a public read-only share page (a shared issue, board or document).
// No app navigation, header or session — just the shared content on a full-height
// background, so the page shows only what is shared.
export default function PublicShareFrame({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
}
