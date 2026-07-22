import { Agent } from '@mastra/core/agent';
import { getAgentById, getInternalAgentApiKey, type AiAgentRow } from '../store';
import { getProjectById, type ProjectRow } from '../../projects/store';
import { getCredentialSecret } from '../../integrations/store';
import { listAgentSkills } from '../../agent-skills/store';
import { listAgentToolsForRun } from '../../agent-tools/store';
import { buildCustomTools } from './tools/custom-tools';
import { buildRouteTools } from './tools/route-tools';
import { buildLocalTools } from './tools/local';
import { buildSkillTool, skillsPreamble } from './skill-runtime';
import { buildMemory, createChatThread, DEFAULT_LAST_MESSAGES } from './memory';
import { errorMessage } from '../helpers/errors';
import { HttpError } from '../../shared/lib';

// Runtime execution of internal agents via Mastra. An agent is built on demand
// from its stored configuration (provider/model/instructions) and run against a
// prompt. It is given the work-item system tools for its project (see tools/agent-tools),
// so it can read and manage that project's issues, comments, labels, custom field
// values, and attachments — acting as its own bot user, plus a read_skill tool for
// any skills enabled on it.
//
// The model is addressed through Mastra's model router. When the project has a
// stored credential for the agent's provider (ai_provider_credential), its key is
// decrypted and passed to the model config; otherwise the provider/model string
// form is used, which falls back to the provider key in the environment.

// Default OpenAI mini model used when an OpenAI agent has no model set.
const DEFAULT_MODEL = 'gpt-5-mini';
const DEFAULT_INSTRUCTIONS = "You are a helpful assistant that manages this project's work items.";
// Upper bound on the agent's tool-use loop when the agent has no maxSteps set.
const DEFAULT_MAX_STEPS = 12;

// Mastra's model config: an object carrying the provider id, model id, and the
// explicit apiKey (and url for OpenAI-compatible endpoints).
type ModelConfig = { providerId: string; modelId: string; apiKey: string; url?: string };

// Builds the model config for an agent from its model credential. The credential's
// integration key is the provider id; its decrypted config carries the apiKey and an
// optional base URL. The model id is stored on the agent.
async function resolveModel(row: AiAgentRow): Promise<ModelConfig> {
  if (row.modelCredentialId == null) {
    throw new HttpError(400, 'Agent has no model credential set');
  }
  const secret = await getCredentialSecret(row.modelCredentialId, row.projectId);
  if (!secret) throw new HttpError(400, "Agent's model credential not found");
  const provider = secret.integrationKey;
  const modelId = row.model ?? (provider === 'openai' ? DEFAULT_MODEL : null);
  if (!modelId) {
    throw new HttpError(400, `Agent has no model set for provider "${provider}"`);
  }
  const baseUrl = secret.config.baseUrl ? String(secret.config.baseUrl) : null;
  return {
    providerId: provider,
    modelId,
    apiKey: String(secret.config.apiKey ?? ''),
    ...(baseUrl ? { url: baseUrl } : {}),
  };
}

// One event of a streamed agent run, sent to the caller as it happens. `text` is
// a chunk of the answer to append; `tool-start`/`tool-end` report a capability the
// agent is using (so the UI can show what it is doing); `done` closes the stream
// and carries the conversation thread id; `error` reports a failure mid-stream.
export type AgentRunEvent =
  | { type: 'text'; value: string }
  | { type: 'tool-start'; toolCallId: string; toolName: string }
  | { type: 'tool-end'; toolCallId: string; toolName: string }
  | { type: 'done'; threadId: string | null }
  | { type: 'error'; message: string };

// A leading system-instruction block naming the project the agent works in. Grounds
// every run (the test chat and the issue-triggered runs) so the agent knows which
// project its work-item tools act on and how issue keys are formed.
function projectPreamble(project: ProjectRow): string {
  return [
    '## Current project',
    `You are working in the project "${project.name}" (key ${project.key}). All your`,
    `work-item tools act on this project only, and its issues are addressed by keys`,
    `like ${project.key}-123.`,
    '',
    '',
  ].join('\n');
}

async function buildAgent(row: AiAgentRow, contextPreamble: string): Promise<Agent> {
  const project = await getProjectById(row.projectId);
  if (!project) throw new HttpError(404, 'Project not found');
  const model = await resolveModel(row);
  const skills = await listAgentSkills(row.id);
  const customTools = await listAgentToolsForRun(row.id);
  const apiKey = await getInternalAgentApiKey(row);
  const instructions =
    projectPreamble(project) +
    contextPreamble +
    (row.instructions ?? DEFAULT_INSTRUCTIONS) +
    skillsPreamble(skills);
  return new Agent({
    id: `ai-agent-${row.id}`,
    name: row.name,
    instructions,
    model,
    // The agent acts as its own bot user, scoped to its project. Route tools call the
    // real API with its key, so its project role applies; get_current_date is the one
    // tool with no route; read_skill loads any enabled skills on demand; custom tools
    // are the external integrations configured on the project and enabled here.
    tools: {
      ...buildRouteTools(project, apiKey, row.tools),
      ...buildLocalTools(),
      ...(skills.length > 0 ? buildSkillTool(row.projectId, skills) : {}),
      ...buildCustomTools(customTools),
    },
    // Conversation memory (last N messages of a thread) when enabled.
    ...(row.memoryEnabled
      ? { memory: buildMemory(row.memoryLastMessages ?? DEFAULT_LAST_MESSAGES) }
      : {}),
  });
}

// Runs the internal agent identified by (agentId, projectId) against the prompt
// and returns the generated text. Throws 404 if the agent does not exist in the
// project and 400 if it is an external agent (which carries no model config).
//
// When the agent has memory enabled, the run participates in a conversation
// thread: threadId identifies the conversation (a new one is created when omitted)
// and the caller (callerUserId) owns it. The thread id used is returned so the
// caller can continue the conversation; it is null when memory is off.
export async function runAgent(
  agentId: number,
  projectId: number,
  prompt: string,
  opts: RunOpts,
): Promise<{ text: string; threadId: string | null }> {
  const { agent, options, threadId } = await prepareRun(agentId, projectId, prompt, opts);
  const result = await agent.generate(prompt, options);
  return { text: (result.text ?? '').trim(), threadId };
}

// Streams the internal agent's response as it is produced. Yields text chunks and
// the tool calls the agent makes, then a final `done` with the thread id (see
// AgentRunEvent). Same preconditions and memory/thread handling as runAgent. A
// failure raised while streaming is yielded as an `error` event rather than thrown,
// so a caller consuming the stream sees it inline and the stream still ends.
export async function* streamAgent(
  agentId: number,
  projectId: number,
  prompt: string,
  opts: RunOpts,
): AsyncGenerator<AgentRunEvent> {
  try {
    const { agent, options, threadId } = await prepareRun(agentId, projectId, prompt, opts);
    const result = await agent.stream(prompt, options);
    for await (const chunk of result.fullStream) {
      switch (chunk.type) {
        case 'text-delta':
          if (chunk.payload.text) yield { type: 'text', value: chunk.payload.text };
          break;
        case 'tool-call':
          yield {
            type: 'tool-start',
            toolCallId: chunk.payload.toolCallId,
            toolName: chunk.payload.toolName,
          };
          break;
        case 'tool-result':
          yield {
            type: 'tool-end',
            toolCallId: chunk.payload.toolCallId,
            toolName: chunk.payload.toolName,
          };
          break;
        case 'error':
          yield { type: 'error', message: errorMessage(chunk.payload.error, 'Agent run failed') };
          break;
      }
    }
    yield { type: 'done', threadId };
  } catch (err) {
    yield { type: 'error', message: errorMessage(err, 'Agent run failed') };
  }
}

// Loads the agent, enforces the run preconditions, and builds the Mastra run
// options (tool-use step bound and, when memory is on, the conversation thread the
// caller owns). Shared by runAgent and streamAgent.
async function prepareRun(
  agentId: number,
  projectId: number,
  prompt: string,
  opts: RunOpts,
): Promise<{ agent: Agent; options: RunOptions; threadId: string | null }> {
  const row = await getAgentById(agentId, projectId);
  if (!row) throw new HttpError(404, 'Agent not found');
  if (row.kind !== 'internal') {
    throw new HttpError(400, 'Only internal agents can be run');
  }
  const agent = await buildAgent(row, opts.contextPreamble ?? '');

  // Mastra's generate/stream have overloaded options; type the shape we use.
  const options: RunOptions = { maxSteps: row.maxSteps ?? DEFAULT_MAX_STEPS };
  let threadId: string | null = null;
  if (row.memoryEnabled) {
    // A new chat thread (no threadId supplied) is created up front with its
    // agent/project binding and a title, so the chat history can list it. A
    // supplied threadId continues an existing thread (chat or issue-triggered) and
    // is left untouched. The threadId used is returned so the caller can continue.
    const isNew = !opts.threadId;
    threadId = opts.threadId ?? crypto.randomUUID();
    if (isNew) {
      await createChatThread(threadId, opts.callerUserId, { agentId: row.id, projectId }, prompt);
    }
    options.memory = { thread: threadId, resource: opts.callerUserId };
  }
  return { agent, options, threadId };
}

// Options for a single run. callerUserId owns the memory thread; threadId continues a
// conversation (memory-enabled agents only); contextPreamble is the caller-assembled
// human-context block (see run-context.ts) prepended to the agent's instructions.
export type RunOpts = {
  callerUserId: string;
  threadId?: string | null;
  contextPreamble?: string;
};

type RunOptions = { maxSteps: number; memory?: { thread: string; resource: string } };
