import type { projectTemplate } from '@repo/db';
import { HttpError } from '#shared/lib';
import type { CopyIdMaps, ProjectSnapshot } from '#modules/projects/copy';
import {
  mapDisplay,
  mapEffect,
  mapFilters,
  mapLayout,
  type References,
} from '#modules/projects/references';
import type { SharedProjectTemplate as SharedProjectTemplateSchema } from './model';
import {
  createTemplate,
  requireWorkspaceTemplate,
  templateContents,
  type ProjectTemplate,
  type ProjectTemplateContents,
} from './service';

// A template copied out of one workspace to be imported into another, on this instance or
// another one. Its parts are numbered 1, 2, 3 in each kind, so the ids of the rows they
// were read from stay behind. So do the people, the initiatives and the cycles a project
// names: the project made from it has none of them. It carries no section an extension
// adds either, since nothing here checks what such a section holds.
export type SharedProjectTemplate = typeof SharedProjectTemplateSchema.static;
type SharedSnapshot = SharedProjectTemplate['snapshot'];

const SHARED_SETTING_KEYS = new Set(['auto_archive', 'subtask_automation']);

type Kind = Exclude<keyof CopyIdMaps, 'fieldType'>;

const KIND_NAMES: Record<Kind, string> = {
  column: 'state',
  type: 'issue type',
  labelGroup: 'label group',
  label: 'label',
  field: 'field',
  option: 'field option',
};

// An option's id is unique among the options of every field.
function partIds(snapshot: SharedSnapshot): Record<Kind, number[]> {
  const ids = (rows: { id: number }[]) => rows.map((row) => row.id);
  return {
    column: ids(snapshot.columns),
    type: ids(snapshot.issueTypes),
    labelGroup: ids(snapshot.labelGroups),
    label: ids(snapshot.labels),
    field: ids(snapshot.customFields),
    option: ids(snapshot.customFields.flatMap((field) => field.options)),
  };
}

// Gives every part of the snapshot the id resolve returns for it, and every reference
// between them too, or drops a reference resolve returns undefined for.
function relink(
  snapshot: SharedSnapshot,
  resolve: (kind: Kind, id: number) => number | undefined,
): SharedSnapshot {
  const own = (kind: Kind, id: number) => resolve(kind, id)!;
  const ref = (kind: Kind, id: number | null) => (id == null ? null : (resolve(kind, id) ?? null));
  const fieldTypes = new Map(snapshot.customFields.map((field) => [field.id, field.fieldType]));
  const refs: References = {
    map: (kind, id) =>
      kind === 'person' || kind === 'initiative' || kind === 'cycle'
        ? undefined
        : resolve(kind, id as number),
    fieldType: (id) => fieldTypes.get(id),
  };
  return {
    ...snapshot,
    columns: snapshot.columns.map((column) => ({ ...column, id: own('column', column.id) })),
    issueTypes: snapshot.issueTypes.map((type) => ({ ...type, id: own('type', type.id) })),
    labelGroups: snapshot.labelGroups.map((group) => ({
      ...group,
      id: own('labelGroup', group.id),
    })),
    labels: snapshot.labels.map((label) => ({
      ...label,
      id: own('label', label.id),
      groupId: ref('labelGroup', label.groupId),
    })),
    customFields: snapshot.customFields.map((field) => ({
      ...field,
      id: own('field', field.id),
      issueTypeId: ref('type', field.issueTypeId),
      options: field.options.map((option) => ({ ...option, id: own('option', option.id) })),
    })),
    issueTemplates: snapshot.issueTemplates.map((tpl) => ({
      ...tpl,
      typeId: ref('type', tpl.typeId),
      columnId: ref('column', tpl.columnId),
      labelIds: tpl.labelIds.flatMap((id) => resolve('label', id) ?? []),
    })),
    views: snapshot.views.map((view) => ({
      ...view,
      filters: mapFilters(view.filters, refs),
      display: mapDisplay(view.display, refs),
    })),
    dashboards: snapshot.dashboards.map((dashboard) => ({
      ...dashboard,
      layout: mapLayout(dashboard.layout, refs),
    })),
    actions: snapshot.actions.map((action) => ({
      ...action,
      condition: mapFilters(action.condition, refs),
      effect: mapEffect(action.effect, refs),
    })),
  };
}

export async function exportProjectTemplate(
  workspaceId: number,
  templateId: number,
): Promise<SharedProjectTemplate> {
  return sharedTemplate(await requireWorkspaceTemplate(workspaceId, templateId));
}

export function sharedTemplate(row: typeof projectTemplate.$inferSelect): SharedProjectTemplate {
  const { sections: _, settings, ...snapshot } = row.snapshot as ProjectSnapshot;
  // Read back as readProjectSnapshot wrote it, which the shared schema describes.
  const read = {
    ...snapshot,
    settings: settings.filter((setting) => SHARED_SETTING_KEYS.has(setting.key)),
  } as SharedSnapshot;
  // A part's number is its place in its kind.
  const numbers = Object.fromEntries(
    Object.entries(partIds(read)).map(([kind, ids]) => [
      kind,
      new Map(ids.map((id, index) => [id, index + 1])),
    ]),
  ) as Record<Kind, Map<number, number>>;
  return {
    format: 'itsaplan.project-template',
    version: 1,
    name: row.name,
    description: row.description,
    snapshot: relink(read, (kind, id) => numbers[kind].get(id)),
  };
}

function assertUnique(values: unknown[], what: string): void {
  if (new Set(values).size !== values.length) throw new HttpError(400, `${what} must be unique`);
}

// The schema checks each value; this checks what the rows of one project must hold
// together, which the database would otherwise refuse only when a project is created
// from the template.
function importedSnapshot(template: SharedProjectTemplate): ProjectSnapshot {
  const { snapshot } = template;
  assertUnique(
    snapshot.columns.map((column) => column.position),
    'Column positions',
  );
  assertUnique(
    snapshot.issueTypes.map((type) => type.name),
    'Issue type names',
  );
  assertUnique(
    snapshot.labelGroups.map((group) => group.name),
    'Label group names',
  );
  assertUnique(
    snapshot.labels.map((label) => label.name),
    'Label names',
  );
  assertUnique(
    snapshot.issueTemplates.map((tpl) => tpl.name),
    'Issue template names',
  );
  for (const tpl of snapshot.issueTemplates) assertUnique(tpl.labelIds, 'Issue template labels');
  assertUnique(
    snapshot.settings.map((setting) => setting.key),
    'Setting keys',
  );
  for (const field of snapshot.customFields) {
    if ((field.fieldType === 'member') !== (field.memberScope !== null)) {
      throw new HttpError(400, 'Only a member field has a member scope');
    }
    assertUnique(
      field.options.map((option) => option.value),
      'Option values',
    );
  }
  if (snapshot.issueTypes.filter((type) => type.isDefault).length > 1) {
    throw new HttpError(400, 'Only one issue type can be the default');
  }
  const ids = partIds(snapshot);
  const known = {} as Record<Kind, Set<number>>;
  for (const kind of Object.keys(ids) as Kind[]) {
    assertUnique(ids[kind], `The ${KIND_NAMES[kind]} ids`);
    known[kind] = new Set(ids[kind]);
  }
  const relinked = relink(snapshot, (kind, id) => {
    if (known[kind].has(id)) return id;
    throw new HttpError(400, `The template has no ${KIND_NAMES[kind]} ${id}`);
  });
  return { ...relinked, sections: {} };
}

export function previewImportedTemplate(template: SharedProjectTemplate): ProjectTemplateContents {
  return templateContents(importedSnapshot(template));
}

export function importProjectTemplate(
  workspaceId: number,
  input: {
    template: SharedProjectTemplate;
    name: string;
    description?: string;
    teamIds?: number[];
  },
): Promise<ProjectTemplate> {
  return createTemplate(workspaceId, input, importedSnapshot(input.template));
}
