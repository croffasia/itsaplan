import { Link2, Pin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { MindCategory, MindFact, MindStatus } from '@/lib/api';
import { CATEGORY_META, STATUS_LABEL, formatDay } from '../utils/mind';
import MindConfidenceBar from './MindConfidenceBar';
import MindFactActions from './MindFactActions';

export default function MindFactCard({
  fact,
  canEdit,
  canDelete,
  onTogglePin,
  onStatus,
  onCategory,
  onForget,
}: {
  fact: MindFact;
  canEdit: boolean;
  canDelete: boolean;
  onTogglePin: () => void;
  onStatus: (status: MindStatus) => void;
  onCategory: (category: MindCategory) => void;
  onForget: () => void;
}) {
  const meta = CATEGORY_META[fact.category];

  return (
    <Card className={cn('gap-0 py-0 shadow-none', fact.pinned && 'border-foreground/30')}>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {fact.pinned && (
            <Badge variant="secondary" className="gap-1 font-normal">
              <Pin className="size-3" />
              Read first
            </Badge>
          )}
          <Badge variant="outline" className="gap-1 font-normal">
            <meta.icon className="size-3" />
            {meta.label}
          </Badge>
          {fact.status !== 'unverified' && (
            <Badge
              variant={fact.status === 'conflicted' ? 'destructive' : 'secondary'}
              className="font-normal"
            >
              {STATUS_LABEL[fact.status]}
            </Badge>
          )}
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {formatDay(fact.updatedAt)}
          </span>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium">{fact.title}</p>
          {fact.body.length > 0 && (
            <p className="text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
              {fact.body}
            </p>
          )}
        </div>

        {fact.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {fact.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="font-normal">
                #{tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>
              {fact.source === 'braindump'
                ? 'from a capture'
                : fact.source === 'agent'
                  ? 'written by an agent'
                  : (fact.authorName ?? 'added by hand')}
            </span>
            {fact.linksIn + fact.linksOut > 0 && (
              <span className="flex items-center gap-1 tabular-nums">
                <Link2 className="size-3" />
                {fact.linksIn} in · {fact.linksOut} out
              </span>
            )}
            {fact.recallsThisWeek > 0 && (
              <span className="tabular-nums">recalled {fact.recallsThisWeek}× this week</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <MindConfidenceBar confidence={fact.confidence} />
            {canEdit && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={fact.pinned ? 'Unpin fact' : 'Pin fact'}
                aria-pressed={fact.pinned}
                onClick={onTogglePin}
              >
                <Pin className={cn('size-3.5', fact.pinned && 'fill-current')} />
              </Button>
            )}
            <MindFactActions
              fact={fact}
              canEdit={canEdit}
              canDelete={canDelete}
              onStatus={onStatus}
              onCategory={onCategory}
              onForget={onForget}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
