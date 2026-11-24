import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  completeSlackLink,
  listSlackAccounts,
  startSlackLink,
  unlinkSlackAccount,
} from '@/lib/api/endpoints/slack';
import { qk } from '@/services/queryKeys';

// The session user's Slack accounts, one per Slack workspace.
export function useSlackAccountsQuery() {
  return useQuery({ queryKey: qk.slackAccounts, queryFn: () => listSlackAccounts() });
}

// Returns the Sign in with Slack address; the browser leaves for it.
export function useStartSlackLink() {
  return useMutation({ mutationFn: startSlackLink });
}

export function useDisconnectSlack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: unlinkSlackAccount,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.slackAccounts }),
  });
}

// The page Slack sends the user back to renders its own failure.
export function useCompleteSlackLink() {
  return useMutation({
    mutationFn: completeSlackLink,
    meta: { suppressErrorToast: true },
  });
}
