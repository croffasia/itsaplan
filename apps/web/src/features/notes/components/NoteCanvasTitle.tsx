import { useEffect, useState } from 'react';
import type { NoteBoard } from '@/lib/api';
import { useShell } from '@/context/shellContext';
import Avatar from '@/components/common/Avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { SaveStatus } from '../hooks/useCanvasAutosave';

const SAVE_STATUS_LABEL: Record<SaveStatus, string> = {
  unsaved: 'Unsaved changes',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
};

// The canvas label overlay. A board created before the creator was recorded (the
// column is newer than the feature) shows no avatar.
export default function NoteCanvasTitle({
  board,
  saveStatus,
}: {
  board: NoteBoard;
  saveStatus: SaveStatus;
}) {
  const { project } = useShell();
  const creator = project?.assignees.find((a) => a.userId === board.createdByUserId);

  // The status stays visible while there are unsaved edits, a save is in flight, or
  // a save failed; a successful "Saved" hides a few seconds later. An open board
  // that has not been edited shows nothing (its initial state is already "saved").
  const [showStatus, setShowStatus] = useState(false);
  useEffect(() => {
    if (saveStatus === 'saved') {
      const timer = setTimeout(() => setShowStatus(false), 3000);
      return () => clearTimeout(timer);
    }
    setShowStatus(true);
  }, [saveStatus]);

  return (
    <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
      {creator && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Avatar name={creator.name} image={creator.image} />
          </TooltipTrigger>
          <TooltipContent>Created by {creator.name}</TooltipContent>
        </Tooltip>
      )}
      <span className="text-sm leading-none font-medium text-foreground">{board.name}</span>
      {showStatus && (
        <span
          className={cn(
            'text-xs leading-none',
            saveStatus === 'error' ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {SAVE_STATUS_LABEL[saveStatus]}
        </span>
      )}
    </div>
  );
}
