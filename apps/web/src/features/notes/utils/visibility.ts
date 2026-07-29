import { Globe, Lock, StickyNote, Users, type LucideIcon } from 'lucide-react';
import type { NoteBoardVisibility } from '@/lib/api';

// A new board is public or private; access is granted to picked members later,
// on the board itself.
export type NewBoardVisibility = Exclude<NoteBoardVisibility, 'restricted'>;

// How the three board states are labelled wherever a board is shown: the tab and
// switcher icons, and the access picker on the canvas.
export const VISIBILITY_ICON: Record<NoteBoardVisibility, LucideIcon> = {
  public: Globe,
  private: Lock,
  restricted: Users,
};

export const VISIBILITY_LABEL: Record<NoteBoardVisibility, string> = {
  public: 'Public',
  private: 'Private',
  restricted: 'Restricted',
};

export const VISIBILITY_HINT: Record<NoteBoardVisibility, string> = {
  public: 'Every project member can see this board',
  private: 'Only its creator can see this board',
  restricted: 'Only its creator and the chosen members can see this board',
};

// The icon for a board in the tab strip and the switcher, where a public board is
// the plain board icon — the globe is kept for the access control on the canvas,
// which reads as a state to change rather than a label.
export function boardListIcon(visibility: NoteBoardVisibility): LucideIcon {
  return visibility === 'public' ? StickyNote : VISIBILITY_ICON[visibility];
}
