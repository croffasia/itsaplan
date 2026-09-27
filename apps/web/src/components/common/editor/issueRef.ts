export type IssueRefPart =
  { kind: 'text'; text: string } | { kind: 'issue'; key: string; sequence: number };

let cached: { id: string; pattern: RegExp | null } | null = null;

// Keys are uppercase (see utils/projectKey), so a lowercase "ops-7" stays text. Longest
// key first, so a project AB is not read as project A in "AB-1".
function issueRefPattern(keys: readonly string[]): RegExp | null {
  const id = keys.join(',');
  if (cached?.id === id) return cached.pattern;
  const valid = [...new Set(keys.filter((key) => /^[A-Z0-9]{1,10}$/.test(key)))].sort(
    (a, b) => b.length - a.length,
  );
  const pattern = valid.length
    ? new RegExp(`(?<![A-Za-z0-9])(${valid.join('|')})-([1-9]\\d*)(?![A-Za-z0-9])`, 'g')
    : null;
  cached = { id, pattern };
  return pattern;
}

export function splitIssueRefs(text: string, keys: readonly string[]): IssueRefPart[] {
  const pattern = issueRefPattern(keys);
  if (!pattern) return [{ kind: 'text', text }];
  const parts: IssueRefPart[] = [];
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > cursor) parts.push({ kind: 'text', text: text.slice(cursor, match.index) });
    parts.push({ kind: 'issue', key: match[1]!, sequence: Number(match[2]) });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) parts.push({ kind: 'text', text: text.slice(cursor) });
  return parts;
}
