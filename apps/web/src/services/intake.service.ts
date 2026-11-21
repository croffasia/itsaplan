import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  acceptIntakeRequest,
  createIntakeComment,
  createIntakeRequest,
  declineIntakeRequest,
  deleteIntakeRequest,
  getIntakeRequest,
  getIntakeSummary,
  listIntakeRequests,
  markIntakeDuplicate,
  snoozeIntakeRequest,
  uploadIntakeAttachment,
  type AcceptIntakeInput,
  type CreateIntakeInput,
  type ListIntakeParams,
} from '@/lib/api/endpoints/intake';
import { qk } from '@/services/queryKeys';

export const intakeKeys = {
  all: (projectKey: string) => ['intake', projectKey] as const,
  list: (projectKey: string, params: ListIntakeParams) =>
    ['intake', projectKey, 'list', params] as const,
  summary: (projectKey: string) => ['intake', projectKey, 'summary'] as const,
  detail: (requestId: number) => ['intake', 'detail', requestId] as const,
};

export function useIntakeRequestsQuery(projectKey: string | null, params: ListIntakeParams) {
  return useQuery({
    queryKey: projectKey ? intakeKeys.list(projectKey, params) : ['intake', 'none'],
    queryFn: () => listIntakeRequests(projectKey!, params),
    enabled: Boolean(projectKey),
  });
}

export function useIntakeSummaryQuery(projectKey: string | null, enabled = true) {
  return useQuery({
    queryKey: projectKey ? intakeKeys.summary(projectKey) : ['intake', 'summary', 'none'],
    queryFn: () => getIntakeSummary(projectKey!),
    enabled: Boolean(projectKey) && enabled,
  });
}

export function useIntakeRequestDetailQuery(requestId: number | null) {
  return useQuery({
    queryKey: requestId != null ? intakeKeys.detail(requestId) : ['intake', 'detail', 'none'],
    queryFn: () => getIntakeRequest(requestId!),
    enabled: requestId != null,
  });
}

export function useIntakeMutations(projectKey: string) {
  const qc = useQueryClient();
  const invalidate = (requestId?: number) => {
    void qc.invalidateQueries({ queryKey: intakeKeys.all(projectKey) });
    if (requestId != null) {
      void qc.invalidateQueries({ queryKey: intakeKeys.detail(requestId) });
    }
  };

  const create = useMutation({
    mutationFn: (input: CreateIntakeInput) => createIntakeRequest(projectKey, input),
    onSuccess: () => invalidate(),
  });

  const accept = useMutation({
    mutationFn: ({ requestId, input }: { requestId: number; input?: AcceptIntakeInput }) =>
      acceptIntakeRequest(requestId, input),
    onSuccess: (_data, vars) => {
      invalidate(vars.requestId);
      void qc.invalidateQueries({ queryKey: qk.boardIssues(projectKey) });
    },
  });

  const decline = useMutation({
    mutationFn: ({ requestId, reason }: { requestId: number; reason?: string | null }) =>
      declineIntakeRequest(requestId, reason),
    onSuccess: (_data, vars) => invalidate(vars.requestId),
  });

  const snooze = useMutation({
    mutationFn: ({ requestId, until }: { requestId: number; until: string }) =>
      snoozeIntakeRequest(requestId, until),
    onSuccess: (_data, vars) => invalidate(vars.requestId),
  });

  const duplicate = useMutation({
    mutationFn: ({ requestId, issueId }: { requestId: number; issueId: number }) =>
      markIntakeDuplicate(requestId, issueId),
    onSuccess: (_data, vars) => invalidate(vars.requestId),
  });

  const remove = useMutation({
    mutationFn: (requestId: number) => deleteIntakeRequest(requestId),
    onSuccess: () => invalidate(),
  });

  const addComment = useMutation({
    mutationFn: ({ requestId, body }: { requestId: number; body: string }) =>
      createIntakeComment(requestId, body),
    onSuccess: (_data, vars) => invalidate(vars.requestId),
  });

  const addAttachment = useMutation({
    mutationFn: ({ requestId, file }: { requestId: number; file: File }) =>
      uploadIntakeAttachment(requestId, file),
    onSuccess: (_data, vars) => invalidate(vars.requestId),
  });

  return { create, accept, decline, snooze, duplicate, remove, addComment, addAttachment };
}
