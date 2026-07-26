import { type Assignee } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import CommentComposer from './CommentComposer';
import IssueFeedList from './IssueFeedList';

// The issue's activity log: a comment composer over the flat feed of comments and
// change entries, newest first. The status timeline sits above it as its own block.

export default function IssueActivityFeed({
  issueId,
  assignees,
  imageByUserId,
}: {
  issueId: number;
  assignees: Assignee[];
  imageByUserId: Map<string, string | null>;
}) {
  const { data: session } = useSession();

  const user = session?.user ?? null;
  const authorName = user?.name || user?.email || 'You';
  const authorImage = (user as { image?: string | null } | null)?.image ?? null;

  return (
    <div className="mt-6 border-t pt-5">
      <h3 className="mb-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Activity
      </h3>

      <CommentComposer
        issueId={issueId}
        assignees={assignees}
        authorName={authorName}
        authorImage={authorImage}
      />

      <IssueFeedList issueId={issueId} imageByUserId={imageByUserId} />
    </div>
  );
}
