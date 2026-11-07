import { useTranslations } from 'next-intl';
import type { Column } from '@/lib/api/endpoints/columns';
import { useSession } from '@/lib/auth-client';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { type ActivityFeedView, type ActivityTab } from '../../hooks/useActivityFeedView';
import { useCommentAnchor } from '../../hooks/useCommentAnchor';
import { CommentLinkProvider } from '../../context/commentLink';
import CommentComposer, { type ComposerContext } from './CommentComposer';
import IssueActivityToolbar from './IssueActivityToolbar';
import IssueFeedList from './IssueFeedList';
import IssueGroupedFeed from './IssueGroupedFeed';
import IssueAgentRunsPanel from './IssueAgentRunsPanel';

const EMPTY_TEXT = {
  all: 'noActivity',
  comments: 'noComments',
  history: 'noHistory',
  worklog: 'noWorklog',
  agentRuns: 'agentRuns.empty',
} as const satisfies Record<ActivityTab, string>;

export default function IssueActivityFeed({
  issueId,
  projectKey,
  sequenceNumber,
  columns,
  imageByUserId,
  view,
  canReadAgentRuns,
  commentId,
}: {
  issueId: number;
  projectKey: string;
  sequenceNumber: number;
  columns: Column[];
  imageByUserId: Map<string, string | null>;
  view: ActivityFeedView;
  canReadAgentRuns: boolean;
  commentId: number | null;
}) {
  const tIssue = useTranslations('issue');
  const t = useTranslations('issue.comments');
  const { data: session } = useSession();
  const highlightedId = useCommentAnchor(issueId, view, commentId);

  const user = session?.user ?? null;
  const composer: ComposerContext = {
    issueId,
    projectKey,
    authorName: user?.name || user?.email || t('you'),
    authorImage: (user as { image?: string | null } | null)?.image ?? null,
  };
  const emptyText = tIssue(EMPTY_TEXT[view.tab]);

  let content;
  if (view.tab === 'agentRuns') {
    content = <IssueAgentRunsPanel issueId={issueId} canRead={canReadAgentRuns} />;
  } else if (view.grouped) {
    content = (
      <IssueGroupedFeed
        issueId={issueId}
        slice={view.slice}
        columns={columns}
        imageByUserId={imageByUserId}
        composer={composer}
        emptyText={emptyText}
      />
    );
  } else {
    content = (
      <IssueFeedList
        issueId={issueId}
        slice={view.slice}
        imageByUserId={imageByUserId}
        composer={composer}
        emptyText={emptyText}
      />
    );
  }

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
          <IssueActivityToolbar issueId={issueId} view={view} canReadAgentRuns={canReadAgentRuns} />
          <TabsContent value={view.tab}>
            <CommentLinkProvider
              projectKey={projectKey}
              sequenceNumber={sequenceNumber}
              highlightedId={highlightedId}
            >
              {content}
            </CommentLinkProvider>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
