import {
  db,
  chatAttachment,
  documentAsset,
  issue,
  issueAttachment,
  issueType,
  project,
  projectColumn,
  projectMember,
  projectRole,
  projectDocument,
  projectSetting,
} from '@repo/db';
import { and, eq } from 'drizzle-orm';
import { iso } from '#shared/lib';
import {
  defaultMemberPermissions,
  fullPermissions,
  normalizePermissions,
  type Permissions,
} from '#shared/permissions';
import { getProjectSetting, setProjectSetting } from '#shared/project-settings';
import { deleteThreadsWhere } from '#modules/agents/core/runtime/memory';
import { getProjectDefaults } from '#modules/settings/service';
import { deleteObjects } from '#shared/s3';
import { lockAttachmentStorage } from '#modules/attachments/storage';

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
  initiativesEnabled: boolean;
  dashboardsEnabled: boolean;
  documentsEnabled: boolean;
  notesEnabled: boolean;
  cyclesEnabled: boolean;
  subtasksEnabled: boolean;
  checklistsEnabled: boolean;
  issueStatsEnabled: boolean;
  pointsEstimateEnabled: boolean;
  timeEstimateEnabled: boolean;
  timeLoggingEnabled: boolean;
  createdAt: string;
}

// The optional sections an owner can turn off per project (Settings -> General).
// A disabled section is hidden in the web app; its rows are kept.
export interface ProjectFeatures {
  initiatives: boolean;
  dashboards: boolean;
  documents: boolean;
  notes: boolean;
  cycles: boolean;
  subtasks: boolean;
  checklists: boolean;
  issueStats: boolean;
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
    initiativesEnabled: row.initiativesEnabled,
    dashboardsEnabled: row.dashboardsEnabled,
    documentsEnabled: row.documentsEnabled,
    notesEnabled: row.notesEnabled,
    cyclesEnabled: row.cyclesEnabled,
    subtasksEnabled: row.subtasksEnabled,
    checklistsEnabled: row.checklistsEnabled,
    issueStatsEnabled: row.issueStatsEnabled,
    pointsEstimateEnabled: row.pointsEstimateEnabled,
    timeEstimateEnabled: row.timeEstimateEnabled,
    timeLoggingEnabled: row.timeLoggingEnabled,
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
      initiativesEnabled: project.initiativesEnabled,
      dashboardsEnabled: project.dashboardsEnabled,
      documentsEnabled: project.documentsEnabled,
      notesEnabled: project.notesEnabled,
      cyclesEnabled: project.cyclesEnabled,
      subtasksEnabled: project.subtasksEnabled,
      checklistsEnabled: project.checklistsEnabled,
      issueStatsEnabled: project.issueStatsEnabled,
      pointsEstimateEnabled: project.pointsEstimateEnabled,
      timeEstimateEnabled: project.timeEstimateEnabled,
      timeLoggingEnabled: project.timeLoggingEnabled,
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
  // What a new project starts with, set instance-wide in god mode. Read before the
  // transaction opens so the settings lookup is not part of it.
  const defaults = await getProjectDefaults();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(project)
      .values({
        key: input.key,
        name: input.name,
        description: input.description ?? '',
        mcpEnabled: defaults.mcpEnabled,
      })
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

// The project's feature toggles, read from the project row.
export function projectFeatures(row: ProjectRow): ProjectFeatures {
  return {
    initiatives: row.initiativesEnabled,
    dashboards: row.dashboardsEnabled,
    documents: row.documentsEnabled,
    notes: row.notesEnabled,
    cycles: row.cyclesEnabled,
    subtasks: row.subtasksEnabled,
    checklists: row.checklistsEnabled,
    issueStats: row.issueStatsEnabled,
  };
}

// Turns the optional sections on or off. Only the supplied ones change; a section
// that is turned off keeps its rows and shows again when it is turned back on.
export async function setProjectFeatures(
  projectId: number,
  patch: Partial<ProjectFeatures>,
): Promise<ProjectRow | null> {
  const values: Partial<typeof project.$inferInsert> = {};
  if (patch.initiatives !== undefined) values.initiativesEnabled = patch.initiatives;
  if (patch.dashboards !== undefined) values.dashboardsEnabled = patch.dashboards;
  if (patch.documents !== undefined) values.documentsEnabled = patch.documents;
  if (patch.notes !== undefined) values.notesEnabled = patch.notes;
  if (patch.cycles !== undefined) values.cyclesEnabled = patch.cycles;
  if (patch.subtasks !== undefined) values.subtasksEnabled = patch.subtasks;
  if (patch.checklists !== undefined) values.checklistsEnabled = patch.checklists;
  if (patch.issueStats !== undefined) values.issueStatsEnabled = patch.issueStats;
  if (Object.keys(values).length === 0) return getProjectById(projectId);
  const [row] = await db.update(project).set(values).where(eq(project.id, projectId)).returning();
  return row ? mapProject(row) : null;
}

// Which estimate kinds the project's issues carry, and whether its members log the
// time they spend. Held on the project row rather than in project_setting: every
// member's project payload already carries it, so a board knows whether estimates
// are on without a request of its own. Logging is independent of the time estimate:
// a team can log time without estimating first.
export interface EstimateSettings {
  points: boolean;
  time: boolean;
  logging: boolean;
}

// Turns them on or off. One turned off keeps what the issues already carry — the
// estimates, the logged entries — which show again when it is turned back on.
export async function setEstimateSettings(
  projectId: number,
  input: EstimateSettings,
): Promise<EstimateSettings | null> {
  const [row] = await db
    .update(project)
    .set({
      pointsEstimateEnabled: input.points,
      timeEstimateEnabled: input.time,
      timeLoggingEnabled: input.logging,
    })
    .where(eq(project.id, projectId))
    .returning();
  return row
    ? {
        points: row.pointsEstimateEnabled,
        time: row.timeEstimateEnabled,
        logging: row.timeLoggingEnabled,
      }
    : null;
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

// The subtask automations, stored in project_setting under SUBTASK_AUTOMATION_KEY.
// completeParent moves a parent into the column of its last closed subtask once
// every subtask is closed; closeSubtasks moves the still-open subtasks of an issue
// into the column the issue was closed in. Both off unless a project turns them on:
// they rewrite states nobody asked to change. Applied in modules/issues/automation.ts.
const SUBTASK_AUTOMATION_KEY = 'subtask_automation';

export interface SubtaskAutomationSettings {
  completeParent: boolean;
  closeSubtasks: boolean;
}

export async function getSubtaskAutomationSettings(
  projectId: number,
): Promise<SubtaskAutomationSettings> {
  const stored = await getProjectSetting<Partial<SubtaskAutomationSettings>>(
    projectId,
    SUBTASK_AUTOMATION_KEY,
  );
  return {
    completeParent: stored?.completeParent === true,
    closeSubtasks: stored?.closeSubtasks === true,
  };
}

export async function setSubtaskAutomationSettings(
  projectId: number,
  input: SubtaskAutomationSettings,
): Promise<SubtaskAutomationSettings> {
  const next: SubtaskAutomationSettings = {
    completeParent: input.completeParent,
    closeSubtasks: input.closeSubtasks,
  };
  await setProjectSetting(projectId, SUBTASK_AUTOMATION_KEY, next);
  return next;
}

// Deletes a project and everything scoped to it. Every project-scoped foreign key
// has ON DELETE CASCADE on project_id, so deleting the project row removes its
// columns, issue types, labels, initiatives, issues, views, dashboards, and
// actions, which in turn cascade to their own dependents (an issue's labels, field
// values/options, attachments, and activity; a custom field's values). The
// issue.column_id foreign key is NO ACTION, checked at end of statement — both the
// issues and their columns are deleted by the same cascade, so it is satisfied. The
// conversation threads of the project's agents are deleted first, since they live
// outside those cascades.
export async function deleteProject(projectId: number): Promise<void> {
  await deleteThreadsWhere({ projectId });
  const assetKeys = await db.transaction(async (tx) => {
    // Serialize with the final upload quota check. A concurrent upload either
    // commits before these reads or loses its FK race and cleans its S3 object.
    await lockAttachmentStorage(tx, projectId);
    const issueAssets = await tx
      .select({ s3Key: issueAttachment.s3Key })
      .from(issueAttachment)
      .innerJoin(issue, eq(issue.id, issueAttachment.issueId))
      .where(eq(issue.projectId, projectId));
    const chatAssets = await tx
      .select({ s3Key: chatAttachment.s3Key })
      .from(chatAttachment)
      .where(eq(chatAttachment.projectId, projectId));
    const documentAssets = await tx
      .select({ s3Key: documentAsset.s3Key })
      .from(documentAsset)
      .innerJoin(projectDocument, eq(projectDocument.id, documentAsset.documentId))
      .where(eq(projectDocument.projectId, projectId));
    await tx.delete(project).where(eq(project.id, projectId));
    return [...issueAssets, ...chatAssets, ...documentAssets].map((asset) => asset.s3Key);
  });
  await deleteObjects(assetKeys);
}
