// Per-view display settings, stored per project. Each project remembers its own
// settings for every view independently. The type is a superset of every view's
// options; each view reads only the fields it uses, and the Display popover
// shows only the controls that apply to the active view. Missing fields fall
// back to per-view defaults, so the store grows new options without a migration.

import type { ProjectFeatureSet } from '@/utils/projectFeatures';
import type { Sort, WorkItemsView } from '@/utils/viewTypes';

// Field the Project columns / Table sections group by. 'none' is a single flat
// list (Table only). Project always groups by something. `subgroup` (below) adds a
// second level: Project swimlanes / Table sub-sections, and may be 'none'.
// A `cf:<id>` key groups by a member custom field, which holds one person or agent
// the way assignee and delegate do.
export type BuiltinGroupField =
  'none' | 'status' | 'assignee' | 'delegate' | 'priority' | 'type' | 'initiative' | 'cycle';
export type GroupField = BuiltinGroupField | CustomFieldKey;

// Issue properties that can be shown on a Project card or as a Table column.
// 'id' is the issue identifier; 'status' the state; the rest map to issue
// fields directly.
export type DisplayProperty =
  | 'id'
  | 'status'
  | 'priority'
  | 'type'
  | 'assignee'
  | 'delegate'
  | 'initiative'
  | 'cycle'
  | 'labels'
  | 'estimatePoints'
  | 'estimateTime'
  | 'startDate'
  | 'dueDate'
  | 'created'
  | 'updated'
  | 'statusAge';

// A custom field shown as a Table column, keyed by its id as `cf:<id>`. Kept
// distinct from the built-in DisplayProperty union so both can live in the same
// `properties` list. Stale keys (a since-deleted field) are ignored at render.
export type CustomFieldKey = `cf:${number}`;
export type PropertyKey = DisplayProperty | CustomFieldKey;

export const isCustomFieldKey = (p: string): p is CustomFieldKey => /^cf:\d+$/.test(p);
export const customFieldKey = (id: number): CustomFieldKey => `cf:${id}`;
export const customFieldId = (key: CustomFieldKey): number => Number(key.slice(3));

// Every display property, in the canonical order they render (left to right on a
// card, and as Table columns after the title). Used to render the property
// toggles and to keep column order stable regardless of toggle order. The name of
// a property is a message under `display.properties`.
export const DISPLAY_PROPERTIES: DisplayProperty[] = [
  'id',
  'status',
  'priority',
  'type',
  'assignee',
  'delegate',
  'initiative',
  'cycle',
  'labels',
  'estimatePoints',
  'estimateTime',
  'startDate',
  'dueDate',
  'created',
  'updated',
  'statusAge',
];

// The grouping fields and display properties that need a section or an estimate
// kind the project can have off. Grouping by one while its section is off would
// render columns for something the project does not show, and its property would
// print a value from there; an estimate property would offer a field the project
// does not use.
const SECTION_FIELDS: Partial<
  Record<BuiltinGroupField | DisplayProperty, keyof ProjectFeatureSet>
> = {
  initiative: 'initiatives',
  cycle: 'cycles',
  estimatePoints: 'pointsEstimate',
  estimateTime: 'timeEstimate',
};

// Whether a grouping field or display property applies to a project: the ones behind
// an optional section only while it is on. A custom field key is never section-bound.
export function isFieldEnabled(
  field: GroupField | PropertyKey,
  features: ProjectFeatureSet,
): boolean {
  const section = SECTION_FIELDS[field as BuiltinGroupField];
  return section === undefined || features[section];
}

// The display properties a project offers, without the ones whose section is off.
export function offeredDisplayProperties(features: ProjectFeatureSet): DisplayProperty[] {
  return DISPLAY_PROPERTIES.filter((p) => isFieldEnabled(p, features));
}

// Timeline zoom: how much horizontal space one day gets, which sets whether day
// numbers or only week/month ticks are legible.
export type TimelineScale = 'week' | 'month' | 'quarter';

// Which date drives Calendar placement (and the Timeline is start->due always).
// A `cf:<id>` key places the issues by a date, datetime or datetime range custom
// field; a stale key (a since-deleted field) falls back to the due date.
export type BuiltinDateField = 'dueDate' | 'startDate';
export type DateField = BuiltinDateField | CustomFieldKey;

// date-fns weekStartsOn: 0 Sunday, 1 Monday.
export type WeekStart = 0 | 1;

export interface ViewSettings {
  sort: Sort;
  group: GroupField;
  // Second grouping level: Project swimlanes (rows) / Table and Timeline
  // sub-sections. 'none' disables it. Kept distinct from `group`; the Display
  // panel never offers the primary field here, and normalizeViewSettings forces
  // it back to 'none' if it ever equals `group`.
  subgroup: GroupField;
  showEmptyGroups: boolean;
  // The issues' relations: rows under a Kanban card, sub-rows under a Table or
  // Timeline row. Off by default — the relations are an extra load, and most
  // boards do not use them.
  showLinks: boolean;
  // The issues' subtasks, rendered the same way under their parent. Toggled by the
  // Nested subtasks chip in Display properties, and by a row of its own on the
  // Timeline, which has no chips.
  showSubtasks: boolean;
  // Whether a subtask also gets a card or row of its own next to the other issues.
  // Independent of showSubtasks: with both on it shows in both places, with both
  // off it is only visible inside its parent issue.
  separateSubtasks: boolean;
  properties: PropertyKey[];
  timelineScale: TimelineScale;
  // Initial Timeline group state. Individual group toggles are transient and do
  // not update this saved preference.
  timelineCollapseAll: boolean;
  calendarDateField: DateField;
  weekStart: WeekStart;
  // Group keys collapsed into the "Hidden columns" panel on the flat project (see
  // KanbanBoard). Keys are namespaced by grouping field (c<id>/a<id>/p<v>/t<id>/
  // f<fieldId>u<userId>), so a set from one grouping never matches another. Empty
  // for every other layout. Part of the display, so each saved view keeps its own
  // hidden set.
  hiddenGroups: string[];
  // Group keys collapsed to a narrow vertical strip on the flat project. Unlike
  // hiddenGroups the column stays in place (in column order) with its count
  // visible; collapsing only gives its horizontal space back. Namespaced like
  // hiddenGroups, empty for every other layout, and part of the display so each
  // saved view keeps its own collapsed set.
  collapsedGroups: string[];
  // Group key of the column pinned to the start edge of the flat project, or null
  // when none is. Namespaced like hiddenGroups, and null for every other layout.
  pinnedGroup: string | null;
}

const DEFAULT_SORT: Sort = { field: 'manual', dir: 'asc' };

// Options shared by every view; group, subgroup and properties differ per view.
const COMMON: Omit<ViewSettings, 'group' | 'subgroup' | 'properties' | 'sort'> = {
  showEmptyGroups: true,
  showLinks: false,
  showSubtasks: true,
  separateSubtasks: false,
  timelineScale: 'week',
  timelineCollapseAll: false,
  calendarDateField: 'dueDate',
  weekStart: 0,
  hiddenGroups: [],
  collapsedGroups: [],
  pinnedGroup: null,
};

// The properties shown by default per view; the Timeline and Calendar lay issues
// out by date and show none.
const DEFAULT_PROPERTIES: Record<WorkItemsView, DisplayProperty[]> = {
  kanban: [
    'id',
    'status',
    'statusAge',
    'priority',
    'type',
    'dueDate',
    'labels',
    'assignee',
    'created',
    'updated',
  ],
  table: ['priority', 'labels', 'startDate', 'dueDate', 'assignee'],
  timeline: [],
  calendar: [],
};

export function defaultViewSettings(view: WorkItemsView): ViewSettings {
  const group: GroupField = view === 'calendar' ? 'none' : 'status';
  return {
    ...COMMON,
    sort: { ...DEFAULT_SORT },
    group,
    subgroup: 'none',
    properties: [...DEFAULT_PROPERTIES[view]],
  };
}

const GROUP_FIELDS: BuiltinGroupField[] = [
  'none',
  'status',
  'assignee',
  'delegate',
  'priority',
  'type',
  'initiative',
  'cycle',
];
const DISPLAY_VALUES: string[] = DISPLAY_PROPERTIES;
const TIMELINE_SCALES: TimelineScale[] = ['week', 'month', 'quarter'];

const isGroupField = (value: unknown): value is GroupField =>
  typeof value === 'string' &&
  (GROUP_FIELDS.includes(value as BuiltinGroupField) || isCustomFieldKey(value));

function normalizeSort(sort: unknown): Sort | null {
  if (sort && typeof sort === 'object') {
    const s = sort as Partial<Sort>;
    if (s.field && (s.dir === 'asc' || s.dir === 'desc')) return { field: s.field, dir: s.dir };
  }
  return null;
}

// localStorage holds a map of project key -> per-view settings, each stored as a
// partial that is merged over the per-view defaults on read.
const STORE_KEY = 'planner_view_settings';
type Store = Record<string, Partial<Record<WorkItemsView, Partial<ViewSettings>>>>;

function readStore(): Store {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    if (!parsed || typeof parsed !== 'object') return {};
    const store = parsed as Store;
    // Migrate the kanban layout's stored settings from its former key 'board'.
    for (const perView of Object.values(store)) {
      const legacy = perView as Record<string, Partial<ViewSettings> | undefined>;
      if (legacy.board && !legacy.kanban) {
        legacy.kanban = legacy.board;
        delete legacy.board;
      }
    }
    return store;
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

// Validates a stored partial against the per-view defaults, keeping only
// recognized values. Shared by the localStorage store (getViewSettings) and by
// saved views, whose display blob comes from the DB (see normalizeSavedDisplay).
export function normalizeViewSettings(
  s: Partial<ViewSettings> | null | undefined,
  view: WorkItemsView,
): ViewSettings {
  const d = defaultViewSettings(view);
  if (!s) return d;
  const storedGroup = isGroupField(s.group) ? s.group : d.group;
  // Timeline was previously hard-coded to State while its persisted group was
  // `none`. Normalize that legacy value so existing local and saved views keep
  // their visible grouping after the control becomes configurable.
  const group = view === 'timeline' && storedGroup === 'none' ? d.group : storedGroup;
  // The sub-group is only kept when it names a different field than the primary
  // group; grouping twice by the same field would collapse to one level.
  const rawSubgroup = isGroupField(s.subgroup) ? s.subgroup : 'none';
  return {
    sort: normalizeSort(s.sort) ?? d.sort,
    group,
    subgroup: rawSubgroup !== 'none' && rawSubgroup !== group ? rawSubgroup : 'none',
    showEmptyGroups: typeof s.showEmptyGroups === 'boolean' ? s.showEmptyGroups : d.showEmptyGroups,
    showLinks: typeof s.showLinks === 'boolean' ? s.showLinks : d.showLinks,
    showSubtasks: typeof s.showSubtasks === 'boolean' ? s.showSubtasks : d.showSubtasks,
    separateSubtasks:
      typeof s.separateSubtasks === 'boolean' ? s.separateSubtasks : d.separateSubtasks,
    // Stored order is preserved as-is (it is the Table column order, reorderable
    // by drag); only unknown entries are dropped. A since-deleted custom field's
    // key stays until the next reorder, and is ignored when rendering.
    properties: Array.isArray(s.properties)
      ? (s.properties as unknown[]).filter(
          (p): p is PropertyKey =>
            typeof p === 'string' && (DISPLAY_VALUES.includes(p) || isCustomFieldKey(p)),
        )
      : d.properties,
    timelineScale: TIMELINE_SCALES.includes(s.timelineScale as TimelineScale)
      ? (s.timelineScale as TimelineScale)
      : d.timelineScale,
    timelineCollapseAll:
      typeof s.timelineCollapseAll === 'boolean' ? s.timelineCollapseAll : d.timelineCollapseAll,
    calendarDateField:
      s.calendarDateField === 'startDate' ||
      s.calendarDateField === 'dueDate' ||
      (typeof s.calendarDateField === 'string' && isCustomFieldKey(s.calendarDateField))
        ? s.calendarDateField
        : d.calendarDateField,
    weekStart: s.weekStart === 0 || s.weekStart === 1 ? s.weekStart : d.weekStart,
    hiddenGroups: Array.isArray(s.hiddenGroups)
      ? (s.hiddenGroups as unknown[]).filter((x): x is string => typeof x === 'string')
      : d.hiddenGroups,
    collapsedGroups: Array.isArray(s.collapsedGroups)
      ? (s.collapsedGroups as unknown[]).filter((x): x is string => typeof x === 'string')
      : d.collapsedGroups,
    pinnedGroup: typeof s.pinnedGroup === 'string' ? s.pinnedGroup : d.pinnedGroup,
  };
}

// The same settings without the grouping, sub-grouping, display properties and
// subtask rows of a section the project has turned off: a display built while the
// section was on then renders no dead column, lane, property or row.
export function withoutHiddenSections(
  settings: ViewSettings,
  features: ProjectFeatureSet,
): ViewSettings {
  return {
    ...settings,
    group: isFieldEnabled(settings.group, features) ? settings.group : 'status',
    subgroup: isFieldEnabled(settings.subgroup, features) ? settings.subgroup : 'none',
    properties: settings.properties.filter((p) => isFieldEnabled(p, features)),
    showSubtasks: features.subtasks && settings.showSubtasks,
  };
}

// The counterpart of withoutHiddenSections: puts the stored choices of a hidden
// section back into a display edited while it was off, each property at the column
// position it had. The panel could not show them, so an edit made then must not
// drop them — the display comes back as it was once the section is on again. A
// value the user did change carries through, since it then differs from what
// stripping left.
export function restoreHiddenSections(
  edited: ViewSettings,
  stored: ViewSettings,
  features: ProjectFeatureSet,
): ViewSettings {
  const hidden = (field: GroupField | PropertyKey) => !isFieldEnabled(field, features);
  // Stored order is ascending, so every insert lands at the index it had once the
  // earlier hidden properties are back.
  const properties = [...edited.properties];
  stored.properties.forEach((p, index) => {
    if (hidden(p)) properties.splice(index, 0, p);
  });
  return {
    ...edited,
    group: hidden(stored.group) && edited.group === 'status' ? stored.group : edited.group,
    subgroup:
      hidden(stored.subgroup) && edited.subgroup === 'none' ? stored.subgroup : edited.subgroup,
    properties,
    showSubtasks: features.subtasks ? edited.showSubtasks : stored.showSubtasks,
  };
}

// Settings for one project+view, each field validated against the stored partial
// and falling back to the per-view default.
export function getViewSettings(projectKey: string, view: WorkItemsView): ViewSettings {
  return normalizeViewSettings(readStore()[projectKey]?.[view], view);
}

// A saved view's display snapshot: which layout is active plus that layout's
// settings. Stored in kanban_views.display and applied when the view is opened.
export interface SavedViewDisplay extends ViewSettings {
  layout: WorkItemsView;
}

const LAYOUTS: WorkItemsView[] = ['kanban', 'table', 'timeline', 'calendar'];

// Normalizes a saved view's display blob (arbitrary JSON from the DB) into a
// SavedViewDisplay, picking the layout first so the settings fall back to that
// layout's defaults.
export function normalizeSavedDisplay(blob: unknown): SavedViewDisplay {
  const b = (blob && typeof blob === 'object' ? blob : {}) as Partial<SavedViewDisplay>;
  const layout: WorkItemsView = LAYOUTS.includes(b.layout as WorkItemsView)
    ? (b.layout as WorkItemsView)
    : 'kanban';
  return { layout, ...normalizeViewSettings(b, layout) };
}

export function setViewSettings(projectKey: string, view: WorkItemsView, settings: ViewSettings) {
  const store = readStore();
  const project = store[projectKey] ?? (store[projectKey] = {});
  project[view] = settings;
  writeStore(store);
}
