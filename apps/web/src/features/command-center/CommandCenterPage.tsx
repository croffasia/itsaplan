'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { Bot, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/hooks/usePermissions';
import { useShell } from '@/context/shellContext';
import { aiChatPath } from '@/utils/paths';
import { cn } from '@/lib/utils';
import SignalCard from './components/SignalCard';
import {
  useCommandCenterQuery,
  useRestoreSignal,
  useSnoozeSignal,
} from './services/commandCenter.service';

const SNOOZE_HOURS = 24;

export default function CommandCenterPage() {
  const { project } = useShell();
  const { can } = usePermissions();
  const projectKey = project?.project.key ?? '';

  const query = useCommandCenterQuery(projectKey);
  const snooze = useSnoozeSignal(projectKey);
  const restore = useRestoreSignal(projectKey);
  const busy = snooze.isPending || restore.isPending;

  if (!project || query.isLoading) return <Skeleton className="m-6 flex-1" />;

  const data = query.data;
  const active = (data?.signals ?? []).filter((signal) => signal.snoozedUntil === null);
  const snoozed = (data?.signals ?? []).filter((signal) => signal.snoozedUntil !== null);
  const focus = active.find((signal) => signal.id === data?.focusId) ?? active[0];
  const rest = active.filter((signal) => signal.id !== focus?.id);
  const critical = active.filter((signal) => signal.severity === 'critical').length;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-[1400px] flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b pb-5">
          <div className="min-w-0">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">
              {format(new Date(), 'EEEE d MMMM')}
            </p>
            <h1 className="mt-0.5 text-2xl font-semibold">Command Center</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {active.length === 0
                ? 'Nothing is waiting on you right now.'
                : critical > 0
                  ? `${active.length} things want you today, ${critical} of them already past the moment.`
                  : `${active.length} things want you today.`}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Refresh"
              onClick={() => void query.refetch()}
            >
              <RefreshCw className={cn('size-4', query.isFetching && 'animate-spin')} />
            </Button>
            {can('ai_agents', 'read') && (
              <Button asChild variant="outline" size="sm">
                <Link href={aiChatPath(projectKey)}>
                  <Bot className="size-4" />
                  Ask Bob about today
                </Link>
              </Button>
            )}
          </div>
        </header>

        {query.isError ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Could not read the project right now.
          </p>
        ) : active.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
            <CheckCircle2 className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">Clear.</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              No overdue work, no unpaid invoices, no failed runs. This page fills itself back up on
              its own.
            </p>
          </div>
        ) : (
          <>
            {focus && (
              <section className="pt-5">
                <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Start here
                </p>
                <SignalCard
                  signal={focus}
                  featured
                  busy={busy}
                  onSnooze={(signal) => snooze.mutate({ signalId: signal.id, hours: SNOOZE_HOURS })}
                  onRestore={(signal) => restore.mutate(signal.id)}
                />
              </section>
            )}

            {rest.length > 0 && (
              <section className="pt-6">
                <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Also today
                </p>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {rest.map((signal) => (
                    <SignalCard
                      key={signal.id}
                      signal={signal}
                      busy={busy}
                      onSnooze={(item) => snooze.mutate({ signalId: item.id, hours: SNOOZE_HOURS })}
                      onRestore={(item) => restore.mutate(item.id)}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {snoozed.length > 0 && (
          <section className="pt-8">
            <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Pushed to later
            </p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {snoozed.map((signal) => (
                <SignalCard
                  key={signal.id}
                  signal={signal}
                  busy={busy}
                  onSnooze={(item) => snooze.mutate({ signalId: item.id, hours: SNOOZE_HOURS })}
                  onRestore={(item) => restore.mutate(item.id)}
                />
              ))}
            </div>
          </section>
        )}

        {data && (
          <p className="mt-auto pt-8 text-xs text-muted-foreground">
            Read straight from the project at {format(new Date(data.generatedAt), 'HH:mm')}. A
            signal disappears by itself once the work behind it is done.
          </p>
        )}
      </div>
    </div>
  );
}
