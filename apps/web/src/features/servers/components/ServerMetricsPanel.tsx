'use client';

import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatUptime } from '../utils/servers';
import { useServerMetricsQuery } from '../services/servers.service';

function Meter({ label, percent, detail }: { label: string; percent: number; detail: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs tracking-wide text-muted-foreground uppercase">{label}</span>
        <span className="text-sm font-semibold tabular-nums">{Math.round(percent)}%</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full',
            percent > 90 ? 'bg-destructive' : 'bg-foreground/70',
          )}
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-muted-foreground tabular-nums">{detail}</p>
    </div>
  );
}

const GB = 1024 * 1024;

export default function ServerMetricsPanel({ serverId }: { serverId: number }) {
  const query = useServerMetricsQuery(serverId, true);
  const metrics = query.data;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          System
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label="Refresh counters"
          onClick={() => void query.refetch()}
        >
          <RefreshCw className={cn('size-3.5', query.isFetching && 'animate-spin')} />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {query.isLoading ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Reading the counters…
          </p>
        ) : query.isError || !metrics ? (
          <p className="text-xs text-muted-foreground">
            Could not read the counters. This works on Linux hosts where /proc is readable.
          </p>
        ) : (
          <div className="space-y-4">
            <Meter
              label="CPU"
              percent={metrics.cpuPercent}
              detail={`${metrics.cpuCount} cores · load ${metrics.loadAverage.join(' ')}`}
            />
            <Meter
              label="Memory"
              percent={
                metrics.memoryTotalKb > 0 ? (metrics.memoryUsedKb / metrics.memoryTotalKb) * 100 : 0
              }
              detail={`${(metrics.memoryUsedKb / GB).toFixed(1)} of ${(metrics.memoryTotalKb / GB).toFixed(1)} GiB`}
            />
            <Meter
              label="Disk"
              percent={
                metrics.diskTotalKb > 0 ? (metrics.diskUsedKb / metrics.diskTotalKb) * 100 : 0
              }
              detail={`${(metrics.diskUsedKb / GB).toFixed(1)} of ${(metrics.diskTotalKb / GB).toFixed(1)} GiB on /`}
            />

            <dl className="space-y-1.5 border-t pt-3 text-xs">
              {[
                ['Hostname', metrics.hostname],
                ['OS', metrics.os],
                ['Kernel', metrics.kernel],
                ['Uptime', formatUptime(metrics.uptimeSeconds)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="shrink-0 text-muted-foreground">{label}</dt>
                  <dd className="min-w-0 truncate text-right font-mono">{value || '—'}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
