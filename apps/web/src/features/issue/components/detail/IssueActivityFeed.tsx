import { useTranslations } from 'next-intl';
import type { Column } from '@/lib/api/endpoints/columns';
import type { Assignee } from '@/lib/api/endpoints/projects';
import { useSession } from '@/lib/auth-client';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { type ActivityFeedView, type ActivityTab } from '../../hooks/useActivityFeedView';
import CommentComposer, { type ComposerContext } from './CommentComposer';
import IssueActivityToolbar from './IssueActivityToolbar';
import IssueFeedList from './IssueFeedList';
import IssueGroupedFeed from './IssueGroupedFeed';

// The issue's activity log: a comment composer over the entries, which the tabs narrow
// to comments, the change log or the work log. Grouping by status and the order apply
// to every tab. Both shapes page 25 at a time.

const EMPTY_TEXT = {
  all: 'noActivity',
  comments: 'noComments',
  history: 'noHistory',
  worklog: 'noWorklog',
} as const satisfies Record<ActivityTab, string>;

export default function IssueActivityFeed({
  issueId,
  assignees,
  columns,
  imageByUserId,
  view,
}: {
  issueId: number;
  assignees: Assignee[];
  columns: Column[];
  imageByUserId: Map<string, string | null>;
  view: ActivityFeedView;
}) {
  const tIssue = useTranslations('issue');
  const t = useTranslations('issue.comments');
  const { data: session } = useSession();

  const user = session?.user ?? null;
  const composer: ComposerContext = {
    issueId,
    assignees,
    authorName: user?.name || user?.email || t('you'),
    authorImage: (user as { image?: string | null } | null)?.image ?? null,
  };
  const emptyText = tIssue(EMPTY_TEXT[view.tab]);

  return (
    <div className="mt-6 border-t pt-5">
      <h3 className="mb-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {tIssue('activityHeading')}
      </h3>

      <CommentComposer {...composer} />

      {view.ready && (
        <Tabs
          value={view.tab}
          onValueChange={(value) => view.setTab(value as ActivityTab)}
          className="mt-5 gap-3"
        >
          <IssueActivityToolbar issueId={issueId} view={view} />
          <TabsContent value={view.tab}>
            {view.grouped ? (
              <IssueGroupedFeed
                issueId={issueId}
                slice={view.slice}
                columns={columns}
                imageByUserId={imageByUserId}
                composer={composer}
                emptyText={emptyText}
              />
            ) : (
              <IssueFeedList
                issueId={issueId}
                slice={view.slice}
                imageByUserId={imageByUserId}
                composer={composer}
                emptyText={emptyText}
              />
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
