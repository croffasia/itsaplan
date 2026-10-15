import type { Issue } from '@/lib/api/endpoints/issues';

export type BranchNameUser = {
  username?: string | null;
  name?: string | null;
  email?: string | null;
};

// The template a project without one of its own suggests. Matches the API's
// DEFAULT_BRANCH_NAME_TEMPLATE.
export const DEFAULT_BRANCH_NAME_TEMPLATE = '{user}/{key}-{title}';

// The current user as a branch segment: the account's username, else the email local
// part (or name) with everything but letters and digits removed.
// "poluosmak.a@gmail.com" -> "poluosmaka". Empty when there is no user.
function userHandle(user: BranchNameUser | undefined): string {
  if (user?.username) return user.username.toLowerCase().replace(/[^a-z0-9._-]+/g, '');
  const base = user?.email ? user.email.split('@')[0] : (user?.name ?? '');
  return base.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// A kebab slug for the branch name: lowercase, non-alphanumeric runs collapsed to a
// single dash, trimmed, capped so the branch stays short.
function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/, '');
}

// Makes a filled-in template a valid git branch name (git check-ref-format): the
// characters git refuses become dashes, and each path segment loses repeated and
// leading or trailing separators. A segment left empty, for example by a placeholder
// with no value, is dropped together with its slash.
function sanitizeBranchName(raw: string): string {
  return raw
    .replace(/@\{/g, '-')
    .replace(/[\s~^:?*[\\\p{Cc}]+/gu, '-')
    .split('/')
    .map((segment) =>
      segment
        .replace(/[-_.]{2,}/g, (run) => run[0])
        .replace(/^[-_.]+|[-_.]+$/g, '')
        .replace(/\.lock$/i, '-lock'),
    )
    .filter(Boolean)
    .join('/');
}

// The branch name the issue actions suggest, from the project's template. The
// placeholders are {user} (the current user's username), {key} (the issue key,
// lowercase), {title} (a slug of the title) and {cycle} (a slug of the issue's cycle).
// An unknown placeholder fills in as empty. When nothing is left, the issue key is.
export function buildIssueBranchName(
  issue: Pick<Issue, 'identifier' | 'title'> & { cycle?: { name: string } | null },
  user?: BranchNameUser,
  template: string = DEFAULT_BRANCH_NAME_TEMPLATE,
): string {
  const key = issue.identifier.toLowerCase();
  const values: Record<string, string> = {
    user: userHandle(user),
    key,
    title: slug(issue.title),
    cycle: slug(issue.cycle?.name ?? ''),
  };
  const filled = template.replace(/\{(\w+)\}/g, (_, name: string) => values[name] ?? '');
  return sanitizeBranchName(filled) || key;
}
