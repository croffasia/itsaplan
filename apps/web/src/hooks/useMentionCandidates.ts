import { useContext, useMemo } from 'react';
import { ShellCtx } from '@/context/shellContext';
import { useSession } from '@/lib/auth-client';
import type { Assignee } from '@/lib/api/endpoints/projects';
import { type MentionCandidate } from '@/lib/tiptap-mention';
import { isForeignAgent } from '@/utils/foreignAgent';

// An agent is offered only when a mention by this user would start a run: one that
// does not answer mentions, or works only for another member, would stay silent.
export function mentionCandidatesFrom(
  assignees: Assignee[],
  currentUserId: string | null,
): MentionCandidate[] {
  return assignees.flatMap((a) => {
    if (!a.username) return [];
    if (a.kind === 'agent' && (!a.respondsToMention || isForeignAgent(a, currentUserId))) return [];
    return [{ userId: a.userId, name: a.name, username: a.username, kind: a.kind }];
  });
}

// Who the editors offer after an "@": the active project's members and agents that
// have a handle. Read from the payload the Shell loads, so an editor needs no props
// for it. Empty outside a project (the public share pages), where nothing is written.
export function useMentionCandidates(): MentionCandidate[] {
  const assignees = useContext(ShellCtx)?.project?.assignees;
  const { data: session } = useSession();
  const currentUserId = session?.user.id ?? null;
  return useMemo(
    () => mentionCandidatesFrom(assignees ?? [], currentUserId),
    [assignees, currentUserId],
  );
}
