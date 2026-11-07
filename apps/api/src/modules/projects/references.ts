// The references to other parts of a project that views, actions and dashboard widgets
// hold inside the jsonb the web app writes (utils/filters.ts, utils/viewSettings.ts and
// utils/dashboardWidgets.ts there). A project copy points them at the rows of the new
// project, and a shared template at the numbers its file gives them.

export type ReferenceKind =
  'column' | 'type' | 'label' | 'field' | 'option' | 'person' | 'initiative' | 'cycle';

export interface References {
  // What the reference becomes, or undefined when it is dropped.
  map(kind: ReferenceKind, id: number | string): number | string | undefined;
  // The type of the field a `cf:<id>` key names, by the id the key holds.
  fieldType(id: number): string | undefined;
}

type Blob = Record<string, unknown>;

const isBlob = (value: unknown): value is Blob =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isReference = (kind: ReferenceKind, value: unknown): value is number | string =>
  kind === 'person' ? typeof value === 'string' : typeof value === 'number';

const kept = (values: unknown[], map: (value: unknown) => unknown) =>
  values.flatMap((value) => {
    const mapped = map(value);
    return mapped === undefined ? [] : [mapped];
  });

function fieldIdOf(key: unknown): number | null {
  return typeof key === 'string' && /^cf:\d+$/.test(key) ? Number(key.slice(3)) : null;
}

function mapFieldKey(key: unknown, refs: References): unknown {
  const id = fieldIdOf(key);
  if (id == null) return key;
  const mapped = refs.map('field', id);
  return mapped === undefined ? undefined : `cf:${mapped}`;
}

// What the values of a condition on the field name. Null for values that name nothing: a
// priority, a state type, a date, text, or a whole status of the cycles or initiatives
// (`status:<status>`, which is not a number).
function valueKind(field: unknown, refs: References): ReferenceKind | null {
  switch (field) {
    case 'status':
      return 'column';
    case 'type':
      return 'type';
    case 'labels':
      return 'label';
    case 'assignee':
    case 'delegate':
      return 'person';
    case 'initiative':
      return 'initiative';
    case 'cycle':
      return 'cycle';
  }
  const fieldId = fieldIdOf(field);
  if (fieldId == null) return null;
  const type = refs.fieldType(fieldId);
  if (type === 'select' || type === 'multi_select') return 'option';
  return type === 'member' ? 'person' : null;
}

// A condition on a dropped field goes, and so does one that loses every value it had. A
// condition's id only tells it from the others of its set, so the set numbers them.
export function mapFilters(filters: unknown, refs: References): unknown {
  if (!isBlob(filters) || !Array.isArray(filters.conditions)) return filters;
  const conditions = filters.conditions.flatMap((condition: unknown) => {
    if (!isBlob(condition)) return [];
    const field = mapFieldKey(condition.field, refs);
    if (field === undefined) return [];
    const kind = valueKind(condition.field, refs);
    if (!kind || !Array.isArray(condition.values)) return [{ ...condition, field }];
    const values = kept(condition.values, (value) =>
      isReference(kind, value) ? refs.map(kind, value) : value,
    );
    if (values.length === 0 && condition.values.length > 0) return [];
    return [{ ...condition, field, values }];
  });
  return {
    ...filters,
    conditions: conditions.map((condition, index) => ({ ...condition, id: String(index + 1) })),
  };
}

const GROUP_KINDS: Record<string, ReferenceKind> = {
  c: 'column',
  t: 'type',
  i: 'initiative',
  y: 'cycle',
  a: 'person',
  d: 'person',
};

// The keys of groupKeyOf in the web app: c<columnId>, t<typeId>, i<initiativeId>,
// y<cycleId>, a<userId>, d<userId>, f<fieldId>u<userId> and f<fieldId>-none name
// something; 'all', a priority (p<priority>) and the other *-none buckets do not.
function mapGroupKey(key: unknown, refs: References): unknown {
  if (typeof key !== 'string' || key === 'all') return key;
  const member = /^f(\d+)(?:u(.+)|-none)$/.exec(key);
  if (member) {
    const field = refs.map('field', Number(member[1]));
    if (field === undefined) return undefined;
    if (member[2] === undefined) return `f${field}-none`;
    const person = refs.map('person', member[2]);
    return person === undefined ? undefined : `f${field}u${person}`;
  }
  const kind = GROUP_KINDS[key[0]];
  const id = key.slice(1);
  if (!kind || id === '-none') return key;
  const mapped = refs.map(kind, kind === 'person' ? id : Number(id));
  return mapped === undefined ? undefined : `${key[0]}${mapped}`;
}

// A grouping or a date field that is dropped leaves its key out, which the web app reads
// as the view's default.
export function mapDisplay(display: unknown, refs: References): unknown {
  if (!isBlob(display)) return display;
  const out: Blob = { ...display };
  for (const key of ['group', 'subgroup', 'calendarDateField']) {
    const mapped = mapFieldKey(out[key], refs);
    if (mapped === undefined) delete out[key];
    else out[key] = mapped;
  }
  if (Array.isArray(out.properties)) {
    out.properties = kept(out.properties, (key) => mapFieldKey(key, refs));
  }
  for (const key of ['hiddenGroups', 'collapsedGroups']) {
    const groups = out[key];
    if (Array.isArray(groups)) out[key] = kept(groups, (group) => mapGroupKey(group, refs));
  }
  if (typeof out.pinnedGroup === 'string') {
    out.pinnedGroup = mapGroupKey(out.pinnedGroup, refs) ?? null;
  }
  return out;
}

// A key that is there sets what it names, so a dropped reference takes its key with it
// rather than leaving null, which clears it.
function mapKeys(blob: Blob, kinds: Record<string, ReferenceKind>, refs: References): Blob {
  const out: Blob = { ...blob };
  for (const [key, kind] of Object.entries(kinds)) {
    const value = out[key];
    if (!isReference(kind, value)) continue;
    const mapped = refs.map(kind, value);
    if (mapped === undefined) delete out[key];
    else out[key] = mapped;
  }
  return out;
}

// An action's effect is a partial issue patch.
export function mapEffect(effect: unknown, refs: References): unknown {
  if (!isBlob(effect)) return effect;
  const out = mapKeys(
    effect,
    { columnId: 'column', typeId: 'type', assigneeUserId: 'person' },
    refs,
  );
  if (Array.isArray(out.labelIds)) {
    out.labelIds = kept(out.labelIds, (id) =>
      isReference('label', id) ? refs.map('label', id) : id,
    );
  }
  return out;
}

// A widget's id only tells it from the others of its dashboard, so the layout numbers
// them.
export function mapLayout(layout: unknown, refs: References): unknown[] {
  if (!Array.isArray(layout)) return [];
  return layout.filter(isBlob).map((widget, index) => {
    const out: Blob = { ...widget, id: String(index + 1) };
    if (isBlob(widget.config)) {
      const config = mapKeys(
        widget.config,
        { typeId: 'type', actorUserId: 'person', initiativeId: 'initiative' },
        refs,
      );
      if ('filters' in config) config.filters = mapFilters(config.filters, refs);
      out.config = config;
    }
    return out;
  });
}
