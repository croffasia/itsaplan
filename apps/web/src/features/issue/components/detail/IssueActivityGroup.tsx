import { type FeedGroup } from '@/lib/api';
import { formatDateTime } from '@/utils/dates';
import { durationLabel } from '../../utils/timeline';
import ActivityItemList from './ActivityItemList';
import { type ComposerContext } from './CommentComposer';
import { useTranslations } from 'next-intl';

// One stretch of the grouped activity log: a header carrying the status, how long the
// issue stayed in it and when, over the entries written while it was there.

export default function IssueActivityGroup({
  group,
  color,
  imageByUserId,
  composer,
}: {
  group: FeedGroup;
  color: string;
  imageByUserId: Map<string, string | null>;
  composer: ComposerContext;
}) {
  const t = useTranslations('issue.stats');
  const range = group.to
    ? `${formatDateTime(group.from)} → ${formatDateTime(group.to)}`
    : `since ${formatDateTime(group.from)}`;

  return (
    <li className="relative pl-5">
      <span
        className="absolute top-1 left-0 size-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b pb-2">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium">{group.status ?? t('unknownStatus')}</span>
          {group.repeat && <span className="text-xs text-muted-foreground">· again</span>}
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
            {durationLabel(group.durationMs)}
          </span>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">{range}</span>
      </div>
      <div className="mt-3">
        <ActivityItemList items={group.items} imageByUserId={imageByUserId} composer={composer} />
      </div>
    </li>
  );
}
