import {
  db,
  issueType,
  project,
  projectColumn,
  projectMember,
  projectRole,
  projectSetting,
} from '@repo/db';
import { and, eq } from 'drizzle-orm';
import { iso } from '../shared/lib';
import {
  defaultMemberPermissions,
  fullPermissions,
  normalizePermissions,
  type Permissions,
} from '../shared/permissions';
import { getProjectSetting, setProjectSetting } from '../settings/store';

// Data access for projects: the top-level container that groups its own columns,
// issue types, labels, assignees, custom fields, issues, saved views, and
// actions. Access is by membership (project_member): the creator becomes an
// "owner" and only members can reach a project's entities.

export interface ProjectRow {
  id: number;
  key: string;
  name: string;
  description: string;
  mcpEnabled: boolean;
  createdAt: string;
}

// A project in the caller's list, carrying the caller's own role in it. The list
// UI (project switcher, manage-projects page) uses `role` to gate owner-only
// actions like deletion; the API still enforces the permission on every request.
export interface ProjectListItem extends ProjectRow {
  role: 'owner' | 'member';
  // The caller's resolved permission matrix in this project. Present only when the
  // list is requested with permissions (opts.withPermissions); omitted otherwise.
  permissions?: Permissions;
}

function mapProject(row: typeof project.$inferSelect): ProjectRow {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    mcpEnabled: row.mcpEnabled,
    createdAt: iso(row.createdAt),
  };
}

// Only the projects the user is a member of, ordered by key. Each carries the
// caller's role in that project (owner | member). When mcpOnly is set, projects
// with MCP disabled are excluded, so an MCP caller only sees projects it can work
// with.
export async function listProjects(
  userId: string,
  opts: { mcpOnly?: boolean; withPermissions?: boolean } = {},
): Promise<ProjectListItem[]> {
  const where = opts.mcpOnly
    ? and(eq(projectMember.userId, userId), eq(project.mcpEnabled, true))
    : eq(projectMember.userId, userId);
  const rows = await db
    .select({
      id: project.id,
      key: project.key,
      name: project.name,
      description: project.description,
      mcpEnabled: project.mcpEnabled,
      createdAt: project.createdAt,
      role: projectMember.role,
      rolePermissions: projectRole.permissions,
    })
    .from(project)
    .innerJoin(projectMember, eq(projectMember.projectId, project.id))
    .leftJoin(projectRole, eq(projectRole.id, projectMember.roleId))
    .where(where)
    .orderBy(project.key);
  return rows.map(({ rolePermissions, ...r }) => {
    const role = r.role === 'owner' ? 'owner' : 'member';
    const item: ProjectListItem = { ...r, createdAt: iso(r.createdAt), role };
    if (opts.withPermissions) {
      item.permissions =
        role === 'owner'
          ? fullPermissions()
          : rolePermissions
            ? normalizePermissions(rolePermissions)
            : defaultMemberPermissions();
    }
    return item;
  });
}

export async function getProjectByKey(key: string): Promise<ProjectRow | null> {
  const rows = await db.select().from(project).where(eq(project.key, key));
  return rows[0] ? mapProject(rows[0]) : null;
}

export async function getProjectById(id: number): Promise<ProjectRow | null> {
  const rows = await db.select().from(project).where(eq(project.id, id));
  return rows[0] ? mapProject(rows[0]) : null;
}

// Every new project starts with one column per state type, so it's usable (has
// somewhere to put an issue) without a trip to Settings first.
export const DEFAULT_COLUMNS: { name: string; stateType: string; color: string }[] = [
  { name: 'Backlog', stateType: 'backlog', color: '#71717a' },
  { name: 'Todo', stateType: 'unstarted', color: '#6b7280' },
  { name: 'In Progress', stateType: 'started', color: '#eab308' },
  { name: 'Done', stateType: 'completed', color: '#22c55e' },
  { name: 'Canceled', stateType: 'canceled', color: '#ef4444' },
];

// Issue types a new project starts with, picked by sphere of work in the create
// dialog. The first entry of a set becomes the project's default type. "general"
// is the fallback when no preset is chosen: a single Task, so the project is
// usable without committing to a classification.
export const ISSUE_TYPE_PRESETS: Record<string, { name: string; color: string }[]> = {
  general: [{ name: 'Task', color: '#0ea5e9' }],
  software: [
    { name: 'Feature', color: '#8b5cf6' },
    { name: 'Bug', color: '#e11d48' },
    { name: 'Task', color: '#0ea5e9' },
    { name: 'Tech debt', color: '#f97316' },
    { name: 'Research', color: '#14b8a6' },
  ],
  product: [
    { name: 'Epic', color: '#8b5cf6' },
    { name: 'Feature', color: '#0ea5e9' },
    { name: 'Feedback', color: '#eab308' },
    { name: 'Research', color: '#14b8a6' },
  ],
  content: [
    { name: 'Article', color: '#0ea5e9' },
    { name: 'Video', color: '#e11d48' },
    { name: 'Social post', color: '#8b5cf6' },
    { name: 'Idea', color: '#eab308' },
    { name: 'Review', color: '#22c55e' },
  ],
  marketing: [
    { name: 'Campaign', color: '#8b5cf6' },
    { name: 'Landing', color: '#0ea5e9' },
    { name: 'Asset', color: '#14b8a6' },
    { name: 'Email', color: '#f97316' },
    { name: 'Research', color: '#22c55e' },
  ],
  design: [
    { name: 'Screen', color: '#0ea5e9' },
    { name: 'Component', color: '#8b5cf6' },
    { name: 'Asset', color: '#14b8a6' },
    { name: 'Research', color: '#22c55e' },
  ],
  sales: [
    { name: 'Lead', color: '#0ea5e9' },
    { name: 'Deal', color: '#22c55e' },
    { name: 'Follow-up', color: '#eab308' },
    { name: 'Account', color: '#8b5cf6' },
  ],
  operations: [
    { name: 'Request', color: '#0ea5e9' },
    { name: 'Process', color: '#8b5cf6' },
    { name: 'Purchase', color: '#22c55e' },
    { name: 'Maintenance', color: '#f97316' },
  ],
  support: [
    { name: 'Incident', color: '#e11d48' },
    { name: 'Request', color: '#0ea5e9' },
    { name: 'Question', color: '#eab308' },
    { name: 'Change', color: '#8b5cf6' },
  ],
  recruiting: [
    { name: 'Candidate', color: '#0ea5e9' },
    { name: 'Onboarding', color: '#22c55e' },
    { name: 'Request', color: '#8b5cf6' },
    { name: 'Policy', color: '#6b7280' },
  ],
};

export const ISSUE_TYPE_PRESET_KEYS = Object.keys(ISSUE_TYPE_PRESETS);

export type IssueTypePreset = keyof typeof ISSUE_TYPE_PRESETS;

export async function createProject(
  input: {
    key: string;
    name: string;
    description?: string;
    preset?: string;
  },
  ownerId: string,
): Promise<ProjectRow> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(project)
      .values({ key: input.key, name: input.name, description: input.description ?? '' })
      .returning();
    await tx.insert(projectMember).values({ projectId: row.id, userId: ownerId, role: 'owner' });
    // Every project starts with a default "Member" role, assigned to members that
    // join through an invite.
    await tx.insert(projectRole).values({
      projectId: row.id,
      name: 'Member',
      isDefault: true,
      permissions: defaultMemberPermissions(),
    });
    for (const [position, column] of DEFAULT_COLUMNS.entries()) {
      await tx.insert(projectColumn).values({
        projectId: row.id,
        name: column.name,
        stateType: column.stateType,
        color: column.color,
        position,
      });
    }
    const types = ISSUE_TYPE_PRESETS[input.preset ?? 'general'] ?? ISSUE_TYPE_PRESETS.general;
    for (const [position, type] of types.entries()) {
      await tx.insert(issueType).values({
        projectId: row.id,
        name: type.name,
        color: type.color,
        isDefault: position === 0,
        position,
      });
    }
    await tx
      .insert(projectSetting)
      .values({ projectId: row.id, key: AUTO_ARCHIVE_KEY, value: DEFAULT_AUTO_ARCHIVE });
    return mapProject(row);
  });
}

// Updates a project's editable metadata (name, description). The key is the
// issue-identifier prefix (e.g. "MKT-42") and is immutable, so it is not editable
// here. Only the provided fields change.
export async function updateProject(
  projectId: number,
  patch: { name?: string; description?: string },
): Promise<ProjectRow | null> {
  const values: Partial<typeof project.$inferInsert> = {};
  if (patch.name !== undefined) values.name = patch.name;
  if (patch.description !== undefined) values.description = patch.description;
  if (Object.keys(values).length === 0) return getProjectById(projectId);
  const [row] = await db.update(project).set(values).where(eq(project.id, projectId)).returning();
  return row ? mapProject(row) : null;
}

// Toggles whether the project is reachable through the MCP server. Owner-only at
// the route; the flag gates every MCP tool call scoped to this project.
export async function setProjectMcpEnabled(
  projectId: number,
  enabled: boolean,
): Promise<ProjectRow | null> {
  const [row] = await db
    .update(project)
    .set({ mcpEnabled: enabled })
    .where(eq(project.id, projectId))
    .returning();
  return row ? mapProject(row) : null;
}

// Auto-archive thresholds for a project. Stored in project_setting under
// AUTO_ARCHIVE_KEY as { completedDays, canceledDays }. Each value is the number of
// days an issue may sit inactive in a completed/canceled column before the worker
// archives it; null disables archiving for that state group. A new project is
// created with DEFAULT_AUTO_ARCHIVE; a project with no stored row (created before
// this) keeps both null, so nothing is archived until an owner turns it on. The
// worker reads the same key and jsonb fields directly (apps/worker/src/store.ts) —
// keep them in sync.
const AUTO_ARCHIVE_KEY = 'auto_archive';

const DEFAULT_AUTO_ARCHIVE = { completedDays: 28, canceledDays: 7 };

export interface AutoArchiveSettings {
  completedDays: number | null;
  canceledDays: number | null;
}

// Coerces a stored/input value to a positive integer day count, or null (disabled)
// for anything else. Guards against non-integer or non-positive thresholds.
function normalizeDays(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function getAutoArchiveSettings(projectId: number): Promise<AutoArchiveSettings> {
  const stored = await getProjectSetting<Partial<AutoArchiveSettings>>(projectId, AUTO_ARCHIVE_KEY);
  return {
    completedDays: normalizeDays(stored?.completedDays),
    canceledDays: normalizeDays(stored?.canceledDays),
  };
}

export async function setAutoArchiveSettings(
  projectId: number,
  input: { completedDays?: number | null; canceledDays?: number | null },
): Promise<AutoArchiveSettings> {
  const next: AutoArchiveSettings = {
    completedDays: normalizeDays(input.completedDays),
    canceledDays: normalizeDays(input.canceledDays),
  };
  await setProjectSetting(projectId, AUTO_ARCHIVE_KEY, next);
  return next;
}

// Deletes a project and everything scoped to it. Every project-scoped foreign key
// has ON DELETE CASCADE on project_id, so deleting the project row removes its
// columns, issue types, labels, initiatives, issues, views, dashboards, and
// actions, which in turn cascade to their own dependents (an issue's labels, field
// values/options, attachments, and activity; a custom field's values). The
// issue.column_id foreign key is NO ACTION, checked at end of statement — both the
// issues and their columns are deleted by the same cascade, so it is satisfied.
export async function deleteProject(projectId: number): Promise<void> {
  await db.delete(project).where(eq(project.id, projectId));
}
