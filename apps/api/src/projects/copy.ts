import {
  db,
  project,
  projectMember,
  projectRole,
  projectColumn,
  issueType,
  labelGroup,
  label,
  customField,
  customFieldOption,
  projectView,
  projectDashboard,
  projectAction,
  integrationCredential,
  agentTool,
  webhook,
  projectNotificationSetting,
  projectSetting,
} from '@repo/db';
import { eq, inArray } from 'drizzle-orm';
import { iso } from '../shared/lib';
import { defaultMemberPermissions } from '../shared/permissions';
import { DEFAULT_COLUMNS, type ProjectRow } from './store';
import { listAgents, createAgent, type NewAgentInput } from '../ai-agents/store';
import {
  listSkills,
  getSkillMarkdown,
  createSkillFromFiles,
  setAgentSkills,
  listAgentSkills,
} from '../agent-skills/store';
import { listAgentToolLinks, setAgentTools } from '../agent-tools/store';
import { listAgentSchedules, createAgentSchedule } from '../agent-schedules/store';
import { nextCronRun } from '../agent-schedules/cron';
import { getObject } from '../shared/s3';

// Which parts of a source project the copy carries over. Each key mirrors a section
// of the project settings menu. A key set false skips that entity. Some sections
// depend on others (a view's filters reference states/types/labels/fields); those
// dependencies are force-enabled in normalizeInclude so a partial selection can
// never leave an id pointing at the source project.
export interface CopyProjectInclude {
  states: boolean;
  issueTypes: boolean;
  labels: boolean;
  customFields: boolean;
  views: boolean;
  dashboards: boolean;
  actions: boolean;
  archive: boolean;
  roles: boolean;
  notificationProviders: boolean;
  webhooks: boolean;
  integrations: boolean;
  tools: boolean;
  skills: boolean;
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
  'actions',
  'archive',
  'roles',
  'notificationProviders',
  'webhooks',
  'integrations',
  'tools',
  'skills',
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
  actions: true,
};

// Resolves the selection and force-enables the dependencies each entity needs to be
// copied correctly. Views/actions remap the ids of states, types, labels and fields,
// so those must be copied too; a tool cannot exist without its credential; a schedule
// cannot exist without its agent.
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
  if (inc.tools) inc.integrations = true;
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

function mapProjectRow(row: typeof project.$inferSelect): ProjectRow {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    mcpEnabled: row.mcpEnabled,
    createdAt: iso(row.createdAt),
  };
}

// Reads a whole object from the store into a Buffer, for copying a skill's reference
// files into the new project's own object prefix.
async function readObjectBytes(key: string): Promise<{ bytes: Buffer; contentType: string }> {
  const { body, contentType } = await getObject(key);
  const bytes = Buffer.from(await new Response(body).arrayBuffer());
  return { bytes, contentType };
}

// Creates a new project that copies the selected parts of the source project's
// configuration, but none of its issues. The creator becomes the new project's owner.
//
// Pure-database entities (states, types, labels, custom fields, views, dashboards,
// actions, roles, settings, webhooks, integration credentials, configured tools) are
// copied in one transaction, recording old id → new id so the ids that views/actions
// and tools/agents reference are remapped to the copied entities. Entities with side
// effects outside the database are copied after that transaction commits: skills copy
// their object-store files, agents create their own bot user and API key, and both go
// through the same store functions the UI uses.
export async function copyProject(
  sourceProjectId: number,
  input: { key: string; name: string; description?: string },
  ownerId: string,
  rawInclude?: Partial<CopyProjectInclude>,
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
  const roleMap = new Map<number, number>();
  const integrationMap = new Map<number, number>();
  const toolMap = new Map<number, number>();
  const skillMap = new Map<number, number>();
  const agentMap = new Map<number, number>();

  const newProject = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(project)
      .values({ key: input.key, name: input.name, description: input.description ?? '' })
      .returning();
    const proj = mapProjectRow(row);
    await tx.insert(projectMember).values({ projectId: proj.id, userId: ownerId, role: 'owner' });

    // Roles. When copied, every source role is carried over (including which one is
    // the default), so agents/members keep their role assignments. Otherwise the
    // project starts with just the standard default "Member" role, as a fresh project
    // does.
    if (inc.roles) {
      const roleRows = await tx
        .select()
        .from(projectRole)
        .where(eq(projectRole.projectId, sourceProjectId));
      for (const r of roleRows) {
        const [created] = await tx
          .insert(projectRole)
          .values({
            projectId: proj.id,
            name: r.name,
            isDefault: r.isDefault,
            permissions: r.permissions,
          })
          .returning({ id: projectRole.id });
        roleMap.set(r.id, created.id);
      }
      const hasDefault = roleRows.some((r) => r.isDefault);
      if (!hasDefault) {
        await tx.insert(projectRole).values({
          projectId: proj.id,
          name: 'Member',
          isDefault: true,
          permissions: defaultMemberPermissions(),
        });
      }
    } else {
      await tx.insert(projectRole).values({
        projectId: proj.id,
        name: 'Member',
        isDefault: true,
        permissions: defaultMemberPermissions(),
      });
    }

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
      for (const col of columnRows) {
        const [created] = await tx
          .insert(projectColumn)
          .values({
            projectId: proj.id,
            name: col.name,
            stateType: col.stateType,
            color: col.color,
            position: col.position,
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

    // Project settings key/value rows (the Archive section's auto-archive thresholds,
    // and any other project-scoped setting). Copied verbatim.
    if (inc.archive) {
      const settingRows = await tx
        .select()
        .from(projectSetting)
        .where(eq(projectSetting.projectId, sourceProjectId));
      for (const s of settingRows) {
        await tx.insert(projectSetting).values({ projectId: proj.id, key: s.key, value: s.value });
      }
    }

    // Notification provider credentials: the single per-project row, copied verbatim
    // (its config is already encrypted at rest). Per-member event/channel preferences
    // are personal and not copied.
    if (inc.notificationProviders) {
      const [ns] = await tx
        .select()
        .from(projectNotificationSetting)
        .where(eq(projectNotificationSetting.projectId, sourceProjectId));
      if (ns) {
        await tx.insert(projectNotificationSetting).values({
          projectId: proj.id,
          ciphertext: ns.ciphertext,
          iv: ns.iv,
          authTag: ns.authTag,
          redacted: ns.redacted,
        });
      }
    }

    // Webhook subscriptions, copied verbatim including the signing secret so an
    // existing receiver keeps verifying. The failure counter resets.
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
          secret: w.secret,
          events: w.events,
          isActive: w.isActive,
        });
      }
    }

    // Integration credentials (LLM and tool secrets), copied verbatim — the ciphertext
    // is already encrypted and the project scope is the boundary. Their ids are mapped
    // so configured tools and agents' model credentials point at the copies.
    if (inc.integrations) {
      const credRows = await tx
        .select()
        .from(integrationCredential)
        .where(eq(integrationCredential.projectId, sourceProjectId))
        .orderBy(integrationCredential.id);
      for (const c of credRows) {
        const [created] = await tx
          .insert(integrationCredential)
          .values({
            projectId: proj.id,
            integrationKey: c.integrationKey,
            label: c.label,
            ciphertext: c.ciphertext,
            iv: c.iv,
            authTag: c.authTag,
            redacted: c.redacted,
          })
          .returning({ id: integrationCredential.id });
        integrationMap.set(c.id, created.id);
      }
    }

    // Configured tools: each binds a tool key to one integration credential, remapped
    // to the copied credential. A tool whose credential was not copied is skipped.
    if (inc.tools) {
      const toolRows = await tx
        .select()
        .from(agentTool)
        .where(eq(agentTool.projectId, sourceProjectId))
        .orderBy(agentTool.id);
      for (const tRow of toolRows) {
        const newCredId = integrationMap.get(tRow.credentialId);
        if (newCredId == null) continue;
        const [created] = await tx
          .insert(agentTool)
          .values({ projectId: proj.id, toolKey: tRow.toolKey, credentialId: newCredId })
          .returning({ id: agentTool.id });
        toolMap.set(tRow.id, created.id);
      }
    }

    return proj;
  });

  // Skills: copy each skill's object-store files into the new project's own prefix,
  // then create the row through the same store the UI uses.
  if (inc.skills) {
    for (const s of await listSkills(sourceProjectId)) {
      const markdown = await getSkillMarkdown(s.id, sourceProjectId);
      const refs = [];
      for (const f of s.files) {
        const { bytes, contentType } = await readObjectBytes(f.s3Key);
        refs.push({ path: f.path, bytes, contentType });
      }
      const created = await createSkillFromFiles(newProject.id, {
        name: s.name,
        description: s.description,
        source: s.source,
        sourceUrl: s.sourceUrl,
        markdown,
        refs,
      });
      skillMap.set(s.id, created.id);
    }
  }

  // Agents: each gets its own bot user and API key through createAgent, with its model
  // credential and role remapped to the copies. An external agent's key is regenerated
  // and cannot be recovered here — its operator resets it in the new project. Skill and
  // tool links are re-created only for the skills/tools that were also copied.
  if (inc.agents) {
    for (const a of await listAgents(sourceProjectId)) {
      const agentInput: NewAgentInput = {
        name: a.name,
        username: a.username,
        kind: a.kind,
        modelCredentialId:
          a.modelCredentialId != null ? (integrationMap.get(a.modelCredentialId) ?? null) : null,
        model: a.model,
        instructions: a.instructions,
        tools: a.tools,
        temperature: a.temperature,
        maxSteps: a.maxSteps,
        memoryEnabled: a.memoryEnabled,
        memoryLastMessages: a.memoryLastMessages,
        triggerOnMention: a.triggerOnMention,
        triggerOnAssign: a.triggerOnAssign,
        roleId: a.roleId != null ? (roleMap.get(a.roleId) ?? null) : null,
      };
      const { agent } = await createAgent(newProject.id, agentInput);
      agentMap.set(a.id, agent.id);

      if (inc.skills) {
        const skillIds = (await listAgentSkills(a.id))
          .map((s) => skillMap.get(s.id))
          .filter((id): id is number => id != null);
        if (skillIds.length > 0) await setAgentSkills(agent.id, newProject.id, skillIds);
      }
      if (inc.tools) {
        const toolIds = (await listAgentToolLinks(a.id))
          .map((tRow) => toolMap.get(tRow.id))
          .filter((id): id is number => id != null);
        if (toolIds.length > 0) await setAgentTools(agent.id, newProject.id, toolIds);
      }
    }
  }

  // Schedules: re-created for the copied agents. next_run_at is recomputed from the
  // cron so the copy starts on its own cadence rather than inheriting a past due time.
  if (inc.schedules) {
    for (const s of await listAgentSchedules(sourceProjectId)) {
      const newAgentId = agentMap.get(s.agentId);
      if (newAgentId == null) continue;
      await createAgentSchedule({
        projectId: newProject.id,
        agentId: newAgentId,
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
