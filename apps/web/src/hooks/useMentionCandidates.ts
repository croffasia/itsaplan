import { useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShellCtx } from '@/context/shellContext';
import {
  listMentionCandidates,
  type MentionCandidate,
  type MentionSource,
} from '@/lib/api/endpoints/mentions';
import { qk } from '@/services/queryKeys';

const NONE: MentionCandidate[] = [];

// Who the "@" menu offers where a mention is written. The api builds the list with the
// rule that then decides whom the mention reaches, so the menu offers nobody a mention
// would leave silent. Empty without a source, for a text no mention reaches, and while
// the list loads.
export function useMentionCandidates(source: MentionSource | null): MentionCandidate[] {
  const query = useQuery({
    queryKey: source ? qk.mentionCandidates(source) : ['mentionCandidates'],
    queryFn: () => listMentionCandidates(source!),
    enabled: source != null,
  });
  return query.data ?? NONE;
}

// The name behind each handle of the active project, lowercased, for the tooltip of a
// mention chip. Empty outside a project (the public share pages).
export function useMentionNames(): Map<string, string> {
  const assignees = useContext(ShellCtx)?.project?.assignees;
  return useMemo(
    () =>
      new Map(
        (assignees ?? []).flatMap((a) =>
          a.username ? [[a.username.toLowerCase(), a.name] as const] : [],
        ),
      ),
    [assignees],
  );
}
