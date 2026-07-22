// Issue results are filtered and ranked by the server, so their command values
// carry this prefix and their list index. substringFilter recognises the prefix
// and keeps them all visible in server order, bypassing the client-side match it
// applies to the static action items. cmdk trims an item's value, so the prefix
// cannot rely on surrounding whitespace to keep it apart from a command value; the
// colon does that instead, since a command id never contains one.
export const ISSUE_PREFIX = 'issue-hit:';

// Match/rank the static action items. cmdk's default scorer is a fuzzy
// subsequence match; this requires the typed text to appear as a substring. The
// score is the number of occurrences of the query in the value, with a fractional
// tiebreak (< 1) favouring an earlier hit. Server-provided issue items are handled
// separately: they always show (score > 0), ordered by their list index.
export function substringFilter(value: string, search: string): number {
  if (value.startsWith(ISSUE_PREFIX)) {
    const index = Number(value.slice(ISSUE_PREFIX.length));
    return 1 - index / 1e6;
  }
  // cmdk calls this at item registration with the current (on open: empty)
  // search. An empty needle has length 0, which would make the count loop below
  // never advance — bail early. cmdk ignores the score for an empty search
  // anyway (all items show).
  if (!search) return 0;
  const haystack = value.toLowerCase();
  const needle = search.toLowerCase();
  const first = haystack.indexOf(needle);
  if (first === -1) return 0;
  let count = 0;
  for (let i = first; i !== -1; i = haystack.indexOf(needle, i + needle.length)) count++;
  return count + (1 - first / (haystack.length + 1)) * 0.001;
}
