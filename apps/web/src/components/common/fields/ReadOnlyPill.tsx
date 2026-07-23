import { type ReactNode } from 'react';

// Wraps a Pill (or Pill-shaped trigger) for a non-interactive read-only display on
// the public shared pages: the pill shows its current value with no popover or
// click behaviour.
export default function ReadOnlyPill({ children }: { children: ReactNode }) {
  return <span className="pointer-events-none inline-flex">{children}</span>;
}
