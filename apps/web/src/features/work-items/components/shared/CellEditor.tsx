import type { ReactNode, SyntheticEvent } from 'react';
import { noDragProps } from '@/lib/dnd';

const stopPropagation = (e: SyntheticEvent) => e.stopPropagation();

// Wraps a cell's editor. A table row drags on a press and opens its issue on a
// click; a press, a click or a key in the editor or in its popover (a portal, whose
// events still bubble through React to the row) does neither.
export function CellEditor({ children }: { children: ReactNode }) {
  return (
    <div
      className="contents"
      {...noDragProps}
      onClick={stopPropagation}
      onKeyDown={stopPropagation}
    >
      {children}
    </div>
  );
}
