import {
  db,
  project,
  projectMember,
  projectColumn,
  issueType,
  labelGroup,
  label,
  customField,
  customFieldOption,
  issueTemplate,
  issueTemplateLabel,
  projectView,
  projectDashboard,
  projectDocument,
  documentAsset,
  projectAction,
  webhook,
  projectSetting,
  type DbExecutor,
} from '@repo/db';
import { and, eq, inArray, ne, or } from 'drizzle-orm';
import { HttpError } from '#shared/lib';
import {
  DEFAULT_COLUMNS,
  getProjectById,
  joinTeamAsCreator,
  mapProject,
  targetTeam,
  type ProjectRow,
  type TargetTeam,
} from './service';
import { GIT_SETTING_KEY } from '#modules/git/service';
import { getProjectDefaults } from '#modules/settings/service';
import { listAgents, updateAgent } from '#modules/agents/core/service';
import { listAllAgentSchedules, createAgentSchedule } from '#modules/agents/schedules/service';
import { nextCronRun } from '#modules/agents/schedules/cron';
import { checkScheduleOptions } from '#modules/agents/schedules/extension';
import { generateSecret } from '#modules/webhooks/service';
import {
  assertAttachmentStorageCapacity,
  assertAttachmentFileAllowed,
  attachmentObjectKey,
  cloneAttachmentObject,
  deleteAttachmentObject,
} from '#modules/attachments/storage';
import { assertValidDocumentContentJson, replaceAssetReferences } from '#modules/documents/service';
import { copySections } from './copy-extension';
import { mapDisplay, mapEffect, mapFilters, mapLayout, type References } from './references';

// Which parts of a source project the copy carries over. A key set false skips that
// entity, and a section an extension adds (copy-extension.ts) has a key of its own.
// Some sections depend on others (a view's filters reference states/types/labels/fields);
// those dependencies are force-enabled in normalizeInclude so a partial selection can
// never leave an id pointing at the source project. Agents, their skills and their configured tools are not among them:
// all three belong to the team, so a copy inside it reuses the same agents, and a copy
// into another team carries none.
export interface CopyProjectInclude {
  states: boolean;
  issueTypes: boolean;
  labels: boolean;
  customFields: boolean;
  issueTemplates: boolean;
  views: boolean;
  dashboards: boolean;
  documents: boolean;
  actions: boolean;
  configuration: boolean;
  webhooks: boolean;
  agents: boolean;
  schedules: boolean;
}

export const COPY_INCLUDE_KEYS: (keyof CopyProjectInclude)[] = [
  'states',
  'issueTypes',
  'labels',
  'customFields',
  'issueTemplates',
  'views',
  'dashboards',
  'documents',
  'actions',
  'configuration',
  'webhooks',
  'agents',
  'schedules',
];

type Include = CopyProjectInclude & Record<string, boolean>;

// What a project template never carries: the agents and their schedules work in a
// project, a webhook delivers one project's events, and docs are its content.
const NOT_IN_TEMPLATE: (keyof CopyProjectInclude)[] = [
  'agents',
  'schedules',
  'webhooks',
  'documents',
];

const ALL_FALSE = Object.fromEntries(
  COPY_INCLUDE_KEYS.map((k) => [k, false]),
) as unknown as CopyProjectInclude;

// The set copied when a caller sends no selection (MCP and any older client). This
// is the project structure the copy carried before the selection was added.
const DEFAULT_INCLUDE: CopyProjectInclude = {
  ...ALL_FALSE,
  states: true,
  issueTypes: true,
  labels: true,
  customFields: true,
  issueTemplates: true,
  views: true,
  dashboards: true,
  documents: true,
  actions: true,
};

// Resolves the selection and force-enables the dependencies each entity needs to be
// copied correctly. Views, actions and issue templates remap the ids of states, types,
// labels and fields, so those must be copied too; a schedule cannot exist without its
// agent, and a status schedule without its state. A template leaves out what it never
// carries.
function normalizeInclude(
  raw: Record<string, boolean | undefined> | undefined,
  template: boolean,
): Include {
  const inc: Include = raw ? { ...ALL_FALSE, ...raw } : { ...DEFAULT_INCLUDE };
  for (const section of copySections()) {
    if (template && !section.template) inc[section.key] = false;
    if (inc[section.key]) for (const key of section.requires) inc[key] = true;
  }
  if (template) for (const key of NOT_IN_TEMPLATE) inc[key] = false;
  if (inc.customFields) inc.issueTypes = true;
  if (inc.views) {
    inc.states = true;
    inc.issueTypes = true;
    inc.labels = true;
    inc.customFields = true;
  }
  if (inc.actions || inc.issueTemplates) {
    inc.states = true;
    inc.issueTypes = true;
    inc.labels = true;
  }
  if (inc.schedules) {
    inc.agents = true;
    inc.states = true;
  }
  return inc;
}

// Old id → new id maps built while copying, used to rewrite the id references that
// views, actions and dashboards hold. fieldType is the type of each field of the
// snapshot, by its old id.
export interface CopyIdMaps {
  column: Map<number, number>;
  labelGroup: Map<number, number>;
  label: Map<number, number>;
  type: Map<number, number>;
  field: Map<number, number>;
  option: Map<number, number>;
  fieldType: Map<number, string>;
}

// People stay, since the copy is on the same instance. A reference the copy has no new
// row for (an initiative, a cycle, a deleted state) keeps its old id, which no row of the
// new project has, so a condition on it still matches no issue rather than every one.
function copyReferences(maps: CopyIdMaps): References {
  return {
    map: (kind, id) => {
      if (kind === 'person' || kind === 'initiative' || kind === 'cycle') return id;
      return maps[kind].get(id as number) ?? id;
    },
    fieldType: (id) => maps.fieldType.get(id),
  };
}

// A filter set an extension copies with the project, such as a schedule's conditions.
export function remapViewFilters(filters: unknown, maps: CopyIdMaps): unknown {
  return mapFilters(filters, copyReferences(maps));
}

// The project flags a copy carries: the optional sections the project shows, the
// estimate kinds its issues carry and whether time is logged. mcpEnabled is not among
// them: a new project enters its team's MCP reach on the instance default, the same way a
// created one does.
const PROJECT_FLAGS = {
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
};

type Row<T extends { $inferSelect: object }, K extends keyof T['$inferSelect']> = Pick<
  T['$inferSelect'],
  K
>;

// A project's configuration without its issues: what a copy carries over and what a
// project template stores as jsonb. The states, types, label groups, labels, fields and
// options keep the id they were read with, the row's own or the number an imported
// template gives them, because the other parts reference them by it (a field's issue type,
// a view's filters, an action's effect). applyProjectSnapshot maps the ids to the new rows.
// A part the selection left out is empty.
export interface ProjectSnapshot {
  flags: { [K in keyof typeof PROJECT_FLAGS]: boolean };
  columns: Row<
    typeof projectColumn,
    'id' | 'name' | 'stateType' | 'color' | 'position' | 'wipLimit' | 'wipMode'
  >[];
  issueTypes: Row<typeof issueType, 'id' | 'name' | 'icon' | 'color' | 'isDefault' | 'position'>[];
  labelGroups: Row<typeof labelGroup, 'id' | 'name' | 'color'>[];
  labels: Row<typeof label, 'id' | 'groupId' | 'name' | 'color'>[];
  customFields: (Row<
    typeof customField,
    'id' | 'issueTypeId' | 'name' | 'fieldType' | 'memberScope' | 'showInBody' | 'position'
  > & { options: Row<typeof customFieldOption, 'id' | 'value' | 'color' | 'position'>[] })[];
  issueTemplates: (Row<
    typeof issueTemplate,
    | 'name'
    | 'description'
    | 'titleTemplate'
    | 'descriptionTemplate'
    | 'typeId'
    | 'columnId'
    | 'priority'
  > & { labelIds: number[] })[];
  views: Row<typeof projectView, 'name' | 'icon' | 'filters' | 'display' | 'position'>[];
  dashboards: Row<typeof projectDashboard, 'name' | 'icon' | 'layout' | 'position'>[];
  actions: Row<typeof projectAction, 'name' | 'icon' | 'condition' | 'effect' | 'position'>[];
  settings: Row<typeof projectSetting, 'key' | 'value'>[];
  // What each section an extension adds holds, by its key.
  sections: Record<string, unknown>;
}

async function readProjectSnapshot(projectId: number, inc: Include): Promise<ProjectSnapshot> {
  const [
    [flags],
    columns,
    issueTypes,
    labelGroups,
    labels,
    fields,
    issueTemplates,
    views,
    dashboards,
    actions,
    settings,
  ] = await Promise.all([
    db.select(PROJECT_FLAGS).from(project).where(eq(project.id, projectId)),
    // autoAssignUserId is left out: a member of the source project need not be a member
    // of the new one.
    inc.states
      ? db
          .select({
            id: projectColumn.id,
            name: projectColumn.name,
            stateType: projectColumn.stateType,
            color: projectColumn.color,
            position: projectColumn.position,
            wipLimit: projectColumn.wipLimit,
            wipMode: projectColumn.wipMode,
          })
          .from(projectColumn)
          .where(eq(projectColumn.projectId, projectId))
          .orderBy(projectColumn.position)
      : [],
    inc.issueTypes
      ? db
          .select({
            id: issueType.id,
            name: issueType.name,
            icon: issueType.icon,
            color: issueType.color,
            isDefault: issueType.isDefault,
            position: issueType.position,
          })
          .from(issueType)
          .where(eq(issueType.projectId, projectId))
          .orderBy(issueType.position)
      : [],
    inc.labels
      ? db
          .select({ id: labelGroup.id, name: labelGroup.name, color: labelGroup.color })
          .from(labelGroup)
          .where(eq(labelGroup.projectId, projectId))
      : [],
    inc.labels
      ? db
          .select({ id: label.id, groupId: label.groupId, name: label.name, color: label.color })
          .from(label)
          .where(eq(label.projectId, projectId))
      : [],
    inc.customFields
      ? db
          .select({
            id: customField.id,
            issueTypeId: customField.issueTypeId,
            name: customField.name,
            fieldType: customField.fieldType,
            memberScope: customField.memberScope,
            showInBody: customField.showInBody,
            position: customField.position,
          })
          .from(customField)
          .where(eq(customField.projectId, projectId))
          .orderBy(customField.position)
      : [],
    // The assignee is left out, as a column's auto-assignee is.
    inc.issueTemplates
      ? db
          .select({
            id: issueTemplate.id,
            name: issueTemplate.name,
            description: issueTemplate.description,
            titleTemplate: issueTemplate.titleTemplate,
            descriptionTemplate: issueTemplate.descriptionTemplate,
            typeId: issueTemplate.typeId,
            columnId: issueTemplate.columnId,
            priority: issueTemplate.priority,
          })
          .from(issueTemplate)
          .where(eq(issueTemplate.projectId, projectId))
          .orderBy(issueTemplate.id)
      : [],
    // A private view is its owner's alone and stays behind.
    inc.views
      ? db
          .select({
            name: projectView.name,
            icon: projectView.icon,
            filters: projectView.filters,
            display: projectView.display,
            position: projectView.position,
          })
          .from(projectView)
          .where(and(eq(projectView.projectId, projectId), eq(projectView.isPrivate, false)))
          .orderBy(projectView.position, projectView.id)
      : [],
    inc.dashboards
      ? db
          .select({
            name: projectDashboard.name,
            icon: projectDashboard.icon,
            layout: projectDashboard.layout,
            position: projectDashboard.position,
          })
          .from(projectDashboard)
          .where(eq(projectDashboard.projectId, projectId))
          .orderBy(projectDashboard.position, projectDashboard.id)
      : [],
    inc.actions
      ? db
          .select({
            name: projectAction.name,
            icon: projectAction.icon,
            condition: projectAction.condition,
            effect: projectAction.effect,
            position: projectAction.position,
          })
          .from(projectAction)
          .where(eq(projectAction.projectId, projectId))
          .orderBy(projectAction.position, projectAction.id)
      : [],
    // The repository integration is left out: its value holds the webhook secret and
    // routing id (the copy's owner must not receive the source's credential, and a
    // duplicated id would make inbound routing ambiguous) plus column ids of the source
    // project. The copy starts unconfigured instead.
    inc.configuration
      ? db
          .select({ key: projectSetting.key, value: projectSetting.value })
          .from(projectSetting)
          .where(
            and(eq(projectSetting.projectId, projectId), ne(projectSetting.key, GIT_SETTING_KEY)),
          )
      : [],
  ]);
  if (!flags) throw new HttpError(404, 'Project not found');

  const fieldIds = fields.map((field) => field.id);
  const options = fieldIds.length
    ? await db
        .select({
          id: customFieldOption.id,
          fieldId: customFieldOption.fieldId,
          value: customFieldOption.value,
          color: customFieldOption.color,
          position: customFieldOption.position,
        })
        .from(customFieldOption)
        .where(inArray(customFieldOption.fieldId, fieldIds))
        .orderBy(customFieldOption.position)
    : [];
  const templateIds = issueTemplates.map((tpl) => tpl.id);
  const templateLabels = templateIds.length
    ? await db
        .select({ templateId: issueTemplateLabel.templateId, labelId: issueTemplateLabel.labelId })
        .from(issueTemplateLabel)
        .where(inArray(issueTemplateLabel.templateId, templateIds))
    : [];

  const sections = await Promise.all(
    copySections()
      .filter((section) => inc[section.key])
      .map(async (section) => [section.key, await section.read(projectId)] as const),
  );

  return {
    flags,
    columns,
    issueTypes,
    labelGroups,
    labels,
    customFields: fields.map((field) => ({
      ...field,
      options: options
        .filter((option) => option.fieldId === field.id)
        .map(({ fieldId: _, ...option }) => option),
    })),
    issueTemplates: issueTemplates.map(({ id, ...tpl }) => ({
      ...tpl,
      labelIds: templateLabels.filter((row) => row.templateId === id).map((row) => row.labelId),
    })),
    views,
    dashboards,
    actions,
    settings,
    sections: Object.fromEntries(sections),
  };
}

// The configuration a project template stores: the selected parts of the project, less
// what a template never carries.
export function readTemplateSnapshot(
  projectId: number,
  rawInclude?: Record<string, boolean | undefined>,
): Promise<ProjectSnapshot> {
  return readProjectSnapshot(projectId, normalizeInclude(rawInclude, true));
}

// Writes what the snapshot holds into the project and returns the old id -> new id maps.
// Without states the project starts on the default columns, so it has somewhere to put an
// issue. Each insert sets the new project's ids after the snapshot's fields, so a field an
// imported snapshot carries never points a row at another project.
async function applyProjectSnapshot(
  tx: DbExecutor,
  projectId: number,
  snapshot: ProjectSnapshot,
  context: { ownerId: string; sameTeam: boolean },
): Promise<CopyIdMaps> {
  const maps: CopyIdMaps = {
    column: new Map(),
    labelGroup: new Map(),
    label: new Map(),
    type: new Map(),
    field: new Map(),
    option: new Map(),
    fieldType: new Map(snapshot.customFields.map((field) => [field.id, field.fieldType])),
  };
  const mapped = (map: Map<number, number>, id: number | null) =>
    id == null ? null : (map.get(id) ?? null);

  const columns = snapshot.columns.length
    ? snapshot.columns
    : DEFAULT_COLUMNS.map((column, position) => ({ ...column, id: null, position }));
  for (const { id, ...column } of columns) {
    const [created] = await tx
      .insert(projectColumn)
      .values({ ...column, projectId })
      .returning({ id: projectColumn.id });
    if (id != null) maps.column.set(id, created.id);
  }

  for (const { id, ...type } of snapshot.issueTypes) {
    const [created] = await tx
      .insert(issueType)
      .values({ ...type, projectId })
      .returning({ id: issueType.id });
    maps.type.set(id, created.id);
  }

  // Label groups go first so each label's group maps to the new one.
  for (const { id, ...group } of snapshot.labelGroups) {
    const [created] = await tx
      .insert(labelGroup)
      .values({ ...group, projectId })
      .returning({ id: labelGroup.id });
    maps.labelGroup.set(id, created.id);
  }
  for (const { id, groupId, ...rest } of snapshot.labels) {
    const [created] = await tx
      .insert(label)
      .values({ ...rest, projectId, groupId: mapped(maps.labelGroup, groupId) })
      .returning({ id: label.id });
    maps.label.set(id, created.id);
  }

  for (const { id, issueTypeId, options, ...field } of snapshot.customFields) {
    const [created] = await tx
      .insert(customField)
      .values({ ...field, projectId, issueTypeId: mapped(maps.type, issueTypeId) })
      .returning({ id: customField.id });
    maps.field.set(id, created.id);
    for (const { id: optionId, ...option } of options) {
      const [newOption] = await tx
        .insert(customFieldOption)
        .values({ ...option, fieldId: created.id })
        .returning({ id: customFieldOption.id });
      maps.option.set(optionId, newOption.id);
    }
  }

  for (const { typeId, columnId, labelIds, ...tpl } of snapshot.issueTemplates) {
    const [created] = await tx
      .insert(issueTemplate)
      .values({
        ...tpl,
        projectId,
        typeId: mapped(maps.type, typeId),
        columnId: mapped(maps.column, columnId),
      })
      .returning({ id: issueTemplate.id });
    const newLabelIds = labelIds.flatMap((labelId) => maps.label.get(labelId) ?? []);
    if (newLabelIds.length > 0) {
      await tx
        .insert(issueTemplateLabel)
        .values(newLabelIds.map((labelId) => ({ templateId: created.id, labelId })));
    }
  }

  const refs = copyReferences(maps);
  for (const view of snapshot.views) {
    await tx.insert(projectView).values({
      ...view,
      projectId,
      filters: mapFilters(view.filters, refs) ?? {},
      display: mapDisplay(view.display, refs) ?? {},
    });
  }

  for (const dashboard of snapshot.dashboards) {
    await tx
      .insert(projectDashboard)
      .values({ ...dashboard, projectId, layout: mapLayout(dashboard.layout, refs) });
  }

  for (const action of snapshot.actions) {
    await tx.insert(projectAction).values({
      ...action,
      projectId,
      condition: mapFilters(action.condition, refs) ?? {},
      effect: mapEffect(action.effect, refs) ?? {},
    });
  }

  if (snapshot.settings.length > 0) {
    await tx
      .insert(projectSetting)
      .values(snapshot.settings.map((setting) => ({ ...setting, projectId })));
  }

  for (const section of copySections()) {
    if (!(section.key in snapshot.sections)) continue;
    await section.apply({ tx, projectId, maps, ...context }, snapshot.sections[section.key]);
  }

  return maps;
}

// Creates a project in the team that starts with what the snapshot holds, inside the
// caller's transaction. The creator becomes its owner and joins the team with it.
export async function insertSnapshotProject(
  tx: DbExecutor,
  snapshot: ProjectSnapshot,
  options: {
    team: TargetTeam;
    input: { key: string; name: string; description?: string };
    ownerId: string;
    // From getProjectDefaults, read before the transaction opens.
    mcpEnabled: boolean;
    agentMembers: { userId: string; role: 'member'; roleId: number | null }[];
    // The snapshot was read from a project of the same team.
    sameTeam: boolean;
  },
): Promise<{ project: ProjectRow; maps: CopyIdMaps }> {
  const { team, input, ownerId } = options;
  const [row] = await tx
    .insert(project)
    .values({
      ...snapshot.flags,
      teamId: team.id,
      key: input.key,
      name: input.name,
      description: input.description ?? '',
      mcpEnabled: options.mcpEnabled,
    })
    .returning();
  await joinTeamAsCreator(tx, team.id, ownerId);
  await tx.insert(projectMember).values({ projectId: row.id, userId: ownerId, role: 'owner' });
  if (options.agentMembers.length > 0) {
    await tx
      .insert(projectMember)
      .values(options.agentMembers.map((member) => ({ projectId: row.id, ...member })));
  }
  const maps = await applyProjectSnapshot(tx, row.id, snapshot, {
    ownerId,
    sameTeam: options.sameTeam,
  });
  const created = await mapProject({
    ...row,
    teamName: team.name,
    teamSlug: team.slug,
    teamMcpEnabled: team.mcpEnabled,
    workspaceId: team.workspaceId,
  });
  return { project: created, maps };
}

// Creates a new project that copies the selected parts of the source project's
// configuration, but none of its issues. The creator becomes the new project's owner.
//
// The configuration is read into a snapshot and written in one transaction, with the
// documents and webhooks, which only a copy carries. A document's assets are cloned in
// the object store inside that transaction and removed again if it rolls back. The
// team's agents are attached to the new project after it commits, through the same
// service function the UI uses.
export async function copyProject(
  sourceProjectId: number,
  input: { key: string; name: string; description?: string },
  ownerId: string,
  teamId: number,
  rawInclude?: Record<string, boolean | undefined>,
): Promise<ProjectRow> {
  const inc = normalizeInclude(rawInclude, false);
  const source = await getProjectById(sourceProjectId);
  if (!source) throw new HttpError(404, 'Project not found');
  const ownerTeam = await targetTeam(ownerId, teamId);
  // Agents, integration credentials and roles belong to the team, so what references
  // them survives the copy only when it stays in the same team.
  const sameTeam = ownerTeam.id === source.teamId;
  const snapshot = await readProjectSnapshot(sourceProjectId, inc);
  const defaults = await getProjectDefaults();
  const copiedDocumentAssetKeys: string[] = [];

  const copyTransaction = db.transaction(async (tx) => {
    const inserted = await insertSnapshotProject(tx, snapshot, {
      team: ownerTeam,
      input,
      ownerId,
      mcpEnabled: defaults.mcpEnabled,
      agentMembers: [],
      sameTeam,
    });
    const proj = inserted.project;
    if (inc.documents) {
      const documentRows = await tx
        .select()
        .from(projectDocument)
        .where(
          and(
            eq(projectDocument.projectId, sourceProjectId),
            or(eq(projectDocument.isPrivate, false), eq(projectDocument.ownerUserId, ownerId)),
          ),
        )
        .orderBy(projectDocument.position, projectDocument.id);
      const documentMap = new Map<number, number>();
      for (const d of documentRows) {
        assertValidDocumentContentJson(d.contentJson);
        const [created] = await tx
          .insert(projectDocument)
          .values({
            projectId: proj.id,
            title: d.title,
            content: d.content,
            contentJson: d.contentJson,
            icon: d.icon,
            metadata: d.metadata,
            fullWidth: d.fullWidth,
            isPrivate: d.isPrivate,
            isLocked: d.isLocked,
            archivedAt: d.archivedAt,
            position: d.position,
            ownerUserId: ownerId,
            createdByUserId: ownerId,
            updatedByUserId: ownerId,
          })
          .returning({ id: projectDocument.id });
        documentMap.set(d.id, created.id);
      }
      for (const d of documentRows) {
        if (d.parentId == null) continue;
        const id = documentMap.get(d.id);
        const parentId = documentMap.get(d.parentId);
        if (id == null || parentId == null) continue;
        await tx.update(projectDocument).set({ parentId }).where(eq(projectDocument.id, id));
      }
      const sourceDocumentIds = documentRows.map((document) => document.id);
      if (sourceDocumentIds.length > 0) {
        const assetRows = await tx
          .select()
          .from(documentAsset)
          .where(inArray(documentAsset.documentId, sourceDocumentIds));
        await assertAttachmentStorageCapacity(
          proj.id,
          assetRows.reduce((total, asset) => total + asset.sizeBytes, 0),
          0,
          tx,
        );
        for (const asset of assetRows) {
          await assertAttachmentFileAllowed(asset.sizeBytes, asset.contentType);
        }
        const assetIdsByDocument = new Map<number, Map<string, string>>();
        for (const asset of assetRows) {
          const targetDocumentId = documentMap.get(asset.documentId);
          if (targetDocumentId == null) continue;
          const key = attachmentObjectKey(proj.id, 'documents', targetDocumentId, asset.filename);
          await cloneAttachmentObject(asset.s3Key, key, asset.contentType);
          copiedDocumentAssetKeys.push(key);
          const [copy] = await tx
            .insert(documentAsset)
            .values({
              documentId: targetDocumentId,
              uploadedByUserId: ownerId,
              s3Key: key,
              filename: asset.filename,
              contentType: asset.contentType,
              sizeBytes: asset.sizeBytes,
            })
            .returning({ publicId: documentAsset.publicId });
          const publicIds = assetIdsByDocument.get(asset.documentId) ?? new Map<string, string>();
          publicIds.set(asset.publicId.toLowerCase(), copy.publicId);
          assetIdsByDocument.set(asset.documentId, publicIds);
        }
        for (const source of documentRows) {
          const targetDocumentId = documentMap.get(source.id);
          const publicIds = assetIdsByDocument.get(source.id);
          if (targetDocumentId == null || !publicIds || publicIds.size === 0) continue;
          await tx
            .update(projectDocument)
            .set({
              content: replaceAssetReferences(
                source.content,
                source.id,
                proj,
                targetDocumentId,
                publicIds,
              ),
              contentJson: replaceAssetReferences(
                source.contentJson,
                source.id,
                proj,
                targetDocumentId,
                publicIds,
              ),
            })
            .where(eq(projectDocument.id, targetDocumentId));
        }
      }
    }

    // Webhook subscriptions: the URL and the event selection, with a signing secret of
    // their own — the copy's owner must not receive the source's. The receiver cannot
    // verify that signature until it is given the new secret, so the copy starts
    // inactive and its owner enables it.
    if (inc.webhooks) {
      const webhookRows = await tx
        .select()
        .from(webhook)
        .where(eq(webhook.projectId, sourceProjectId))
        .orderBy(webhook.id);
      for (const w of webhookRows) {
        await tx.insert(webhook).values({
          projectId: proj.id,
          url: w.url,
          secret: generateSecret(),
          events: w.events,
          isActive: false,
        });
      }
    }

    return inserted;
  });
  let created: Awaited<typeof copyTransaction>;
  try {
    created = await copyTransaction;
  } catch (error) {
    await Promise.all(copiedDocumentAssetKeys.map(deleteAttachmentObject));
    throw error;
  }
  const { project: newProject, maps } = created;

  // Agents: the ones working in the source project, attached to the new one as well.
  // The team owns them and one handle is unique in it, so a second copy of the same
  // agent cannot exist. A copy into another team carries no agent: creating one there
  // would mean a new bot user and a new API key for something the operator did not ask
  // for, and its skills and configured tools would be missing anyway.
  if (inc.agents && sameTeam) {
    for (const a of await listAgents(source.teamId, sourceProjectId)) {
      // The member fields the agent reacts to, remapped onto the copies.
      const fieldTriggers = a.fieldTriggers.flatMap((trigger) => {
        const fieldId = maps.field.get(trigger.fieldId);
        return fieldId == null ? [] : [{ fieldId, delaySec: trigger.delaySec }];
      });
      await updateAgent(
        a.id,
        ownerTeam.id,
        {
          projectIds: [...a.projects.map((p) => p.id), newProject.id],
          fieldTriggers: [
            ...a.fieldTriggers.map(({ fieldId, delaySec }) => ({ fieldId, delaySec })),
            ...fieldTriggers,
          ],
        },
        ownerId,
      );
    }
  }

  // Schedules: re-created against the same agents, which only work in the copy when it
  // stayed in the team. next_run_at is recomputed from the cron so the copy starts on
  // its own cadence rather than inheriting a past due time. The options go through the
  // extension with the id maps, for the ids they hold.
  if (inc.schedules && sameTeam) {
    for (const s of await listAllAgentSchedules(sourceProjectId, ownerId)) {
      await createAgentSchedule({
        projectId: newProject.id,
        agentId: s.agentId,
        actorUserId: ownerId,
        name: s.name,
        type: s.type,
        prompt: s.prompt,
        cron: s.cron,
        nextRunAt: s.cron === null ? null : nextCronRun(s.cron),
        columnId: s.columnId === null ? null : maps.column.get(s.columnId)!,
        delaySec: s.delaySec,
        options: await checkScheduleOptions({
          type: s.type,
          options: s.options,
          projectId: newProject.id,
          copy: maps,
        }),
        status: s.status,
      });
    }
  }

  return newProject;
}
