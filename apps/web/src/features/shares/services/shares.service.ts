import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  disableDocumentShare,
  disableIssueShare,
  disableViewShare,
  listProjectShares,
  revokeProjectShares,
} from '@/lib/api/endpoints/share';

export type ShareKind = 'issues' | 'views' | 'documents';

const sharesKey = (projectKey: string) => ['project-shares', projectKey] as const;

export function useProjectSharesQuery(projectKey: string) {
  return useQuery({
    queryKey: sharesKey(projectKey),
    queryFn: () => listProjectShares(projectKey),
    enabled: projectKey !== '',
  });
}

const REVOKE: Record<ShareKind, (id: number) => Promise<void>> = {
  issues: disableIssueShare,
  views: disableViewShare,
  documents: disableDocumentShare,
};

export function useRevokeShare(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, id }: { kind: ShareKind; id: number }) => REVOKE[kind](id),
    onSuccess: () => qc.invalidateQueries({ queryKey: sharesKey(projectKey) }),
  });
}

export function useRevokeAllShares(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => revokeProjectShares(projectKey),
    onSuccess: () => qc.invalidateQueries({ queryKey: sharesKey(projectKey) }),
  });
}
