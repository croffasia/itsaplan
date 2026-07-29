import { Globe, Lock, Maximize2, Minimize2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// Without the right to toggle it, the visibility icon only reports the current
// state; otherwise it names the state the click switches to.
function visibilityCopy(canToggle: boolean, personal: boolean) {
  if (!canToggle) {
    return {
      label: 'Board visibility',
      hint: personal ? 'Private — visible only to you' : 'Public — visible to every project member',
    };
  }
  return personal
    ? { label: 'Make public', hint: 'Make public — visible to every project member' }
    : { label: 'Make private', hint: 'Make private — visible only to you' };
}

export default function NoteCanvasControls({
  canEdit,
  personal,
  canToggleVisibility,
  fullscreen,
  onAddNote,
  onToggleVisibility,
  onToggleFullscreen,
}: {
  canEdit: boolean;
  personal: boolean;
  canToggleVisibility: boolean;
  fullscreen: boolean;
  onAddNote: () => void;
  onToggleVisibility: () => void;
  onToggleFullscreen: () => void;
}) {
  const visibility = visibilityCopy(canToggleVisibility, personal);

  return (
    <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
      {canEdit && (
        <Button variant="secondary" size="sm" onClick={onAddNote}>
          <Plus className="size-4" /> Add note
        </Button>
      )}
      <Tooltip>
        <TooltipTrigger
          aria-label={visibility.label}
          aria-disabled={!canToggleVisibility}
          // A `disabled` button takes no pointer events, so its tooltip would never
          // open — drop the handler instead, the state hint stays reachable.
          onClick={canToggleVisibility ? onToggleVisibility : undefined}
          className={cn(
            'flex size-6 items-center justify-center rounded text-muted-foreground',
            canToggleVisibility ? 'hover:bg-accent hover:text-foreground' : 'cursor-default',
          )}
        >
          {personal ? <Lock className="size-3.5" /> : <Globe className="size-3.5" />}
        </TooltipTrigger>
        <TooltipContent>{visibility.hint}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          onClick={onToggleFullscreen}
          className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {fullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
        </TooltipTrigger>
        <TooltipContent>{fullscreen ? 'Exit fullscreen' : 'Fullscreen'}</TooltipContent>
      </Tooltip>
    </div>
  );
}
