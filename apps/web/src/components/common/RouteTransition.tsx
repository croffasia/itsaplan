'use client';

import { ViewTransition, type ReactNode } from 'react';

// Native React 19.2 view transitions around the Shell's routed body. Enter/exit
// cover a swap (board → issue page); `default="none"` leaves in-place updates
// unanimated so a refetch does not flash the whole view.
export default function RouteTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="auto" exit="auto" default="none">
      {children}
    </ViewTransition>
  );
}
