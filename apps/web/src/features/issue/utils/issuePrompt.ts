import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { Issue } from '@/lib/api/endpoints/issues';
import { issuePath } from '@/utils/paths';
import { buildIssueBranchName, type BranchNameUser } from '@/utils/branchName';

// Builds the prompt copied by "Copy Prompt", matching Linear's format: a lead
// instruction, a suggested branch name, then the issue as XML-like tags with the
// full Markdown description inside <description>. IDs (status, assignee, labels,
// ...) are resolved to human-readable names via the project. Called in the
// browser, so window.location.origin gives the absolute issue URL.
export function buildIssuePrompt(
  issue: Issue,
  project: ProjectDetail,
  user?: BranchNameUser,
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
  const url = `${window.location.origin}${issuePath(project.project.ref, issue.sequenceNumber)}`;

  const branch = buildIssueBranchName(issue, user, project.branchNameTemplate);

  const tags: string[] = [
    `<issue identifier="${issue.identifier}">`,
    `<title>${issue.title}</title>`,
  ];
  tags.push('<description>', issue.description.trim(), '</description>');
  if (status) tags.push(`<status>${status}</status>`);
  if (issue.priority) tags.push(`<priority>${issue.priority}</priority>`);
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
