import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  checkGitAccount,
  connectGitAccount,
  disconnectGitAccount,
  listGitAccounts,
} from '@/lib/api/endpoints/gitAccounts';
import { qk } from '@/services/queryKeys';

// The session user's repository host accounts. Read by the account page, the repository
// settings and the comment box, so the service is in the shared layer.

export function useGitAccountsQuery(enabled = true) {
  return useQuery({ queryKey: qk.gitAccounts, queryFn: listGitAccounts, enabled });
}

// The account on the host at `baseUrl`, once the list has loaded; undefined before, and
// for no host, which reads nothing.
export function useGitAccountFor(baseUrl: string | null) {
  const { data } = useGitAccountsQuery(baseUrl != null);
  if (!data || !baseUrl) return undefined;
  return data.find((account) => account.baseUrl === baseUrl) ?? null;
}

// The dialog shows a refusal under the token field itself.
export function useCheckGitAccount() {
  return useMutation({ mutationFn: checkGitAccount, meta: { suppressErrorToast: true } });
}

export function useConnectGitAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: connectGitAccount,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.gitAccounts }),
  });
}

export function useDisconnectGitAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: disconnectGitAccount,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.gitAccounts }),
  });
}
