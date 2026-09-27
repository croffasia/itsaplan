import { ArrowDownUp, Layers } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFeedCountsQuery } from '../../services/comments.service';
import type { ActivityFeedView, ActivityTab } from '../../hooks/useActivityFeedView';

// The row over the activity log: its tabs with how many entries each holds, and the
// switches for grouping by status and for the order.

const TABS = [
  { tab: 'all', label: 'feedTabAll' },
  { tab: 'comments', label: 'feedTabComments' },
  { tab: 'history', label: 'feedTabHistory' },
  { tab: 'worklog', label: 'feedTabWorklog' },
] as const satisfies { tab: ActivityTab; label: string }[];

export default function IssueActivityToolbar({
  issueId,
  view,
}: {
  issueId: number;
  view: ActivityFeedView;
}) {
  const t = useTranslations('issue');
  const counts = useFeedCountsQuery(issueId).data;

  return (
    <div className="flex items-center gap-2">
      <TabsList variant="line" className="h-8 min-w-0 flex-1 overflow-x-auto">
        {TABS.map(({ tab, label }) => (
          <TabsTrigger key={tab} value={tab} className="text-[13px]">
            {t(label)}
            {counts && (
              <span className="text-[11px] font-normal text-muted-foreground tabular-nums">
                {counts[tab]}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
      <Button
        variant="ghost"
        size="sm"
        aria-pressed={view.grouped}
        title={t('feedGroupByStatus')}
        onClick={() => view.setGrouped(!view.grouped)}
        className="h-7 gap-1.5 px-2 text-xs text-muted-foreground aria-pressed:bg-accent aria-pressed:text-foreground"
      >
        <Layers className="size-3.5" />
        {t('feedStatus')}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        title={t('feedChangeOrder')}
        onClick={() => view.setOrder(view.order === 'desc' ? 'asc' : 'desc')}
        className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
      >
        <ArrowDownUp className="size-3.5" />
        {t(view.order === 'desc' ? 'feedNewest' : 'feedOldest')}
      </Button>
    </div>
  );
}
