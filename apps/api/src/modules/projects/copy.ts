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
  projectView,
  projectDashboard,
  projectDocument,
  documentAsset,
  projectAction,
  webhook,
  projectSetting,
} from '@repo/db';
import { and, eq, inArray, or } from 'drizzle-orm';
import { HttpError } from '#shared/lib';
import {
  DEFAULT_COLUMNS,
  getProjectById,
  mapProject,
  targetTeam,
  type ProjectRow,
} from './service';
import { GIT_SETTING_KEY } from '#modules/git/service';
import { getProjectDefaults } from '#modules/settings/service';
import { listAgents, updateAgent } from '#modules/agents/core/service';
import { listAllAgentSchedules, createAgentSchedule } from '#modules/agents/schedules/service';
import { nextCronRun } from '#modules/agents/schedules/cron';
import { generateSecret } from '#modules/webhooks/service';
import {
  assertAttachmentStorageCapacity,
  assertAttachmentFileAllowed,
  attachmentObjectKey,
  cloneAttachmentObject,
  deleteAttachmentObject,
} from '#modules/attachments/storage';
import { assertValidDocumentContentJson, replaceAssetReferences } from '#modules/documents/service';

// Which parts of a source project the copy carries over. A key set false skips that
// entity. Some sections depend on others (a view's filters reference
// states/types/labels/fields); those dependencies are force-enabled in
// normalizeInclude so a partial selection can never leave an id pointing at the
// source project. Agents, their skills and their configured tools are not among them:
// all three belong to the team, so a copy inside it reuses the same agents, and a copy
// into another team carries none.
export interface CopyProjectInclude {
  states: boolean;
  issueTypes: boolean;
  labels: boolean;
  customFields: boolean;
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
  'views',
  'dashboards',
  'documents',
  'actions',
  'configuration',
  'webhooks',
  'agents',
  'schedules',
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
  views: true,
  dashboards: true,
  documents: true,
  actions: true,
};

// Resolves the selection and force-enables the dependencies each entity needs to be
// copied correctly. Views/actions remap the ids of states, types, labels and fields,
// so those must be copied too; a schedule cannot exist without its agent.
function normalizeInclude(raw?: Partial<CopyProjectInclude>): CopyProjectInclude {
  const inc: CopyProjectInclude = raw ? { ...ALL_FALSE, ...raw } : { ...DEFAULT_INCLUDE };
  if (inc.customFields) inc.issueTypes = true;
  if (inc.views) {
    inc.states = true;
    inc.issueTypes = true;
    inc.labels = true;
    inc.customFields = true;
  }
  if (inc.actions) {
    inc.states = true;
    inc.issueTypes = true;
    inc.labels = true;
  }
  if (inc.schedules) inc.agents = true;
  return inc;
}

// Old id → new id maps built while copying, used to rewrite the id references that
// views and actions hold in their filters.
interface CopyIdMaps {
  column: Map<number, number>;
  labelGroup: Map<number, number>;
  label: Map<number, number>;
  type: Map<number, number>;
  field: Map<number, number>;
  option: Map<number, number>;
}

// Returns the mapped id for a numeric value present in the map; any other value
// passes through unchanged.
function remapId(map: Map<number, number>, v: unknown): unknown {
  return typeof v === 'number' && map.has(v) ? map.get(v) : v;
}

// Rewrites the entity ids a view's filter set references so they point at the copied
// project's entities. The display blob's ids (hiddenGroups) are remapped separately
// by remapViewDisplay.
//
// The filter shape is owned by the UI: a FilterSet is { conditions: [{ field, op,
// values }] }. Which map a condition's numeric values use is decided by its field:
// status → column, type → type, labels → label, cf:<fieldId> → the field id is
// remapped in the key, and select values are option ids, so they use the option map.
// Non-numeric values (priority/statusType strings, assignee user ids, dates,
// custom-field text) are left as-is. Values whose id is absent from the map are kept
// unchanged.
function remapViewFilters(filters: unknown, maps: CopyIdMaps): unknown {
  if (!filters || typeof filters !== 'object') return filters;
  const conditions = (filters as { conditions?: unknown }).conditions;
  if (!Array.isArray(conditions)) return filters;

  const newConditions = conditions.map((cond: Record<string, unknown>) => {
    if (!cond || typeof cond !== 'object') return cond;
    const field: unknown = cond.field;
    let newField = field;
    let valueMap: Map<number, number> | null = null;

    if (field === 'status') valueMap = maps.column;
    else if (field === 'type') valueMap = maps.type;
    else if (field === 'labels') valueMap = maps.label;
    else if (typeof field === 'string' && field.startsWith('cf:')) {
      const newFieldId = maps.field.get(Number(field.slice(3)));
      if (newFieldId != null) newField = `cf:${newFieldId}`;
      valueMap = maps.option;
    }

    const values =
      valueMap && Array.isArray(cond.values)
        ? cond.values.map((v: unknown) => remapId(valueMap!, v))
        : cond.values;
    return { ...cond, field: newField, values };
  });

  return { ...(filters as object), conditions: newConditions };
}

// Remaps one work items group key to the copied project's entities. Group keys are
// namespaced by grouping field: c<columnId> and t<typeId> carry a numeric id and are
// remapped; a<userId> (assignee), p<priority>, the *-none buckets and 'all' carry no
// project-scoped numeric id and pass through.
function remapGroupKey(key: string, maps: CopyIdMaps): string {
  const m = /^([ct])(\d+)$/.exec(key);
  if (!m) return key;
  const id = Number(m[2]);
  const map = m[1] === 'c' ? maps.column : maps.type;
  const newId = map.get(id);
  return newId != null ? `${m[1]}${newId}` : key;
}

// Rewrites the id-bearing parts of a view's display blob. Only hiddenGroups holds ids
// (group keys of the flat work items view's hidden columns); the rest of the display
// (layout, sort, group/subgroup, properties) is field-kind enums, copied as-is.
function remapViewDisplay(display: unknown, maps: CopyIdMaps): unknown {
  if (!display || typeof display !== 'object') return display;
  const hidden = (display as { hiddenGroups?: unknown }).hiddenGroups;
  if (!Array.isArray(hidden)) return display;
  return {
    ...(display as object),
    hiddenGroups: hidden.map((k: unknown) => (typeof k === 'string' ? remapGroupKey(k, maps) : k)),
  };
}

// Rewrites the entity ids an action's effect holds so they point at the copied
// project's entities. The effect is a partial issue patch; columnId/typeId and each
// labelId are remapped, while assigneeUserId (a global user id), priority and dates
// are left as-is.
function remapActionEffect(effect: unknown, maps: CopyIdMaps): unknown {
  if (!effect || typeof effect !== 'object') return effect;
  const src = effect as Record<string, unknown>;
  const out: Record<string, unknown> = { ...src };
  if ('columnId' in src) out.columnId = remapId(maps.column, src.columnId);
  if ('typeId' in src) out.typeId = remapId(maps.type, src.typeId);
  if (Array.isArray(src.labelIds)) out.labelIds = src.labelIds.map((v) => remapId(maps.label, v));
  return out;
}

// Creates a new project that copies the selected parts of the source project's
// configuration, but none of its issues. The creator becomes the new project's owner.
//
// Pure-database entities (states, types, labels, custom fields, views, dashboards,
// documents, actions, settings, webhooks) are copied in one transaction, recording
// old id → new id so the ids that views and actions reference are remapped to the
// copied entities. A document's assets are cloned in the object store inside that
// transaction and removed again if it rolls back. The team's agents are attached to
// the new project after it commits, through the same service function the UI uses.
export async function copyProject(
  sourceProjectId: number,
  input: { key: string; name: string; description?: string },
  ownerId: string,
  rawInclude?: Partial<CopyProjectInclude>,
  teamId?: number,
): Promise<ProjectRow> {
  const inc = normalizeInclude(rawInclude);

  const maps: CopyIdMaps = {
    column: new Map(),
    labelGroup: new Map(),
    label: new Map(),
    type: new Map(),
    field: new Map(),
    option: new Map(),
  };

  const copiedDocumentAssetKeys: string[] = [];

  const source = await getProjectById(sourceProjectId);
  if (!source) throw new HttpError(404, 'Project not found');
  const ownerTeam = await targetTeam(ownerId, teamId);
  // What a new project starts with, set instance-wide in god mode. Read before the
  // transaction opens so the settings lookup is not part of it.
  const defaults = await getProjectDefaults();
  // Agents, integration credentials and roles belong to the team, so what references
  // them survives the copy only when it stays in the same team.
  const sameTeam = ownerTeam.id === source.teamId;
  const copyTransaction = db.transaction(async (tx) => {
    // The optional sections the source project shows and the estimate kinds it
    // carries are part of its configuration, so the copy starts with the same ones.
    // mcpEnabled is not carried: a new project enters its team's MCP reach on the
    // instance default, the same way a created one does.
    const [sourceFeatures] = await tx
      .select({
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
      })
      .from(project)
      .where(eq(project.id, sourceProjectId));

    const [row] = await tx
      .insert(project)
      .values({
        teamId: ownerTeam.id,
        key: input.key,
        name: input.name,
        description: input.description ?? '',
        mcpEnabled: defaults.mcpEnabled,
        ...sourceFeatures,
      })
      .returning();
    const proj = await mapProject({
      ...row,
      teamName: ownerTeam.name,
      teamMcpEnabled: ownerTeam.mcpEnabled,
    });
    await tx.insert(projectMember).values({ projectId: proj.id, userId: ownerId, role: 'owner' });

    // States (columns). When copied, every source column is carried over so views,
    // actions and issues have somewhere to map to. When not copied, the project is
    // seeded with the default columns instead, so it is still usable (a project with
    // no state has nowhere to put an issue).
    if (inc.states) {
      const columnRows = await tx
        .select()
        .from(projectColumn)
        .where(eq(projectColumn.projectId, sourceProjectId))
        .orderBy(projectColumn.position);
      // autoAssignUserId is left unset: the copy starts with only its owner as a
      // member, so a carried-over member would not be one there.
      for (const col of columnRows) {
        const [created] = await tx
          .insert(projectColumn)
          .values({
            projectId: proj.id,
            name: col.name,
            stateType: col.stateType,
            color: col.color,
            position: col.position,
            wipLimit: col.wipLimit,
            wipMode: col.wipMode,
          })
          .returning({ id: projectColumn.id });
        maps.column.set(col.id, created.id);
      }
    } else {
      for (const [position, column] of DEFAULT_COLUMNS.entries()) {
        await tx.insert(projectColumn).values({
          projectId: proj.id,
          name: column.name,
          stateType: column.stateType,
          color: column.color,
          position,
        });
      }
    }

    if (inc.issueTypes) {
      const typeRows = await tx
        .select()
        .from(issueType)
        .where(eq(issueType.projectId, sourceProjectId))
        .orderBy(issueType.position);
      for (const t of typeRows) {
        const [created] = await tx
          .insert(issueType)
          .values({
            projectId: proj.id,
            name: t.name,
            icon: t.icon,
            color: t.color,
            isDefault: t.isDefault,
            position: t.position,
          })
          .returning({ id: issueType.id });
        maps.type.set(t.id, created.id);
      }
    }

    if (inc.labels) {
      // Label groups are copied before labels so each copied label's group_id can be
      // remapped to the new group.
      const labelGroupRows = await tx
        .select()
        .from(labelGroup)
        .where(eq(labelGroup.projectId, sourceProjectId));
      for (const g of labelGroupRows) {
        const [created] = await tx
          .insert(labelGroup)
          .values({ projectId: proj.id, name: g.name, color: g.color })
          .returning({ id: labelGroup.id });
        maps.labelGroup.set(g.id, created.id);
      }

      const labelRows = await tx.select().from(label).where(eq(label.projectId, sourceProjectId));
      for (const l of labelRows) {
        const [created] = await tx
          .insert(label)
          .values({
            projectId: proj.id,
            groupId: l.groupId != null ? (maps.labelGroup.get(l.groupId) ?? null) : null,
            name: l.name,
            color: l.color,
          })
          .returning({ id: label.id });
        maps.label.set(l.id, created.id);
      }
    }

    // Type-scoped custom fields (with their options). Project-wide fields
    // (issue_type_id NULL) are not copied.
    if (inc.customFields && maps.type.size > 0) {
      const fieldRows = await tx
        .select()
        .from(customField)
        .where(inArray(customField.issueTypeId, Array.from(maps.type.keys())))
        .orderBy(customField.position);
      for (const f of fieldRows) {
        const [created] = await tx
          .insert(customField)
          .values({
            projectId: proj.id,
            issueTypeId: f.issueTypeId != null ? (maps.type.get(f.issueTypeId) ?? null) : null,
            name: f.name,
            fieldType: f.fieldType,
            memberScope: f.memberScope,
            position: f.position,
          })
          .returning({ id: customField.id });
        maps.field.set(f.id, created.id);

        const optionRows = await tx
          .select()
          .from(customFieldOption)
          .where(eq(customFieldOption.fieldId, f.id))
          .orderBy(customFieldOption.position);
        for (const o of optionRows) {
          const [newOption] = await tx
            .insert(customFieldOption)
            .values({ fieldId: created.id, value: o.value, color: o.color, position: o.position })
            .returning({ id: customFieldOption.id });
          maps.option.set(o.id, newOption.id);
        }
      }
    }

    // Views: their filters reference the ids captured above.
    if (inc.views) {
      const viewRows = await tx
        .select()
        .from(projectView)
        .where(eq(projectView.projectId, sourceProjectId))
        .orderBy(projectView.position, projectView.id);
      for (const v of viewRows) {
        await tx.insert(projectView).values({
          projectId: proj.id,
          name: v.name,
          icon: v.icon,
          filters: remapViewFilters(v.filters, maps) ?? {},
          display: remapViewDisplay(v.display, maps) ?? {},
          position: v.position,
        });
      }
    }

    // Dashboards: the layout blob is copied verbatim. Widget filters that reference
    // assignee/type/label ids are not remapped (those filters just match nothing until
    // re-set); the metric widgets, which are project-scoped and id-agnostic, work
    // unchanged.
    if (inc.dashboards) {
      const dashboardRows = await tx
        .select()
        .from(projectDashboard)
        .where(eq(projectDashboard.projectId, sourceProjectId))
        .orderBy(projectDashboard.position, projectDashboard.id);
      for (const d of dashboardRows) {
        await tx.insert(projectDashboard).values({
          projectId: proj.id,
          name: d.name,
          icon: d.icon,
          layout: d.layout ?? [],
          position: d.position,
        });
      }
    }

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
                input.key,
                targetDocumentId,
                publicIds,
              ),
              contentJson: replaceAssetReferences(
                source.contentJson,
                source.id,
                input.key,
                targetDocumentId,
                publicIds,
              ),
            })
            .where(eq(projectDocument.id, targetDocumentId));
        }
      }
    }

    // Actions: their condition (a FilterSet) and effect (a partial patch) hold ids
    // captured above, so they are remapped to the copied entities.
    if (inc.actions) {
      const actionRows = await tx
        .select()
        .from(projectAction)
        .where(eq(projectAction.projectId, sourceProjectId))
        .orderBy(projectAction.position, projectAction.id);
      for (const a of actionRows) {
        await tx.insert(projectAction).values({
          projectId: proj.id,
          name: a.name,
          icon: a.icon,
          condition: remapViewFilters(a.condition, maps) ?? {},
          effect: remapActionEffect(a.effect, maps) ?? {},
          position: a.position,
        });
      }
    }

    // Project settings key/value rows (the Configuration section's subtask
    // automations and auto-archive thresholds, and any other project-scoped
    // setting). Copied verbatim, except the repository integration: its value holds
    // the webhook secret and routing id (the copy's owner must not receive the
    // source's credential, and a duplicated id would make inbound routing
    // ambiguous) plus column ids of the source project. The copy starts
    // unconfigured instead.
    if (inc.configuration) {
      const settingRows = await tx
        .select()
        .from(projectSetting)
        .where(eq(projectSetting.projectId, sourceProjectId));
      for (const s of settingRows) {
        if (s.key === GIT_SETTING_KEY) continue;
        await tx.insert(projectSetting).values({ projectId: proj.id, key: s.key, value: s.value });
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

    return proj;
  });
  let newProject: ProjectRow;
  try {
    newProject = await copyTransaction;
  } catch (error) {
    await Promise.all(copiedDocumentAssetKeys.map(deleteAttachmentObject));
    throw error;
  }

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
  // its own cadence rather than inheriting a past due time.
  if (inc.schedules && sameTeam) {
    for (const s of await listAllAgentSchedules(sourceProjectId, ownerId)) {
      await createAgentSchedule({
        projectId: newProject.id,
        agentId: s.agentId,
        actorUserId: ownerId,
        name: s.name,
        prompt: s.prompt,
        cron: s.cron,
        status: s.status,
        nextRunAt: nextCronRun(s.cron),
      });
    }
  }

  return newProject;
}
