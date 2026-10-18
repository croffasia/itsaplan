import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type BoardDraft,
  type ChecklistDraft,
  applyBoard,
  applyChecklist,
  draftBoard,
  draftChecklist,
  getAiAssistSettings,
  getAiAssistStatus,
  setAiAssistSettings,
} from '@/lib/api/endpoints/ai-assist';
import { qk } from '@/services/queryKeys';

const settingsKey = (teamId: number) => ['aiAssist', 'team', teamId] as const;

export function useAiAssistStatusQuery(projectKey: string) {
  return useQuery({
    queryKey: ['aiAssist', 'project', projectKey],
    queryFn: () => getAiAssistStatus(projectKey),
    enabled: projectKey.length > 0,
  });
}

export function useAiAssistSettingsQuery(teamId: number) {
  return useQuery({ queryKey: settingsKey(teamId), queryFn: () => getAiAssistSettings(teamId) });
}

export function useSetAiAssistSettings(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { credentialId: number | null; model?: string }) =>
      setAiAssistSettings(teamId, input),
    onSuccess: (data) => {
      qc.setQueryData(settingsKey(teamId), data);
      void qc.invalidateQueries({ queryKey: ['aiAssist', 'project'] });
    },
  });
}

export function useDraftBoard(projectKey: string) {
  return useMutation({ mutationFn: (prompt: string) => draftBoard(projectKey, prompt) });
}

export function useApplyBoard(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (draft: BoardDraft) => applyBoard(projectKey, draft),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.project(projectKey) });
      void qc.invalidateQueries({ queryKey: qk.boardIssues(projectKey) });
    },
  });
}

export function useDraftChecklist(issueId: number) {
  return useMutation({ mutationFn: () => draftChecklist(issueId) });
}

export function useApplyChecklist(issueId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (draft: ChecklistDraft) => applyChecklist(issueId, draft),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.issue(issueId) });
      void qc.invalidateQueries({ queryKey: qk.feed(issueId) });
    },
  });
}
