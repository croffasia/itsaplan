import {
  KeyRound,
  MoreHorizontal,
  Pencil,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { ManagedServer } from '@/lib/api';
import { relativeTime } from '../utils/servers';

export default function ServerCard({
  server,
  canEdit,
  canDelete,
  onConnect,
  onEdit,
  onRepin,
  onDelete,
}: {
  server: ManagedServer;
  canEdit: boolean;
  canDelete: boolean;
  onConnect: () => void;
  onEdit: () => void;
  onRepin: () => void;
  onDelete: () => void;
}) {
  const pinned = server.hostKeyFingerprint != null;

  return (
    <Card className={cn('gap-0 py-0 shadow-none', !server.active && 'opacity-60')}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{server.label}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {server.username}@{server.host}
              {server.port !== 22 && `:${server.port}`}
            </p>
          </div>
          {(canEdit || canDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  aria-label={`Actions for ${server.label}`}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit && (
                  <>
                    <DropdownMenuItem onSelect={onEdit}>
                      <Pencil className="size-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={!pinned} onSelect={onRepin}>
                      <ShieldAlert className="size-4" />
                      Forget host key
                    </DropdownMenuItem>
                  </>
                )}
                {canEdit && canDelete && <DropdownMenuSeparator />}
                {canDelete && (
                  <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                    <Trash2 className="size-4" />
                    Remove
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="gap-1 font-normal">
            <KeyRound className="size-3" />
            {server.authType === 'key' ? 'Key' : 'Password'}
          </Badge>
          <Badge variant={pinned ? 'secondary' : 'outline'} className="gap-1 font-normal">
            {pinned ? <ShieldCheck className="size-3" /> : <ShieldAlert className="size-3" />}
            {pinned ? 'Host pinned' : 'Not pinned yet'}
          </Badge>
          {!server.active && (
            <Badge variant="secondary" className="font-normal">
              Paused
            </Badge>
          )}
          {server.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="font-normal">
              #{tag}
            </Badge>
          ))}
        </div>

        {server.notes.length > 0 && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{server.notes}</p>
        )}

        <div className="flex items-center justify-between gap-2 border-t pt-3">
          <span className="text-xs text-muted-foreground">
            last used {relativeTime(server.lastConnectedAt)}
          </span>
          <Button
            type="button"
            size="sm"
            disabled={!server.active || !canEdit}
            onClick={onConnect}
            title={canEdit ? undefined : 'Opening a terminal needs edit access'}
          >
            <Terminal className="size-4" />
            Connect
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
