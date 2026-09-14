import { FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { MindOverview } from '@/lib/api';

export default function MindMostLinkedCard({ hubs }: { hubs: MindOverview['mostLinked'] }) {
  return (
    <Card className="gap-3 py-5 shadow-none">
      <CardHeader className="flex grid-cols-none flex-row items-baseline justify-between px-5">
        <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Most linked
        </CardTitle>
        <span className="text-xs text-muted-foreground">top hubs</span>
      </CardHeader>
      <CardContent className="px-5">
        {hubs.length === 0 ? (
          <p className="text-xs text-muted-foreground">No facts are linked yet.</p>
        ) : (
          <ul className="space-y-2.5">
            {hubs.map((hub) => (
              <li key={hub.id} className="flex items-center gap-2 text-sm">
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{hub.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {hub.linksIn} in · {hub.linksOut} out
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
