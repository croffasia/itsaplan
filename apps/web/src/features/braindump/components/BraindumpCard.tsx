import { Pin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { api, type BraindumpDestination, type BraindumpEntry } from '@/lib/api';
import { DESTINATION_META, KIND_META, formatDuration, formatTime } from '../utils/braindump';
import BraindumpCardActions from './BraindumpCardActions';

export default function BraindumpCard({
  entry,
  obsidianAvailable,
  canEdit,
  canDelete,
  onRoute,
  onTogglePin,
  onRename,
  onDelete,
}: {
  entry: BraindumpEntry;
  obsidianAvailable: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onRoute: (destination: BraindumpDestination) => void;
  onTogglePin: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const meta = KIND_META[entry.kind];

  return (
    <Card className="gap-0 py-0 shadow-none">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className="gap-1 font-normal">
            <meta.icon className="size-3" />
            {meta.label}
          </Badge>
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatTime(entry.createdAt)}
          </span>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium">{entry.title}</p>
          {entry.body !== entry.title && (
            <p className="text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
              {entry.body}
            </p>
          )}
        </div>

        {entry.hasAudio && (
          <div className="flex items-center gap-2">
            <audio
              controls
              preload="none"
              src={api.braindumpAudioUrl(entry.id)}
              className="h-8 w-full"
            />
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {formatDuration(entry.audioDurationSec)}
            </span>
          </div>
        )}

        {entry.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {entry.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="font-normal">
                #{tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t pt-3">
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            {entry.routedTo ? (
              <>
                {DESTINATION_META[entry.routedTo].target} · {entry.routedRef}
              </>
            ) : (
              'Unsorted'
            )}
          </span>
          <div className="flex shrink-0 items-center gap-0.5">
            {canEdit && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={entry.pinned ? 'Unpin dump' : 'Pin dump'}
                aria-pressed={entry.pinned}
                onClick={onTogglePin}
              >
                <Pin className={cn('size-3.5', entry.pinned && 'fill-current')} />
              </Button>
            )}
            <BraindumpCardActions
              entry={entry}
              obsidianAvailable={obsidianAvailable}
              canEdit={canEdit}
              canDelete={canDelete}
              onRoute={onRoute}
              onRename={onRename}
              onDelete={onDelete}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
