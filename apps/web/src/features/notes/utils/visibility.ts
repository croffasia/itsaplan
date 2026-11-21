import { StickyNote, type LucideIcon } from 'lucide-react';
import { ACCESS_ICON } from '@/components/common/access/accessVisibility';
import type { NoteBoardVisibility } from '@/lib/api/endpoints/noteBoards';

// A new board is public or private; access is granted to picked members later,
// on the board itself.
export type NewBoardVisibility = Exclude<NoteBoardVisibility, 'restricted'>;

// The icon for a board in the tab strip and the switcher, where a public board is
// the plain board icon — the globe is kept for the access control on the canvas,
// which reads as a state to change rather than a label.
export function boardListIcon(visibility: NoteBoardVisibility): LucideIcon {
  return visibility === 'public' ? StickyNote : ACCESS_ICON[visibility];
}
