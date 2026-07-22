import type { Issue, ProjectDetail } from '@/lib/api';
import { priorityLabel } from '@/utils/fieldOptions';
import { issuePath } from '@/utils/paths';

// A git-branch-safe handle from the current user: the email local part (or name)
// with everything but letters and digits removed. "poluosmak.a@gmail.com" ->
// "poluosmaka". Empty when there is no user, which drops the branch prefix.
function userHandle(name: string | null | undefined, email: string | null | undefined): string {
  const base = email ? email.split('@')[0] : (name ?? '');
  return base.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// A kebab slug from the issue title for the branch name: lowercase, non-alphanumeric
// runs collapsed to a single dash, trimmed, capped so the branch stays short.
function titleSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/, '');
}

// Builds the prompt copied by "Copy Prompt", matching Linear's format: a lead
// instruction, a suggested branch name, then the issue as XML-like tags with the
// full Markdown description inside <description>. IDs (status, assignee, labels,
// ...) are resolved to human-readable names via the project. Called in the
// browser, so window.location.origin gives the absolute issue URL.
export function buildIssuePrompt(
  issue: Issue,
  project: ProjectDetail,
  user?: { name?: string | null; email?: string | null },
): string {
  const status = project.columns.find((c) => c.id === issue.columnId)?.name;
  const type =
    issue.typeId != null ? project.issueTypes.find((t) => t.id === issue.typeId)?.name : undefined;
  const assignee = issue.assigneeUserId
    ? project.assignees.find((a) => a.userId === issue.assigneeUserId)?.name
    : undefined;
  const delegate = issue.delegateUserId
    ? project.assignees.find((a) => a.userId === issue.delegateUserId)?.name
    : undefined;
  const labels = issue.labelIds
    .map((id) => project.labels.find((l) => l.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  const url = `${window.location.origin}${issuePath(project.project.key, issue.sequenceNumber)}`;

  const handle = userHandle(user?.name, user?.email);
  const slug = titleSlug(issue.title);
  const id = issue.identifier.toLowerCase();
  const branch = `${handle ? `${handle}/` : ''}${slug ? `${id}-${slug}` : id}`;

  const tags: string[] = [
    `<issue identifier="${issue.identifier}">`,
    `<title>${issue.title}</title>`,
  ];
  tags.push('<description>', issue.description.trim(), '</description>');
  if (status) tags.push(`<status>${status}</status>`);
  if (issue.priority) tags.push(`<priority>${priorityLabel(issue.priority)}</priority>`);
  if (type) tags.push(`<type>${type}</type>`);
  if (assignee) tags.push(`<assignee>${assignee}</assignee>`);
  if (delegate) tags.push(`<delegate>${delegate}</delegate>`);
  if (issue.startDate) tags.push(`<startDate>${issue.startDate}</startDate>`);
  if (issue.dueDate) tags.push(`<dueDate>${issue.dueDate}</dueDate>`);
  for (const label of labels) tags.push(`<label>${label}</label>`);
  tags.push(`<project name="${project.project.name}"/>`);
  tags.push(`<url>${url}</url>`);
  tags.push('</issue>');

  return [
    `Work on Itsaplan issue ${issue.identifier}:`,
    '',
    `Suggested branch name: ${branch}`,
    '',
    tags.join('\n'),
  ].join('\n');
}
