import type { BoardIssue, Permissions, ProjectDetail, PublicScaffold } from '@/lib/api';

// Assembles a ProjectDetail from a public share bundle so the read-only pages can
// reuse the same components as the authenticated app (the board layouts, the issue
// Properties grid). The public scaffold carries no viewer/permissions (a public
// page has no session) and its assignees carry neither an email nor a handle; this
// fills the shape with an empty permission matrix (every can() check resolves false),
// a placeholder email and no handle.
export function toPublicProjectDetail(
  scaffold: PublicScaffold,
  issues: BoardIssue[] = [],
): ProjectDetail {
  return {
    project: scaffold.project,
    columns: scaffold.columns,
    issueTypes: scaffold.issueTypes,
    labels: scaffold.labels,
    labelGroups: scaffold.labelGroups,
    assignees: scaffold.assignees.map((a) => ({
      ...a,
      email: '',
      username: null,
      canReadWorkItems: false,
    })),
    customFields: scaffold.customFields,
    // A public page creates nothing, so it needs no templates.
    issueTemplates: [],
    viewer: { role: 'member' },
    permissions: {} as Permissions,
    issues,
    // A share bundle carries no cycle list; a view grouped by cycle gets its lanes
    // from the cycles the shared issues are planned into.
    plannedCycles: [],
  };
}
