import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  completeSlackLink,
  getSlackAccount,
  startSlackLink,
  unlinkSlackAccount,
} from '@/lib/api/endpoints/slack';
import { qk } from '@/services/queryKeys';

// The session member's Slack account for a project, in the Slack workspace of the app
// that serves it.
export function useSlackAccountQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.slackAccount(projectKey),
    queryFn: () => getSlackAccount(projectKey),
  });
}

// Returns the Sign in with Slack address; the browser leaves for it.
export function useStartSlackLink(projectKey: string) {
  return useMutation({ mutationFn: () => startSlackLink(projectKey) });
}

export function useDisconnectSlack(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unlinkSlackAccount(projectKey),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.slackAccount(projectKey) }),
  });
}

// The page Slack sends the member back to renders its own failure.
export function useCompleteSlackLink() {
  return useMutation({
    mutationFn: completeSlackLink,
    meta: { suppressErrorToast: true },
  });
}
