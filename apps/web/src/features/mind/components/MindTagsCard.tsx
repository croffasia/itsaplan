import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { MindFact } from '@/lib/api';
import { topTags } from '../utils/mind';

const MAX_TAGS = 10;

export default function MindTagsCard({
  facts,
  onSelect,
}: {
  facts: MindFact[];
  onSelect: (tag: string) => void;
}) {
  const tags = topTags(facts, MAX_TAGS);
  if (tags.length === 0) return null;

  return (
    <Card className="gap-3 py-5 shadow-none">
      <CardHeader className="flex grid-cols-none flex-row items-baseline justify-between px-5">
        <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Tags
        </CardTitle>
        <span className="text-xs text-muted-foreground">most used</span>
      </CardHeader>
      <CardContent className="px-5">
        <div className="flex flex-wrap gap-1.5">
          {tags.map(({ tag, count }) => (
            <Badge key={tag} asChild variant="secondary" className="font-normal">
              <button type="button" onClick={() => onSelect(tag)}>
                #{tag}
                <span className="ml-1 text-muted-foreground tabular-nums">{count}</span>
              </button>
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
