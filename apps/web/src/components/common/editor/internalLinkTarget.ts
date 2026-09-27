import { parseIssueIdentifier, projectRefOf } from '@/utils/paths';

export type InternalLinkTarget =
  | { kind: 'project'; projectKey: string }
  | { kind: 'issueId'; id: number }
  | { kind: 'issue' | 'notes' | 'document' | 'view'; projectKey: string; id: number };

function positiveId(value: string | undefined) {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export function internalLinkTarget(url: URL): InternalLinkTarget | null {
  let parts: string[];
  try {
    parts = url.pathname.replace(/\/$/, '').split('/').slice(1).map(decodeURIComponent);
  } catch {
    return null;
  }
  if (parts.some((part) => /[/\\?#\p{Cc}]/u.test(part))) return null;
  // The paths from before keys were per team — /KEY-42, /issue/:id, /project/KEY/…
  // — name the project by its bare key, which the API still resolves.
  if (parts.length === 1) {
    const match = /^(.+)-(\d+)$/.exec(parts[0]!);
    const id = positiveId(match?.[2]);
    return match && id ? { kind: 'issue', projectKey: match[1]!, id } : null;
  }
  if (parts[0] === 'issue' && parts.length === 2) {
    const id = positiveId(parts[1]);
    return id ? { kind: 'issueId', id } : null;
  }
  if (parts[0] === 'project') return projectTarget(parts[1], parts.slice(2));

  const [teamRef, second, ...rest] = parts;
  if (!teamRef || !second) return null;
  if (second === 'issue' && rest.length === 1) {
    const issue = parseIssueIdentifier(rest[0]!);
    const id = positiveId(issue ? String(issue.sequenceNumber) : undefined);
    return issue && id ? { kind: 'issue', projectKey: projectRefOf(teamRef, issue.key), id } : null;
  }
  if (!/^[A-Z][A-Z0-9]*$/.test(second)) return null;
  return projectTarget(projectRefOf(teamRef, second), rest);
}

function projectTarget(projectKey: string | undefined, rest: string[]): InternalLinkTarget | null {
  if (!projectKey) return null;
  if (rest.length === 0) return { kind: 'project', projectKey };
  if (rest.length !== 2) return null;
  const id = positiveId(rest[1]);
  if (!id) return null;
  switch (rest[0]) {
    case 'issue':
      return { kind: 'issue', projectKey, id };
    case 'notes':
      return { kind: 'notes', projectKey, id };
    case 'docs':
      return { kind: 'document', projectKey, id };
    case 'view':
      return { kind: 'view', projectKey, id };
    default:
      return null;
  }
}
