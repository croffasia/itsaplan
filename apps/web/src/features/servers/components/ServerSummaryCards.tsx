import { Building2, Server, ShieldAlert, TerminalSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ServerOverview } from '@/lib/api';

export default function ServerSummaryCards({ overview }: { overview: ServerOverview }) {
  const cards = [
    {
      label: 'Servers',
      value: String(overview.total),
      detail: overview.total === 0 ? 'None registered yet' : `${overview.active} reachable`,
      icon: Server,
    },
    {
      label: 'Customers',
      value: String(overview.customers),
      detail: 'with a machine here',
      icon: Building2,
    },
    {
      label: 'Sessions today',
      value: String(overview.sessionsToday),
      detail: 'terminal opens, logged',
      icon: TerminalSquare,
    },
    {
      label: 'Unpinned hosts',
      value: String(overview.unpinned),
      detail: overview.unpinned === 0 ? 'Every host key is pinned' : 'Pinned on first connection',
      icon: ShieldAlert,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="gap-3 py-5 shadow-none">
          <CardHeader className="flex grid-cols-none flex-row items-center justify-between px-5">
            <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {card.label}
            </CardTitle>
            <card.icon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-5">
            <p className="text-2xl font-semibold tracking-tight tabular-nums">{card.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{card.detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
