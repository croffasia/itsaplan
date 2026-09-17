'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, KeyRound, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/hooks/usePermissions';
import { useShell } from '@/context/shellContext';
import { serversPath } from '@/utils/paths';
import ServerFileBrowser from './components/ServerFileBrowser';
import ServerMetricsPanel from './components/ServerMetricsPanel';
import ServerTerminal from './components/ServerTerminal';
import { useServersQuery } from './services/servers.service';

// The console is a full-height three-pane view: the shell on the left, and the
// machine's files and counters stacked on the right. It fills the shell's content
// area rather than sitting in a scrolling page, so the terminal gets the height.
export default function ServerConsolePage() {
  const params = useParams();
  const { project } = useShell();
  const { can } = usePermissions();
  const projectKey = project?.project.key ?? '';
  const serverId = Number(Array.isArray(params.serverId) ? params.serverId[0] : params.serverId);

  const serversQuery = useServersQuery(projectKey);

  if (!project || serversQuery.isLoading) return <Skeleton className="m-6 flex-1" />;
  if (!can('servers', 'edit')) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Opening a terminal needs edit access to Servers.
      </div>
    );
  }

  const server = (serversQuery.data ?? []).find((item) => item.id === serverId);
  if (!server) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        This server is not in this project.
        <Button asChild variant="outline" size="sm">
          <Link href={serversPath(projectKey)}>Back to servers</Link>
        </Button>
      </div>
    );
  }

  const pinned = server.hostKeyFingerprint != null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5">
        <Button asChild variant="ghost" size="icon" className="size-7 shrink-0">
          <Link href={serversPath(projectKey)} aria-label="Back to servers">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{server.label}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {server.username}@{server.host}
            {server.port !== 22 && `:${server.port}`}
            {server.customerName && ` · ${server.customerName}`}
          </p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <Badge variant="outline" className="gap-1 font-normal">
            <KeyRound className="size-3" />
            {server.authType === 'key' ? 'Key' : 'Password'}
          </Badge>
          <Badge
            variant={pinned ? 'secondary' : 'outline'}
            className="gap-1 font-normal"
            title={server.hostKeyFingerprint ?? undefined}
          >
            {pinned ? <ShieldCheck className="size-3" /> : <ShieldAlert className="size-3" />}
            {pinned ? 'Host pinned' : 'Not pinned yet'}
          </Badge>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="min-h-0 overflow-hidden rounded-xl border bg-card">
          <ServerTerminal server={server} />
        </div>

        <div className="grid min-h-0 grid-rows-2 gap-3">
          <div className="min-h-0 overflow-hidden rounded-xl border bg-card">
            <ServerFileBrowser serverId={server.id} />
          </div>
          <div className="min-h-0 overflow-hidden rounded-xl border bg-card">
            <ServerMetricsPanel serverId={server.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
