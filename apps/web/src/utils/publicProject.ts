import type { Issue, Permissions, ProjectDetail, PublicScaffold } from '@/lib/api';

// Assembles a ProjectDetail from a public share bundle so the read-only pages can
// reuse the same components as the authenticated app (the board layouts, the issue
// Properties grid). The public scaffold carries no viewer/permissions (a public
// page has no session) and its assignees carry no email; this fills the shape with
// an empty permission matrix (every can() check resolves false) and a placeholder
// email.
export function toPublicProjectDetail(
  scaffold: PublicScaffold,
  issues: Issue[] = [],
): ProjectDetail {
  return {
    project: scaffold.project,
    columns: scaffold.columns,
    issueTypes: scaffold.issueTypes,
    labels: scaffold.labels,
    labelGroups: scaffold.labelGroups,
    assignees: scaffold.assignees.map((a) => ({ ...a, email: '' })),
    customFields: scaffold.customFields,
    viewer: { role: 'member' },
    permissions: {} as Permissions,
    issues,
    rev: '',
  };
}
