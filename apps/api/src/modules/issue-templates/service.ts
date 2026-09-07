import { db, issueTemplate, issueTemplateLabel, issueType, label, projectColumn } from '@repo/db';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { HttpError } from '#shared/lib';
import { getMembership } from '#modules/members/service';

// Data access for issue templates: the presets a new issue can be created from.
// Every template belongs to a project, and each of its properties is optional —
// one left null leaves the create dialog on its own default. Deleting the type,
// column, assignee or a label a template points at only clears that property
// (ON DELETE SET NULL / CASCADE on the join), the template stays.

export interface IssueTemplateRow {
  id: number;
  name: string;
  description: string;
  titleTemplate: string;
  descriptionTemplate: string;
  typeId: number | null;
  columnId: number | null;
  priority: string | null;
  assigneeUserId: string | null;
  labelIds: number[];
}

function mapTemplate(row: typeof issueTemplate.$inferSelect, labelIds: number[]): IssueTemplateRow {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    titleTemplate: row.titleTemplate,
    descriptionTemplate: row.descriptionTemplate,
    typeId: row.typeId,
    columnId: row.columnId,
    priority: row.priority,
    assigneeUserId: row.assigneeUserId,
    labelIds,
  };
}

// The labels of the given templates, grouped by template. Empty map for no ids.
async function labelsByTemplate(templateIds: number[]): Promise<Map<number, number[]>> {
  const byTemplate = new Map<number, number[]>();
  if (templateIds.length === 0) return byTemplate;
  const rows = await db
    .select()
    .from(issueTemplateLabel)
    .where(inArray(issueTemplateLabel.templateId, templateIds));
  for (const row of rows) {
    let list = byTemplate.get(row.templateId);
    if (!list) byTemplate.set(row.templateId, (list = []));
    list.push(row.labelId);
  }
  return byTemplate;
}

export async function listIssueTemplates(projectId: number): Promise<IssueTemplateRow[]> {
  const rows = await db
    .select()
    .from(issueTemplate)
    .where(eq(issueTemplate.projectId, projectId))
    .orderBy(asc(issueTemplate.id));
  const labels = await labelsByTemplate(rows.map((r) => r.id));
  return rows.map((r) => mapTemplate(r, labels.get(r.id) ?? []));
}

// One template by id, scoped to its project so an id from another project is not
// matched. Returns null when the project holds no template of that id.
async function getIssueTemplateById(
  projectId: number,
  id: number,
): Promise<IssueTemplateRow | null> {
  const rows = await db
    .select()
    .from(issueTemplate)
    .where(and(eq(issueTemplate.id, id), eq(issueTemplate.projectId, projectId)));
  if (!rows[0]) return null;
  const labels = await labelsByTemplate([id]);
  return mapTemplate(rows[0], labels.get(id) ?? []);
}

export interface IssueTemplateInput {
  name: string;
  description?: string;
  titleTemplate?: string;
  descriptionTemplate?: string;
  typeId?: number | null;
  columnId?: number | null;
  priority?: string | null;
  assigneeUserId?: string | null;
  labelIds?: number[];
}

// Enforces that every property the template presets belongs to its project: the
// foreign keys only require the row to exist somewhere. Only checks what the input
// sets to a non-null value — clearing a property is always allowed.
async function assertPresets(projectId: number, input: Partial<IssueTemplateInput>): Promise<void> {
  if (input.typeId != null) {
    const rows = await db
      .select({ id: issueType.id })
      .from(issueType)
      .where(and(eq(issueType.id, input.typeId), eq(issueType.projectId, projectId)));
    if (rows.length === 0) throw new HttpError(400, 'Issue type must belong to this project');
  }
  if (input.columnId != null) {
    const rows = await db
      .select({ id: projectColumn.id })
      .from(projectColumn)
      .where(and(eq(projectColumn.id, input.columnId), eq(projectColumn.projectId, projectId)));
    if (rows.length === 0) throw new HttpError(400, 'Column must belong to this project');
  }
  if (input.assigneeUserId) {
    const role = await getMembership(projectId, input.assigneeUserId);
    if (!role) throw new HttpError(400, 'Assignee must be a project member');
  }
  const labelIds = [...new Set(input.labelIds ?? [])];
  if (labelIds.length > 0) {
    const rows = await db
      .select({ id: label.id })
      .from(label)
      .where(and(eq(label.projectId, projectId), inArray(label.id, labelIds)));
    if (rows.length !== labelIds.length)
      throw new HttpError(400, 'Labels must belong to this project');
  }
}

// Writes the label set a template should end up with.
async function setTemplateLabels(templateId: number, labelIds: number[]): Promise<void> {
  const next = [...new Set(labelIds)];
  await db.delete(issueTemplateLabel).where(eq(issueTemplateLabel.templateId, templateId));
  if (next.length > 0) {
    await db.insert(issueTemplateLabel).values(next.map((labelId) => ({ templateId, labelId })));
  }
}

export async function createIssueTemplate(
  projectId: number,
  input: IssueTemplateInput,
): Promise<IssueTemplateRow> {
  await assertPresets(projectId, input);
  const [row] = await db
    .insert(issueTemplate)
    .values({
      projectId,
      name: input.name,
      description: input.description ?? '',
      titleTemplate: input.titleTemplate ?? '',
      descriptionTemplate: input.descriptionTemplate ?? '',
      typeId: input.typeId ?? null,
      columnId: input.columnId ?? null,
      priority: input.priority ?? null,
      assigneeUserId: input.assigneeUserId ?? null,
    })
    .returning({ id: issueTemplate.id });
  if (input.labelIds?.length) await setTemplateLabels(row.id, input.labelIds);
  return (await getIssueTemplateById(projectId, row.id))!;
}

// Updates a template, scoped to its project. Returns null when the project holds no
// template of that id. A property left out of the patch keeps its value.
export async function updateIssueTemplate(
  projectId: number,
  id: number,
  patch: Partial<IssueTemplateInput>,
): Promise<IssueTemplateRow | null> {
  const current = await getIssueTemplateById(projectId, id);
  if (!current) return null;
  await assertPresets(projectId, patch);
  await db
    .update(issueTemplate)
    .set({
      name: patch.name ?? current.name,
      description: patch.description ?? current.description,
      titleTemplate: patch.titleTemplate ?? current.titleTemplate,
      descriptionTemplate: patch.descriptionTemplate ?? current.descriptionTemplate,
      typeId: patch.typeId === undefined ? current.typeId : patch.typeId,
      columnId: patch.columnId === undefined ? current.columnId : patch.columnId,
      priority: patch.priority === undefined ? current.priority : patch.priority,
      assigneeUserId:
        patch.assigneeUserId === undefined ? current.assigneeUserId : patch.assigneeUserId,
    })
    .where(and(eq(issueTemplate.id, id), eq(issueTemplate.projectId, projectId)));
  if (patch.labelIds) await setTemplateLabels(id, patch.labelIds);
  return getIssueTemplateById(projectId, id);
}

// Deletes a template, scoped to its project. Returns true when a row was removed.
export async function deleteIssueTemplate(projectId: number, id: number): Promise<boolean> {
  const deleted = await db
    .delete(issueTemplate)
    .where(and(eq(issueTemplate.id, id), eq(issueTemplate.projectId, projectId)))
    .returning({ id: issueTemplate.id });
  return deleted.length > 0;
}
