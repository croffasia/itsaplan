// Serialize/parse a project's labels (and their groups) for the copy/paste transfer
// between projects. The clipboard payload is a small JSON envelope holding the groups
// and the labels, each label naming its group. Matching is by name; a new group/label
// is created, and a same-name one with a different color is recolored.

import type { Label, LabelGroup } from '@/lib/api';
import { DEFAULT_COLOR } from '@/utils/project';

const PAYLOAD_TYPE = 'plan.labels';
const PAYLOAD_VERSION = 1;

export interface LabelGroupTransfer {
  name: string;
  color: string;
}

export interface LabelTransfer {
  name: string;
  color: string;
  group: string | null;
}

interface LabelsEnvelope {
  type: typeof PAYLOAD_TYPE;
  version: number;
  groups: LabelGroupTransfer[];
  labels: LabelTransfer[];
}

type TransferAction = 'create' | 'update' | 'unchanged';

export interface PlannedGroup extends LabelGroupTransfer {
  action: TransferAction;
  existingId?: number;
}

export interface PlannedLabel extends LabelTransfer {
  action: TransferAction;
  existingId?: number;
}

export interface LabelsImportPlan {
  groups: PlannedGroup[];
  labels: PlannedLabel[];
}

// The clipboard text for the project's groups and labels.
export function serializeLabels(groups: LabelGroup[], labels: Label[]): string {
  const groupNameById = new Map(groups.map((g) => [g.id, g.name]));
  const envelope: LabelsEnvelope = {
    type: PAYLOAD_TYPE,
    version: PAYLOAD_VERSION,
    groups: groups.map((g) => ({ name: g.name, color: g.color })),
    labels: labels.map((l) => ({
      name: l.name,
      color: l.color,
      group: l.groupId != null ? (groupNameById.get(l.groupId) ?? null) : null,
    })),
  };
  return JSON.stringify(envelope, null, 2);
}

// Parses clipboard text into groups and labels, or throws with a user-facing message.
export function parseLabelsText(text: string): {
  groups: LabelGroupTransfer[];
  labels: LabelTransfer[];
} {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Clipboard does not contain valid JSON.');
  }
  const env = data as Partial<LabelsEnvelope>;
  if (
    !env ||
    env.type !== PAYLOAD_TYPE ||
    !Array.isArray(env.labels) ||
    !Array.isArray(env.groups)
  ) {
    throw new Error('Clipboard does not contain a labels export.');
  }

  const groups: LabelGroupTransfer[] = [];
  const seenGroups = new Set<string>();
  for (const raw of env.groups) {
    const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
    if (!name || seenGroups.has(name.toLowerCase())) continue;
    seenGroups.add(name.toLowerCase());
    groups.push({ name, color: typeof raw?.color === 'string' ? raw.color : DEFAULT_COLOR });
  }

  const labels: LabelTransfer[] = [];
  const seenLabels = new Set<string>();
  for (const raw of env.labels) {
    const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
    if (!name || seenLabels.has(name.toLowerCase())) continue;
    seenLabels.add(name.toLowerCase());
    const group = typeof raw?.group === 'string' && raw.group.trim() ? raw.group.trim() : null;
    labels.push({ name, color: typeof raw?.color === 'string' ? raw.color : DEFAULT_COLOR, group });
  }

  if (groups.length === 0 && labels.length === 0) throw new Error('The labels export is empty.');
  return { groups, labels };
}

// Decides what applying the incoming groups and labels does against the current ones,
// matching by name (case-insensitive). A match with a different color is recolored; a
// match with the same color is a no-op; otherwise it is created. A matched label keeps
// its current group (only its color is updated).
export function planLabelsImport(
  incoming: { groups: LabelGroupTransfer[]; labels: LabelTransfer[] },
  existingGroups: LabelGroup[],
  existingLabels: Label[],
): LabelsImportPlan {
  const groupByName = new Map(existingGroups.map((g) => [g.name.toLowerCase(), g]));
  const labelByName = new Map(existingLabels.map((l) => [l.name.toLowerCase(), l]));

  const groups: PlannedGroup[] = incoming.groups.map((group) => {
    const match = groupByName.get(group.name.toLowerCase());
    if (!match) return { ...group, action: 'create' };
    return {
      ...group,
      action: match.color.toLowerCase() === group.color.toLowerCase() ? 'unchanged' : 'update',
      existingId: match.id,
    };
  });

  const labels: PlannedLabel[] = incoming.labels.map((label) => {
    const match = labelByName.get(label.name.toLowerCase());
    if (!match) return { ...label, action: 'create' };
    return {
      ...label,
      action: match.color.toLowerCase() === label.color.toLowerCase() ? 'unchanged' : 'update',
      existingId: match.id,
    };
  });

  return { groups, labels };
}
