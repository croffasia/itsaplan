import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ServerSession } from '@/lib/api';
import { formatBytes, relativeTime } from '../utils/servers';

const FAILURE_LABEL: Record<string, string> = {
  host_key_changed: 'host key changed',
  auth_failed: 'credential refused',
  unreachable: 'unreachable',
  timeout: 'timed out',
  shell_failed: 'no shell',
};

export default function ServerSessionsCard({ sessions }: { sessions: ServerSession[] }) {
  return (
    <Card className="gap-3 py-5 shadow-none">
      <CardHeader className="flex grid-cols-none flex-row items-baseline justify-between px-5">
        <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Terminal sessions
        </CardTitle>
        <span className="text-xs text-muted-foreground">who opened what</span>
      </CardHeader>
      <CardContent className="px-5">
        {sessions.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No sessions yet. Every terminal you open is recorded here, including the ones that fail
            to connect.
          </p>
        ) : (
          <ul className="space-y-3">
            {sessions.map((session) => (
              <li key={session.id} className="flex gap-3 text-sm">
                <span
                  className={cn(
                    'mt-1.5 size-1.5 shrink-0 rounded-full',
                    session.status === 'failed' ? 'bg-destructive' : 'bg-muted-foreground/50',
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">{session.serverLabel}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {session.userName ?? 'unknown'}
                    {session.status === 'failed'
                      ? ` · ${FAILURE_LABEL[session.errorCode ?? ''] ?? 'failed'}`
                      : ` · ${formatBytes(session.bytesOut)} out`}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {relativeTime(session.startedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
