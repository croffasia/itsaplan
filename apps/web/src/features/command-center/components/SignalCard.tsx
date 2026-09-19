'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight, BellOff, Clock, Info, Undo2 } from 'lucide-react';
import type { CommandSignal, SignalSeverity } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SEVERITY: Record<
  SignalSeverity,
  { icon: typeof AlertTriangle; label: string; edge: string; mark: string }
> = {
  critical: {
    icon: AlertTriangle,
    label: 'Past due',
    edge: 'border-l-destructive',
    mark: 'text-destructive',
  },
  attention: {
    icon: Clock,
    label: 'Today',
    edge: 'border-l-foreground/60',
    mark: 'text-foreground',
  },
  info: {
    icon: Info,
    label: 'Worth knowing',
    edge: 'border-l-border',
    mark: 'text-muted-foreground',
  },
};

// One thing that wants attention. `featured` is the card at the top of the page:
// the same content, given the room to be read first.
export default function SignalCard({
  signal,
  featured = false,
  busy,
  onSnooze,
  onRestore,
}: {
  signal: CommandSignal;
  featured?: boolean;
  busy: boolean;
  onSnooze: (signal: CommandSignal) => void;
  onRestore: (signal: CommandSignal) => void;
}) {
  const severity = SEVERITY[signal.severity];
  const Icon = severity.icon;
  const snoozed = signal.snoozedUntil !== null;

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border border-l-[3px] bg-card p-4',
        severity.edge,
        featured && 'sm:p-5',
        snoozed && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn('mt-0.5 size-4 shrink-0', severity.mark)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className={cn('font-semibold tabular-nums', featured ? 'text-3xl' : 'text-xl')}>
              {signal.count}
            </span>
            <h3 className={cn('min-w-0 font-medium', featured ? 'text-base' : 'text-sm')}>
              {signal.title}
            </h3>
          </div>
          <p className={cn('mt-1 text-muted-foreground', featured ? 'text-sm' : 'text-xs')}>
            {signal.detail}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <Button asChild size="sm" variant={featured ? 'default' : 'outline'}>
          <Link href={signal.href}>
            Open
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
        {snoozed ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => onRestore(signal)}
            className="text-muted-foreground"
          >
            <Undo2 className="size-3.5" />
            Bring back
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => onSnooze(signal)}
            className="text-muted-foreground"
            title="Hide this until tomorrow"
          >
            <BellOff className="size-3.5" />
            Later
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{severity.label}</span>
      </div>
    </div>
  );
}
