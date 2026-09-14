import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { MindRecall } from '@/lib/api';
import { formatClock } from '../utils/mind';

export default function MindRecallsCard({ recalls }: { recalls: MindRecall[] }) {
  return (
    <Card className="gap-3 py-5 shadow-none">
      <CardHeader className="flex grid-cols-none flex-row items-baseline justify-between px-5">
        <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Recently recalled
        </CardTitle>
        <span className="text-xs text-muted-foreground">who read what</span>
      </CardHeader>
      <CardContent className="px-5">
        {recalls.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nothing has read the memory yet. Agents record a recall every time they do.
          </p>
        ) : (
          <ul className="space-y-3">
            {recalls.map((recall) => (
              <li key={recall.id} className="flex gap-3 text-sm">
                <span className="w-11 shrink-0 pt-0.5 text-xs text-muted-foreground tabular-nums">
                  {formatClock(recall.createdAt)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{recall.actor}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {recall.query
                      ? `asked "${recall.query}"`
                      : (recall.factTitle ?? 'read the memory')}
                  </span>
                </span>
                <span className="shrink-0 self-start text-xs text-muted-foreground">
                  {recall.actorKind}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
