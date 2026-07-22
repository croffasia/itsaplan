// Serialize/parse a project's issue types for the copy/paste transfer between
// projects. The clipboard payload is a small JSON envelope. Matching is by name;
// a new type is created, a same-name type with a different color is recolored.

import type { IssueType } from '@/lib/api';
import { DEFAULT_COLOR } from '@/utils/project';

const PAYLOAD_TYPE = 'plan.issue-types';
const PAYLOAD_VERSION = 1;

export interface IssueTypeTransfer {
  name: string;
  icon: string;
  color: string;
}

interface IssueTypesEnvelope {
  type: typeof PAYLOAD_TYPE;
  version: number;
  issueTypes: IssueTypeTransfer[];
}

// A parsed issue type paired with what applying it would do to the current project.
export interface PlannedIssueType extends IssueTypeTransfer {
  action: 'create' | 'update' | 'unchanged';
  existingId?: number;
}

// The clipboard text for the project's issue types, in order.
export function serializeIssueTypes(types: IssueType[]): string {
  const envelope: IssueTypesEnvelope = {
    type: PAYLOAD_TYPE,
    version: PAYLOAD_VERSION,
    issueTypes: types.map((t) => ({ name: t.name, icon: t.icon, color: t.color })),
  };
  return JSON.stringify(envelope, null, 2);
}

// Parses clipboard text into issue types, or throws with a user-facing message.
export function parseIssueTypesText(text: string): IssueTypeTransfer[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Clipboard does not contain valid JSON.');
  }
  const env = data as Partial<IssueTypesEnvelope>;
  if (!env || env.type !== PAYLOAD_TYPE || !Array.isArray(env.issueTypes)) {
    throw new Error('Clipboard does not contain an issue types export.');
  }
  const types: IssueTypeTransfer[] = [];
  const seen = new Set<string>();
  for (const raw of env.issueTypes) {
    const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    types.push({
      name,
      icon: typeof raw?.icon === 'string' ? raw.icon : '',
      color: typeof raw?.color === 'string' ? raw.color : DEFAULT_COLOR,
    });
  }
  if (types.length === 0) throw new Error('The issue types export is empty.');
  return types;
}

// Decides what applying each incoming type does against the current types, matching by
// name (case-insensitive). A match with a different color is recolored; a match with
// the same color is a no-op; otherwise a new type is created.
export function planIssueTypesImport(
  incoming: IssueTypeTransfer[],
  existing: IssueType[],
): PlannedIssueType[] {
  const byName = new Map(existing.map((t) => [t.name.toLowerCase(), t]));
  return incoming.map((type) => {
    const match = byName.get(type.name.toLowerCase());
    if (!match) return { ...type, action: 'create' };
    const action = match.color.toLowerCase() === type.color.toLowerCase() ? 'unchanged' : 'update';
    return { ...type, action, existingId: match.id };
  });
}
