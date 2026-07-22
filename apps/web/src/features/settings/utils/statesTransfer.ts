// Serialize/parse a project's workflow states (columns) for the copy/paste transfer
// between projects. The clipboard payload is a small JSON envelope; parsing validates
// it and drops states with an unknown state type.

import type { Column, StateType } from '@/lib/api';
import { STATE_TYPES } from '@/utils/fieldOptions';
import { DEFAULT_COLOR } from '@/utils/project';

const PAYLOAD_TYPE = 'plan.states';
const PAYLOAD_VERSION = 1;

export interface StateTransfer {
  name: string;
  stateType: StateType;
  color: string;
}

interface StatesEnvelope {
  type: typeof PAYLOAD_TYPE;
  version: number;
  states: StateTransfer[];
}

// A parsed state paired with what applying it would do to the current project.
export interface PlannedState extends StateTransfer {
  action: 'create' | 'update' | 'unchanged';
  existingId?: number;
}

// The clipboard text for the project's states, in board order.
export function serializeStates(columns: Column[]): string {
  const envelope: StatesEnvelope = {
    type: PAYLOAD_TYPE,
    version: PAYLOAD_VERSION,
    states: columns.map((c) => ({ name: c.name, stateType: c.stateType, color: c.color })),
  };
  return JSON.stringify(envelope, null, 2);
}

// Parses clipboard text into states, or throws with a user-facing message.
export function parseStatesText(text: string): StateTransfer[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Clipboard does not contain valid JSON.');
  }
  const env = data as Partial<StatesEnvelope>;
  if (!env || env.type !== PAYLOAD_TYPE || !Array.isArray(env.states)) {
    throw new Error('Clipboard does not contain a states export.');
  }
  const states: StateTransfer[] = [];
  const seen = new Set<string>();
  for (const raw of env.states) {
    const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
    const stateType = raw?.stateType;
    if (!name || !STATE_TYPES.includes(stateType as StateType)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const color = typeof raw?.color === 'string' ? raw.color : DEFAULT_COLOR;
    states.push({ name, stateType: stateType as StateType, color });
  }
  if (states.length === 0) throw new Error('The states export is empty.');
  return states;
}

// Decides what applying each incoming state does against the current columns, matching
// by name (case-insensitive). A match with a different color updates the color; a match
// with the same color is a no-op; otherwise a new state is created in its group.
export function planStatesImport(incoming: StateTransfer[], existing: Column[]): PlannedState[] {
  const byName = new Map(existing.map((c) => [c.name.toLowerCase(), c]));
  return incoming.map((state) => {
    const match = byName.get(state.name.toLowerCase());
    if (!match) return { ...state, action: 'create' };
    const action = match.color.toLowerCase() === state.color.toLowerCase() ? 'unchanged' : 'update';
    return { ...state, action, existingId: match.id };
  });
}
