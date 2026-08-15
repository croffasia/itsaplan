'use client';

import { Direction } from 'radix-ui';

// Which edge the sidebar sits on: the side the reader starts from. shadcn's
// `Sidebar` defaults to `left` and positions itself with physical offsets, so the
// direction is resolved here and passed in as a prop rather than edited into the
// generated component.
export function useSidebarSide(): 'left' | 'right' {
  return Direction.useDirection() === 'rtl' ? 'right' : 'left';
}
