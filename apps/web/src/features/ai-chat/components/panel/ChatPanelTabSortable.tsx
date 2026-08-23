'use client';

import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { ChatPanelTab } from './ChatPanelTab';
import type { ChatSession } from '../../hooks/useChatSessions';

// A tab of the row in its place, which a drag moves. The drag listeners sit on this
// wrapper rather than on the tab's own buttons: the keyboard sensor takes over Space and
// Enter, which those buttons need for themselves.
export function ChatPanelTabSortable({
  projectKey,
  session,
  active,
  onSelect,
  onClose,
}: {
  projectKey: string;
  session: ChatSession;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  // A tab whose title is being typed does not move: the drag listeners would take the
  // press that puts the caret in the input.
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: session.id,
    disabled: editing,
  });

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        setActivatorNodeRef(node);
      }}
      // Translate, not the full transform: tabs are of different widths, and the scale
      // part of it would squeeze the dragged tab to the width of the one under it.
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn(
        'shrink-0',
        editing ? 'cursor-text' : 'cursor-grab',
        isDragging && 'opacity-40',
      )}
    >
      <ChatPanelTab
        projectKey={projectKey}
        session={session}
        active={active}
        dragging={isDragging}
        editing={editing}
        onEditing={setEditing}
        onSelect={onSelect}
        onClose={onClose}
      />
    </div>
  );
}
