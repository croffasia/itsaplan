import { Agent } from '@mastra/core/agent';
import { getAgentById, getInternalAgentApiKey, type AiAgentRow } from '../service';
import { getProjectById } from '#modules/projects/service';
import { getCredentialSecret } from '../../integrations/service';
import { listAgentSkills } from '../../skills/service';
import { listAgentToolsForRun } from '../../tools/service';
import { buildCustomTools } from './tools/custom-tools';
import { buildRouteTools } from './tools/route-tools';
import { buildLocalTools } from './tools/local';
import { buildSkillTool, skillsPreamble } from './skill-runtime';
import { buildMemory, ensureThread, DEFAULT_LAST_MESSAGES } from './memory';
import { toolArgsText, toolText } from '../../chat-parts';
import { recordContextUsage, type ContextUsage } from '../../chat-usage';
import { isChatThreadId, newChatThreadId } from './thread-ids';
import { errorMessage } from '../helpers/errors';
import { projectPreamble } from '../prompt/framing';
import { HttpError } from '#shared/lib';

// Runtime execution of internal agents via Mastra. An agent is built on demand
// from its stored configuration (provider/model/instructions) and run against a
// prompt. It is given the work-item system tools for its project (see tools/route-tools),
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
  | { type: 'tool-start'; toolCallId: string; toolName: string; args?: string }
  | { type: 'tool-end'; toolCallId: string; toolName: string; result?: string }
  | { type: 'done'; threadId: string | null }
  | { type: 'error'; message: string };

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
      ...buildLocalTools(row.projectId, row.tools),
      ...(skills.length > 0 ? buildSkillTool(row.projectId, skills) : {}),
      ...buildCustomTools(customTools),
    },
    // Conversation memory (last N messages of a thread) when enabled.
    ...(row.memoryEnabled
      ? { memory: buildMemory(row.memoryLastMessages ?? DEFAULT_LAST_MESSAGES) }
      : {}),
  });
}

// Runs the internal agent identified by (agentId, projectId) against the prompt and
// returns the generated text with the counts of the last model call it took. Throws 404
// if the agent does not exist in the project and 400 if it is an external agent (which
// carries no model config).
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
): Promise<{ text: string; threadId: string | null; usage: ContextUsage | null }> {
  const { agent, row, options, threadId } = await prepareRun(agentId, projectId, prompt, opts);
  const result = await agent.generate(prompt, options);
  const usage = contextOf(result.usage);
  // A chat thread keeps one number, replaced by each answer. An autonomous run keeps
  // the counts of that run instead, on its own row, so its caller stores them.
  if (threadId && isChatThreadId(threadId)) await recordContextUsage(threadId, row.id, usage);
  return { text: (result.text ?? '').trim(), threadId, usage };
}

// What the model reported about the last call of an answer, as the pair the chat keeps.
// Mastra's counts already hold the tokens read from cache inside `inputTokens`, so they
// are taken as they are. Null for a model that reports none, which the chat shows as a
// dash.
function contextOf(usage: ModelUsage | undefined): ContextUsage | null {
  if (usage?.inputTokens == null) return null;
  return { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens ?? 0 };
}

type ModelUsage = { inputTokens?: number; outputTokens?: number };

// Streams the internal agent's response as it is produced. Yields text chunks and
// the tool calls the agent makes, then a final `done` with the thread id (see
// AgentRunEvent). Same preconditions and memory/thread handling as runAgent. A
// failure raised while streaming is yielded as an `error` event rather than thrown,
// so a caller consuming the stream sees it inline and the stream still ends.
//
// `signal` is the request's: aborting it ends the model call and the tool loop, so a
// reader that goes away — by pressing stop or by closing the chat — does not leave the
// run going. An aborted run yields nothing further, not an error: it ended as asked.
export async function* streamAgent(
  agentId: number,
  projectId: number,
  prompt: string,
  opts: RunOpts,
  signal?: AbortSignal,
): AsyncGenerator<AgentRunEvent> {
  try {
    const { agent, row, options, threadId } = await prepareRun(agentId, projectId, prompt, opts);
    const result = await agent.stream(prompt, { ...options, abortSignal: signal });
    // The size of the context is what the last call of the answer read, so each step
    // replaces the one before it rather than being added to it.
    let usage: ModelUsage | undefined;
    for await (const chunk of result.fullStream) {
      switch (chunk.type) {
        case 'step-finish':
          usage = chunk.payload.output.usage;
          break;
        case 'text-delta':
          if (chunk.payload.text) yield { type: 'text', value: chunk.payload.text };
          break;
        case 'tool-call':
          yield {
            type: 'tool-start',
            toolCallId: chunk.payload.toolCallId,
            toolName: chunk.payload.toolName,
            args: toolArgsText(chunk.payload.args),
          };
          break;
        case 'tool-result':
          yield {
            type: 'tool-end',
            toolCallId: chunk.payload.toolCallId,
            toolName: chunk.payload.toolName,
            result: toolText(chunk.payload.result),
          };
          break;
        case 'error':
          yield { type: 'error', message: errorMessage(chunk.payload.error, 'Agent run failed') };
          break;
      }
    }
    // An answer the member stopped never reaches here: the stream is aborted and the
    // thread keeps the number of the answer before it.
    if (threadId) await recordContextUsage(threadId, row.id, contextOf(usage));
    yield { type: 'done', threadId };
  } catch (err) {
    if (signal?.aborted) return;
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
): Promise<{ agent: Agent; row: AiAgentRow; options: RunOptions; threadId: string | null }> {
  const row = await getAgentById(agentId, projectId);
  if (!row) throw new HttpError(404, 'Agent not found');
  if (row.kind !== 'internal') {
    throw new HttpError(400, 'Only internal agents can be run');
  }
  const agent = await buildAgent(row, opts.contextPreamble ?? '');

  // Mastra's generate/stream have overloaded options; type the shape we use. In
  // Mastra v1 the temperature belongs to the call's model settings — a flat
  // `temperature` option is only read by the legacy generate.
  const options: RunOptions = { maxSteps: row.maxSteps ?? DEFAULT_MAX_STEPS };
  if (row.temperature != null) options.modelSettings = { temperature: row.temperature };
  let threadId: string | null = null;
  if (row.memoryEnabled) {
    // A chat run with no threadId starts a new conversation; every other run continues
    // the thread its caller named (see thread-ids). The thread is created up front with
    // what it is bound to and a title, so the chat history can list it and deleting the
    // agent, project or issue can find it. The threadId used is returned so the caller
    // can continue.
    threadId = opts.threadId ?? newChatThreadId(row.id, opts.callerUserId);
    await ensureThread(
      threadId,
      opts.callerUserId,
      {
        agentId: row.id,
        projectId,
        kind: isChatThreadId(threadId) ? 'chat' : 'run',
        ...(opts.issueId != null ? { issueId: opts.issueId } : {}),
        ...(opts.scheduleId != null ? { scheduleId: opts.scheduleId } : {}),
      },
      prompt,
    );
    options.memory = { thread: threadId, resource: opts.callerUserId };
  }
  return { agent, row, options, threadId };
}

// Options for a single run. callerUserId owns the memory thread; threadId continues a
// conversation (memory-enabled agents only); issueId and scheduleId bind an autonomous
// run's thread to what it runs on, so deleting that deletes the thread; contextPreamble
// is the caller-assembled human-context block (see run-context.ts) prepended to the
// agent's instructions.
export type RunOpts = {
  callerUserId: string;
  threadId?: string | null;
  issueId?: number | null;
  scheduleId?: number | null;
  contextPreamble?: string;
};

type RunOptions = {
  maxSteps: number;
  modelSettings?: { temperature: number };
  memory?: { thread: string; resource: string };
  abortSignal?: AbortSignal;
};
