import { request } from '@/lib/api/core/client';
import type { Checklist } from '@/lib/api/endpoints/checklists';

export interface AiAssistSettings {
  credentialId: number | null;
  model: string | null;
}

export type DraftStateType = 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';

export interface BoardDraft {
  columns: { name: string; stateType: DraftStateType }[];
  issues: { title: string; description: string; column: string; dueDate: string | null }[];
}

export interface ChecklistDraft {
  title: string;
  items: string[];
}

export const getAiAssistSettings = (teamId: number) =>
  request<AiAssistSettings>(`/teams/${teamId}/ai-assist`);

export const setAiAssistSettings = (
  teamId: number,
  input: { credentialId: number | null; model?: string },
) =>
  request<AiAssistSettings>(`/teams/${teamId}/ai-assist`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });

export const getAiAssistStatus = (projectKey: string) =>
  request<{ enabled: boolean }>(`/projects/${encodeURIComponent(projectKey)}/ai`);

export const draftBoard = (projectKey: string, prompt: string) =>
  request<BoardDraft>(`/projects/${encodeURIComponent(projectKey)}/ai/board`, {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });

export const applyBoard = (projectKey: string, draft: BoardDraft) =>
  request<{ columns: number; issues: number }>(
    `/projects/${encodeURIComponent(projectKey)}/ai/board/apply`,
    { method: 'POST', body: JSON.stringify(draft) },
  );

export const draftChecklist = (issueId: number) =>
  request<ChecklistDraft>(`/issues/${issueId}/ai/checklist`, { method: 'POST' });

export const applyChecklist = (issueId: number, draft: ChecklistDraft) =>
  request<Checklist>(`/issues/${issueId}/ai/checklist/apply`, {
    method: 'POST',
    body: JSON.stringify(draft),
  });
