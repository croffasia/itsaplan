import { useContext, useMemo } from 'react';
import { ShellCtx } from '@/context/shellContext';
import { type MentionCandidate } from '@/lib/tiptap-mention';

// Who the editors offer after an "@": the active project's members and agents that
// have a handle. Read from the payload the Shell loads, so an editor needs no props
// for it. Empty outside a project (the public share pages), where nothing is written.
export function useMentionCandidates(): MentionCandidate[] {
  const assignees = useContext(ShellCtx)?.project?.assignees;
  return useMemo(
    () =>
      (assignees ?? []).flatMap((a) =>
        a.username ? [{ userId: a.userId, name: a.name, username: a.username, kind: a.kind }] : [],
      ),
    [assignees],
  );
}
