import {
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Pause,
  Play,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Competitor } from '@/lib/api';
import { PLATFORM_META, compactNumber, needsAttention, relativeTime } from '../utils/competitors';

export default function CompetitorRow({
  item,
  canEdit,
  canDelete,
  checking,
  onCheck,
  onToggleActive,
  onUntrack,
}: {
  item: Competitor;
  canEdit: boolean;
  canDelete: boolean;
  checking: boolean;
  onCheck: () => void;
  onToggleActive: () => void;
  onUntrack: () => void;
}) {
  const meta = PLATFORM_META[item.platform];
  const change = item.followerChange7d;
  const attention = needsAttention(item);

  return (
    <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-b-0">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border">
        <meta.icon className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <a
            href={meta.profileUrl(item.handle)}
            target="_blank"
            rel="noreferrer noopener"
            className="truncate text-sm font-medium hover:underline"
          >
            @{item.handle}
          </a>
          <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
          {!item.active && (
            <Badge variant="secondary" className="font-normal">
              Paused
            </Badge>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {item.label ? `${item.label} · ` : ''}
          {meta.label}
          {item.tags.length > 0 && ` · ${item.tags.map((tag) => `#${tag}`).join(' ')}`}
        </p>
      </div>

      <div className="w-20 shrink-0 text-right">
        <p className="text-sm font-medium tabular-nums">
          {compactNumber(item.latest?.followers ?? null)}
        </p>
        <p className="text-xs text-muted-foreground">followers</p>
      </div>

      <div className="w-20 shrink-0 text-right">
        <p
          className={cn(
            'text-sm tabular-nums',
            change == null && 'text-muted-foreground',
            change != null && change < 0 && 'text-destructive',
          )}
        >
          {change == null ? '—' : `${change > 0 ? '+' : ''}${compactNumber(Math.abs(change))}`}
        </p>
        <p className="text-xs text-muted-foreground">7d</p>
      </div>

      <div className="w-24 shrink-0 text-right">
        <p className="text-xs text-muted-foreground">{relativeTime(item.lastCheckedAt)}</p>
        {attention ? (
          <p className="truncate text-xs text-destructive" title={item.lastError ?? undefined}>
            {item.consecutiveFailures > 0 ? 'check failed' : 'no reading yet'}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">tracking</p>
        )}
      </div>

      {(canEdit || canDelete) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              aria-label={`Actions for @${item.handle}`}
            >
              {checking ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <MoreHorizontal className="size-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canEdit && (
              <>
                <DropdownMenuItem disabled={checking} onSelect={onCheck}>
                  <RefreshCw className="size-4" />
                  Check now
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onToggleActive}>
                  {item.active ? <Pause className="size-4" /> : <Play className="size-4" />}
                  {item.active ? 'Pause watching' : 'Resume watching'}
                </DropdownMenuItem>
              </>
            )}
            {canEdit && canDelete && <DropdownMenuSeparator />}
            {canDelete && (
              <DropdownMenuItem variant="destructive" onSelect={onUntrack}>
                <Trash2 className="size-4" />
                Stop tracking
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
