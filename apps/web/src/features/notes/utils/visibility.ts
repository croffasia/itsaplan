import { Globe, Lock, StickyNote, Users, type LucideIcon } from 'lucide-react';
import type { NoteBoardVisibility } from '@/lib/api';

// A new board is public or private; access is granted to picked members later,
// on the board itself.
export type NewBoardVisibility = Exclude<NoteBoardVisibility, 'restricted'>;

// The icons of the three board states, shown on the tab, in the switcher and in
// the access picker on the canvas. Their labels and hints are messages under
// `notes.visibility` and `notes.visibilityHint`.
export const VISIBILITY_ICON: Record<NoteBoardVisibility, LucideIcon> = {
  public: Globe,
  private: Lock,
  restricted: Users,
};

// The icon for a board in the tab strip and the switcher, where a public board is
// the plain board icon — the globe is kept for the access control on the canvas,
// which reads as a state to change rather than a label.
export function boardListIcon(visibility: NoteBoardVisibility): LucideIcon {
  return visibility === 'public' ? StickyNote : VISIBILITY_ICON[visibility];
}
