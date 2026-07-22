import { type CopyProjectIncludeKey } from '@/lib/api';
import { Checkbox } from '@/components/ui/checkbox';

export type CopyInclude = Record<CopyProjectIncludeKey, boolean>;

// What each entity needs copied alongside it. Mirrors the API's normalizeInclude:
// a view/action remaps state/type/label/field ids, a tool binds a credential, a
// schedule belongs to an agent. Checking a child enables its requirements;
// unchecking a requirement disables the children that need it.
const REQUIRES: Record<CopyProjectIncludeKey, CopyProjectIncludeKey[]> = {
  states: [],
  issueTypes: [],
  labels: [],
  customFields: ['issueTypes'],
  views: ['states', 'issueTypes', 'labels', 'customFields'],
  dashboards: [],
  actions: ['states', 'issueTypes', 'labels'],
  archive: [],
  roles: [],
  notificationProviders: [],
  webhooks: [],
  integrations: [],
  tools: ['integrations'],
  skills: [],
  agents: [],
  schedules: ['agents'],
};

const LABELS: Record<CopyProjectIncludeKey, string> = {
  states: 'States',
  issueTypes: 'Issue types',
  labels: 'Labels',
  customFields: 'Custom fields',
  views: 'Views',
  dashboards: 'Dashboards',
  actions: 'Actions',
  archive: 'Archive settings',
  roles: 'Roles',
  notificationProviders: 'Notification providers',
  webhooks: 'Webhooks',
  integrations: 'Integrations',
  tools: 'Tools',
  skills: 'Skills',
  agents: 'Agents',
  schedules: 'Schedules',
};

type Group = { title: string; keys: CopyProjectIncludeKey[] };

// Groups assigned to the four rendered columns by hand, keeping each column close
// to the same number of rows.
const COLUMNS: Group[][] = [
  [{ title: 'Workflow', keys: ['states', 'issueTypes', 'labels', 'customFields', 'archive'] }],
  [{ title: 'Automation', keys: ['actions', 'schedules', 'webhooks'] }],
  [{ title: 'AI Team', keys: ['agents', 'integrations', 'skills', 'tools'] }],
  [
    { title: 'Project', keys: ['roles', 'notificationProviders'] },
    { title: 'Views', keys: ['views', 'dashboards'] },
  ],
];

const ALL_KEYS = COLUMNS.flat().flatMap((g) => g.keys);

const selectAll = (on: boolean): CopyInclude =>
  Object.fromEntries(ALL_KEYS.map((k) => [k, on])) as CopyInclude;

export const allSelected = (): CopyInclude => selectAll(true);

function applyToggle(sel: CopyInclude, key: CopyProjectIncludeKey, checked: boolean): CopyInclude {
  const next = { ...sel, [key]: checked };
  if (checked) {
    // Enable everything this key requires, transitively.
    const stack = [...REQUIRES[key]];
    while (stack.length) {
      const dep = stack.pop()!;
      if (!next[dep]) next[dep] = true;
      stack.push(...REQUIRES[dep]);
    }
  } else {
    // Disable anything that requires this key, transitively.
    let changed = true;
    while (changed) {
      changed = false;
      for (const k of ALL_KEYS) {
        if (next[k] && REQUIRES[k].some((dep) => !next[dep])) {
          next[k] = false;
          changed = true;
        }
      }
    }
  }
  return next;
}

// Grid of copy options, grouped by settings section. Selecting a dependent option
// pulls in the entities it references; clearing a required one clears its dependents.
export default function CopyProjectOptions({
  value,
  onChange,
}: {
  value: CopyInclude;
  onChange: (next: CopyInclude) => void;
}) {
  const total = ALL_KEYS.length;
  const selectedCount = ALL_KEYS.filter((k) => value[k]).length;
  const allOn = selectedCount === total;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">
          Copy configuration{' '}
          <span className="text-xs font-normal text-muted-foreground tabular-nums">
            {selectedCount}/{total}
          </span>
        </span>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={() => onChange(selectAll(!allOn))}
        >
          {allOn ? 'Clear all' : 'Select all'}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-4">
        {COLUMNS.map((column, i) => (
          <div key={i} className="space-y-3">
            {column.map((group) => (
              <div key={group.title} className="space-y-1">
                <p className="text-xs text-muted-foreground">{group.title}</p>
                {group.keys.map((key) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
                  >
                    <Checkbox
                      checked={value[key]}
                      onCheckedChange={(c) => onChange(applyToggle(value, key, c === true))}
                    />
                    {LABELS[key]}
                  </label>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
