import type { LinkedRepositoryIssue } from '@/lib/api/endpoints/git';
import { useGitAccountFor } from '@/services/gitAccounts.service';
import { useAccountPreferences, useUpdateAccountPreferences } from '@/services/preferences.service';

// Whether a new comment on this issue should first say it will stay here: the issue
// sends comments to its repository issue, the viewer has no account on that host, and
// they have not turned the notice off. While the accounts load nothing is held back.
export function useUnsentCommentNotice(repositoryIssue: LinkedRepositoryIssue | null) {
  const target =
    repositoryIssue?.pushComments && repositoryIssue.provider !== 'bitbucket'
      ? { provider: repositoryIssue.provider, baseUrl: repositoryIssue.baseUrl }
      : null;
  const account = useGitAccountFor(target?.baseUrl ?? null);
  const { unsentCommentNoticeHidden } = useAccountPreferences();
  const update = useUpdateAccountPreferences();
  return {
    host: target && account === null && !unsentCommentNoticeHidden ? target : null,
    hide: () => update.mutate({ unsentCommentNoticeHidden: true }),
  };
}
