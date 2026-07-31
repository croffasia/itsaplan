import { useState } from 'react';
import { type Assignee, type Column, type IssueActivityView } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAccountPreferencesQuery } from '@/services/preferences.service';
import CommentComposer from './CommentComposer';
import IssueFeedList from './IssueFeedList';
import IssueGroupedFeed from './IssueGroupedFeed';

// The issue's activity log: a comment composer over the entries, in one of two shapes
// picked by the tabs between them. Both run newest first and page 25 at a time; the
// grouped one splits the entries by the status the issue was in when each was written.

export default function IssueActivityFeed({
  issueId,
  assignees,
  columns,
  imageByUserId,
}: {
  issueId: number;
  assignees: Assignee[];
  columns: Column[];
  imageByUserId: Map<string, string | null>;
}) {
  const { data: session } = useSession();
  const { data: preferences } = useAccountPreferencesQuery();
  // Null until the person picks a shape on this issue, and then it wins over the
  // preference for as long as the issue stays open. Undefined while the preferences
  // are still loading: the entries wait for the saved shape rather than opening in
  // the default one and switching under the reader.
  const [viewHere, setViewHere] = useState<IssueActivityView | null>(null);
  const view = viewHere ?? preferences?.issueActivityView;

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

      {view && (
        <Tabs
          value={view}
          onValueChange={(value) => setViewHere(value as IssueActivityView)}
          className="gap-4"
        >
          <TabsList className="ml-auto h-7 p-[2px]">
            <TabsTrigger value="flat" className="px-2 text-xs">
              Flat
            </TabsTrigger>
            <TabsTrigger value="grouped" className="px-2 text-xs">
              Grouped
            </TabsTrigger>
          </TabsList>
          <TabsContent value="flat">
            <IssueFeedList issueId={issueId} imageByUserId={imageByUserId} />
          </TabsContent>
          <TabsContent value="grouped">
            <IssueGroupedFeed issueId={issueId} columns={columns} imageByUserId={imageByUserId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
