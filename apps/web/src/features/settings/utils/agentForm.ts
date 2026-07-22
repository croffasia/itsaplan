import type { AgentTool, AiAgent, NewAiAgentInput, AiAgentPatch } from '@/lib/api';

// The editable shape of an agent form. temperature/maxSteps are kept as strings so
// the inputs can be left blank; they are parsed to numbers (or null) on submit.
export interface AgentFormValue {
  name: string;
  username: string;
  kind: 'external' | 'internal';
  modelCredentialId: number | null;
  model: string;
  instructions: string;
  tools: string[];
  temperature: string;
  maxSteps: string;
  memoryEnabled: boolean;
  memoryLastMessages: string;
  triggerOnMention: boolean;
  triggerOnAssign: boolean;
  roleId: number | null;
}

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

// Whether the form holds a submittable value: a non-empty name and a username
// matching the server rules (1-64 chars, [a-zA-Z0-9._-]).
export function isAgentFormValid(v: AgentFormValue): boolean {
  const username = v.username.trim();
  return v.name.trim().length > 0 && username.length <= 64 && USERNAME_PATTERN.test(username);
}

// The form's starting value, from an existing agent when editing or blank defaults
// when creating.
export function initialAgentValue(agent?: AiAgent): AgentFormValue {
  return {
    name: agent?.name ?? '',
    username: agent?.username ?? '',
    kind: agent?.kind ?? 'external',
    modelCredentialId: agent?.modelCredentialId ?? null,
    model: agent?.model ?? '',
    instructions: agent?.instructions ?? '',
    tools: agent?.tools ?? [],
    temperature: agent?.temperature != null ? String(agent.temperature) : '',
    maxSteps: agent?.maxSteps != null ? String(agent.maxSteps) : '',
    memoryEnabled: agent?.memoryEnabled ?? false,
    memoryLastMessages: agent?.memoryLastMessages != null ? String(agent.memoryLastMessages) : '',
    triggerOnMention: agent?.triggerOnMention ?? true,
    triggerOnAssign: agent?.triggerOnAssign ?? false,
    roleId: agent?.roleId ?? null,
  };
}

// Parses an optional number input: blank becomes null (clears the field), a valid
// number is passed through, anything unparseable is treated as blank.
function parseNum(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// The kind-specific config, shared by the create input and edit patch. Both kinds
// carry the authorization role they act under; an internal agent adds the
// model/tools/trigger config on top.
function configFields(v: AgentFormValue) {
  if (v.kind === 'external') {
    return { roleId: v.roleId };
  }
  return {
    roleId: v.roleId,
    modelCredentialId: v.modelCredentialId,
    model: v.model.trim() || null,
    instructions: v.instructions.trim() || null,
    tools: v.tools,
    temperature: parseNum(v.temperature),
    maxSteps: parseNum(v.maxSteps),
    memoryEnabled: v.memoryEnabled,
    memoryLastMessages: v.memoryEnabled ? parseNum(v.memoryLastMessages) : null,
    triggerOnMention: v.triggerOnMention,
    triggerOnAssign: v.triggerOnAssign,
  };
}

// Payload for creating a new agent, including its kind.
export function toCreateInput(v: AgentFormValue): NewAiAgentInput {
  return { name: v.name.trim(), username: v.username.trim(), kind: v.kind, ...configFields(v) };
}

// Patch for editing an existing agent. The kind cannot change, so it is omitted.
export function toUpdatePatch(v: AgentFormValue): AiAgentPatch {
  return { name: v.name.trim(), username: v.username.trim(), ...configFields(v) };
}

// How many tools the agent ends up with: the granted ones plus the read-only tools
// that are always on.
export function grantedToolCount(tools: AgentTool[], selected: string[]): number {
  return selected.length + tools.filter((t) => t.always).length;
}
