import type { MentionCandidate } from '@/lib/api/endpoints/mentions';

// The candidates whose name or handle holds the text typed after "@", as many as the
// menu shows.
export function matchMentionCandidates(
  candidates: MentionCandidate[],
  query: string,
): MentionCandidate[] {
  const needle = query.toLowerCase();
  return candidates
    .filter(
      (c) => c.name.toLowerCase().includes(needle) || c.username.toLowerCase().includes(needle),
    )
    .slice(0, 8);
}
