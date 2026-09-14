import { Card, CardContent } from '@/components/ui/card';
import type { MindOverview } from '@/lib/api';
import MindCoreStats from './MindCoreStats';
import MindGraph from './MindGraph';

export default function MindCoreCard({ overview }: { overview: MindOverview }) {
  return (
    <Card className="gap-0 py-0 shadow-none">
      <CardContent className="p-0">
        <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Memory core
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {overview.totalFacts} facts · {overview.links} links
          </span>
        </div>
        <div className="grid gap-6 p-5 lg:grid-cols-[3fr_2fr]">
          <div className="flex min-h-[13rem] flex-col">
            {overview.mostLinked.length === 0 ? (
              <p className="m-auto max-w-xs text-center text-xs text-muted-foreground">
                Nothing is linked yet. Link two facts and the shape of the memory appears here.
              </p>
            ) : (
              <MindGraph hubs={overview.mostLinked} totalFacts={overview.totalFacts} />
            )}
            <div className="mt-3 flex items-center gap-4 border-t pt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-foreground/70" />
                Memory root
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full border border-foreground/60 bg-card" />
                Hub fact
              </span>
            </div>
          </div>
          <MindCoreStats overview={overview} />
        </div>
      </CardContent>
    </Card>
  );
}
