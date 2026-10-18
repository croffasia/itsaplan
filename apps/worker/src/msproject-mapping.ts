import { XMLParser } from 'fast-xml-parser';
import type {
  CanonicalIssue,
  CanonicalLabel,
  CanonicalRelation,
  CanonicalState,
} from './canonical';

// Parsing of an MS Project XML (MSPDI) file and its mapping to the canonical import
// shapes. No network, no @repo/db. docs/dev/msproject-import.md has the field mapping.

export const MSPDI_NAMESPACE = 'http://schemas.microsoft.com/project';
export const MILESTONE_LABEL_ID = 'milestone';

export interface MsProjectTask {
  uid: string;
  id: number;
  name: string;
  outlineLevel: number;
  summary: boolean;
  milestone: boolean;
  percentComplete: number;
  priority: number;
  start: string | null;
  finish: string | null;
  created: string | null;
  notes: string;
  predecessorUids: string[];
}

export interface MsProjectPlan {
  createdAt: string;
  tasks: MsProjectTask[];
  // Task uid -> parent task uid, for the tasks that have a parent among `tasks`.
  parents: Map<string, string>;
  // Task uid -> assignee email, for the tasks whose first assigned resource has one.
  assignees: Map<string, string>;
}

export class MspdiParseError extends Error {}

const ARRAY_ELEMENTS = new Set(['Task', 'Resource', 'Assignment', 'PredecessorLink']);

// A DOCTYPE is the only way to declare entities, so refusing it removes entity
// expansion; the five predefined entities are still decoded by the parser.
const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  removeNSPrefix: true,
  processEntities: true,
  htmlEntities: false,
  isArray: (name) => ARRAY_ELEMENTS.has(name),
});

type Node = Record<string, unknown>;

function decode(value: string): string {
  return value.replace(/&#(x[0-9a-f]+|\d+);/gi, (match, code: string) => {
    const point = code[0] === 'x' || code[0] === 'X' ? parseInt(code.slice(1), 16) : Number(code);
    return Number.isInteger(point) && point > 0 && point <= 0x10ffff
      ? String.fromCodePoint(point)
      : match;
  });
}

function text(node: Node, key: string): string {
  const value = node[key];
  return typeof value === 'string' ? decode(value).trim() : '';
}

function list(node: unknown, key: string): Node[] {
  if (!node || typeof node !== 'object') return [];
  const items = (node as Node)[key];
  return Array.isArray(items) ? (items as Node[]) : [];
}

function flag(node: Node, key: string): boolean {
  const value = text(node, key);
  return value === '1' || value.toLowerCase() === 'true';
}

function numberOf(node: Node, key: string, fallback: number): number {
  const value = Number(text(node, key));
  return text(node, key) !== '' && Number.isFinite(value) ? value : fallback;
}

export function parseMspdi(xml: string): MsProjectPlan {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
    throw new MspdiParseError('The file declares a DOCTYPE, which is not supported.');
  }
  let root: Node | undefined;
  try {
    const parsed = parser.parse(xml) as Node;
    root = parsed.Project as Node | undefined;
  } catch {
    throw new MspdiParseError('The file is not valid XML.');
  }
  if (!root || typeof root !== 'object') {
    throw new MspdiParseError('The file is not an MS Project XML (MSPDI) file.');
  }

  const fallbackCreated = text(root, 'CreationDate') || text(root, 'LastSaved');
  const emails = new Map<string, string>();
  for (const r of list(root.Resources, 'Resource')) {
    const email = text(r, 'EmailAddress');
    if (email) emails.set(text(r, 'UID'), email);
  }
  const resourceByTask = new Map<string, string>();
  for (const a of list(root.Assignments, 'Assignment')) {
    const email = emails.get(text(a, 'ResourceUID'));
    const task = text(a, 'TaskUID');
    if (email && !resourceByTask.has(task)) resourceByTask.set(task, email);
  }

  const tasks: MsProjectTask[] = [];
  const parents = new Map<string, string>();
  const ancestors: { uid: string; level: number }[] = [];
  for (const t of list(root.Tasks, 'Task')) {
    const uid = text(t, 'UID');
    const name = text(t, 'Name');
    if (uid === '' || uid === '0' || name === '') continue;
    const level = numberOf(t, 'OutlineLevel', 1);
    while (ancestors.length > 0 && ancestors[ancestors.length - 1]!.level >= level) ancestors.pop();
    const parent = ancestors[ancestors.length - 1];
    if (parent) parents.set(uid, parent.uid);
    ancestors.push({ uid, level });
    tasks.push({
      uid,
      id: numberOf(t, 'ID', Number(uid) || 0),
      name,
      outlineLevel: level,
      summary: flag(t, 'Summary'),
      milestone: flag(t, 'Milestone'),
      percentComplete: numberOf(t, 'PercentComplete', 0),
      priority: numberOf(t, 'Priority', 500),
      start: text(t, 'Start') || null,
      finish: text(t, 'Finish') || null,
      created: text(t, 'CreateDate') || null,
      notes: text(t, 'Notes'),
      predecessorUids: list(t, 'PredecessorLink')
        .map((l) => text(l, 'PredecessorUID'))
        .filter(Boolean),
    });
  }

  const assignees = new Map(
    tasks.flatMap((t) =>
      resourceByTask.has(t.uid) ? [[t.uid, resourceByTask.get(t.uid)!] as const] : [],
    ),
  );
  return {
    createdAt: new Date(fallbackCreated || Date.now()).toISOString(),
    tasks,
    parents,
    assignees,
  };
}

export const MSPROJECT_STATES: CanonicalState[] = [
  // The names of a new project's default columns, so an import into one reuses them.
  { sourceId: 'todo', name: 'Todo', category: 'unstarted' },
  { sourceId: 'in-progress', name: 'In Progress', category: 'started' },
  { sourceId: 'done', name: 'Done', category: 'completed' },
];

export function msprojectStateId(percentComplete: number): string {
  if (percentComplete >= 100) return 'done';
  return percentComplete > 0 ? 'in-progress' : 'todo';
}

// 0-1000, 500 by default.
export function msprojectPriority(priority: number): string {
  if (priority >= 900) return 'urgent';
  if (priority >= 700) return 'high';
  if (priority >= 300) return 'medium';
  return 'low';
}

export function mapMsProjectLabels(plan: MsProjectPlan): CanonicalLabel[] {
  return plan.tasks.some((t) => t.milestone)
    ? [{ sourceId: MILESTONE_LABEL_ID, name: 'Milestone' }]
    : [];
}

function iso(value: string | null, fallback: string): string {
  const time = value ? Date.parse(value) : NaN;
  return Number.isNaN(time) ? fallback : new Date(time).toISOString();
}

export function mapMsProjectTask(task: MsProjectTask, plan: MsProjectPlan): CanonicalIssue {
  const created = iso(task.created, plan.createdAt);
  return {
    sourceId: task.uid,
    sequenceId: task.id,
    title: task.name,
    descriptionMarkdown: task.notes,
    stateSourceId: msprojectStateId(task.percentComplete),
    assigneeEmail: plan.assignees.get(task.uid) ?? null,
    labelSourceIds: task.milestone ? [MILESTONE_LABEL_ID] : [],
    cycleSourceId: null,
    parentSourceId: plan.parents.get(task.uid) ?? null,
    priority: msprojectPriority(task.priority),
    startDate: task.start?.slice(0, 10) ?? null,
    dueDate: task.finish?.slice(0, 10) ?? null,
    customFields: [],
    createdAt: created,
    updatedAt: created,
  };
}

// A predecessor blocks its successor; a link to a task that is not imported is dropped.
export function mapMsProjectRelations(
  task: MsProjectTask,
  plan: MsProjectPlan,
): CanonicalRelation[] {
  const known = new Set(plan.tasks.map((t) => t.uid));
  return task.predecessorUids
    .filter((uid) => known.has(uid) && uid !== task.uid)
    .map((uid) => ({
      kind: 'blocks' as const,
      sourceIssueSourceId: uid,
      targetIssueSourceId: task.uid,
    }));
}
