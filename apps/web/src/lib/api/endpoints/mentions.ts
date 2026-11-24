import { request } from '@/lib/api/core/client';

// Who can be mentioned: a project member or an agent, addressed by their handle.
export interface MentionCandidate {
  userId: string;
  name: string;
  username: string;
  kind: 'member' | 'agent';
}

export type MentionPlace = 'comment' | 'text';

// Where a mention is written, which decides whom it reaches.
export type MentionSource =
  | { projectKey: string; on: 'issue'; place: MentionPlace }
  | { projectKey: string; on: 'document'; documentId: number; place: MentionPlace };

export function listMentionCandidates(source: MentionSource): Promise<MentionCandidate[]> {
  const project = `/projects/${encodeURIComponent(source.projectKey)}`;
  const base = source.on === 'document' ? `${project}/documents/${source.documentId}` : project;
  return request<MentionCandidate[]>(`${base}/mention-candidates?place=${source.place}`);
}
