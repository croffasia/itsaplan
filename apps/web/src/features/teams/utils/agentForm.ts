import type {
  AgentTool,
  AiAgent,
  NewAiAgentInput,
  AiAgentPatch,
  ReasoningEffort,
} from '@/lib/api/endpoints/agents';
import { transliterate } from '@/utils/transliterate';
import { delaySecFromMinutes } from '@/utils/runDelay';

// The editable shape of an agent form. The number inputs are kept as strings so
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
  reasoningEffort: ReasoningEffort | null;
  maxSteps: string;
  runTimeoutSec: string;
  memoryEnabled: boolean;
  memoryLastMessages: string;
  triggerOnMention: boolean;
  triggerOnAssign: boolean;
  // Whether the agent may be chatted with. Off, it drops out of the chat selector and
  // the chat routes reject it; a mention, a delegation, and a schedule are unaffected.
  chatEnabled: boolean;
  // The member custom fields that start a run when the agent is set into one, each
  // with its own wait.
  fieldTriggers: FormFieldTrigger[];
  // Minutes a delegation run waits before the agent may pick it up, as a string so
  // the input can be cleared while typing.
  delegationDelayMin: string;
  // The projects of the team the agent works in. Its key reaches those and nothing
  // else, so an agent with none authenticates and sees no project.
  projectIds: number[];
  runnerScope: 'owner' | 'team';
  // How an external agent gets its tasks: taken by a runner, or sent to its URL.
  delivery: AgentDelivery;
  invocationUrl: string;
}

export type AgentDelivery = 'runner' | 'url';

export interface FormFieldTrigger {
  fieldId: number;
  delayMin: string;
}

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;
// Only the shape is checked here; the server refuses an address it will not send to.
const URL_PATTERN = /^https?:\/\/\S+$/;

// Suggests a mention handle from the agent's name: non-Latin scripts are
// transliterated, the result is lowercased, every run of characters the handle can't
// hold becomes a single dash, leading/trailing dashes are dropped, and it is capped
// at the 64-char server limit (e.g. "Tets External" -> "tets-external").
export function suggestUsername(name: string): string {
  return transliterate(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

// Whether the form holds a submittable value: a non-empty name, a username matching
// the server rules (1-64 chars, [a-zA-Z0-9._-]), and a URL when the tasks are sent to one.
export function isAgentFormValid(v: AgentFormValue): boolean {
  const username = v.username.trim();
  const sendsToUrl = v.kind === 'external' && v.delivery === 'url';
  return (
    v.name.trim().length > 0 &&
    username.length <= 64 &&
    USERNAME_PATTERN.test(username) &&
    (!sendsToUrl || URL_PATTERN.test(v.invocationUrl.trim()))
  );
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
    reasoningEffort: agent?.reasoningEffort ?? null,
    maxSteps: agent?.maxSteps != null ? String(agent.maxSteps) : '',
    runTimeoutSec: agent?.runTimeoutSec != null ? String(agent.runTimeoutSec) : '',
    memoryEnabled: agent?.memoryEnabled ?? false,
    memoryLastMessages: agent?.memoryLastMessages != null ? String(agent.memoryLastMessages) : '',
    triggerOnMention: agent?.triggerOnMention ?? true,
    triggerOnAssign: agent?.triggerOnAssign ?? false,
    chatEnabled: agent?.chatEnabled ?? true,
    fieldTriggers: (agent?.fieldTriggers ?? []).map((trigger) => ({
      fieldId: trigger.fieldId,
      delayMin: String(Math.round(trigger.delaySec / 60)),
    })),
    delegationDelayMin: String(Math.round((agent?.delegationDelaySec ?? 120) / 60)),
    projectIds: (agent?.projects ?? []).map((project) => project.id),
    runnerScope: agent?.runnerScope ?? 'team',
    delivery: agent?.invocationUrl ? 'url' : 'runner',
    invocationUrl: agent?.invocationUrl ?? '',
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
// carry their projects, their run triggers, and their instructions; an external agent
// adds the scope of the runs it receives and where they are sent, an internal one the
// model/tools config.
function configFields(v: AgentFormValue) {
  const common = {
    projectIds: v.projectIds,
    instructions: v.instructions.trim() || null,
    triggerOnMention: v.triggerOnMention,
    triggerOnAssign: v.triggerOnAssign,
    chatEnabled: v.chatEnabled,
    fieldTriggers: v.fieldTriggers.map((trigger) => ({
      fieldId: trigger.fieldId,
      delaySec: delaySecFromMinutes(trigger.delayMin),
    })),
    delegationDelaySec: delaySecFromMinutes(v.delegationDelayMin),
  };
  if (v.kind === 'external') {
    return {
      ...common,
      runnerScope: v.runnerScope,
      invocationUrl: v.delivery === 'url' ? v.invocationUrl.trim() : null,
    };
  }
  return {
    ...common,
    modelCredentialId: v.modelCredentialId,
    model: v.model.trim() || null,
    tools: v.tools,
    temperature: parseNum(v.temperature),
    reasoningEffort: v.reasoningEffort,
    maxSteps: parseNum(v.maxSteps),
    runTimeoutSec: parseNum(v.runTimeoutSec),
    memoryEnabled: v.memoryEnabled,
    memoryLastMessages: v.memoryEnabled ? parseNum(v.memoryLastMessages) : null,
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

// Buckets a list by a key, keeping the order the keys first appear in, so a grouped
// checklist follows the order its source list came in.
export function groupInOrder<T, K extends string>(items: T[], key: (item: T) => K): [K, T[]][] {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const group = key(item);
    const bucket = groups.get(group);
    if (bucket) bucket.push(item);
    else groups.set(group, [item]);
  }
  return [...groups];
}
