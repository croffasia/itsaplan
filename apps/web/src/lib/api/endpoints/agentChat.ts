import { API_URL, apiFailure, request } from '@/lib/api/core/client';
import type { AgentRunEvent } from '@/lib/api/endpoints/agents';

// The frames of one SSE connection: separated by a blank line, each carrying a single
// JSON-encoded event on its `data:` line and, on a resumable stream, the `id:` a
// reconnect resumes from. Throws ApiError when the request failed before the stream.
async function* readSseFrames(res: Response): AsyncGenerator<{ id: number | null; data: string }> {
  if (!res.ok || !res.body) throw await apiFailure(res);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += value;
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const lines = buffer.slice(0, sep).split('\n');
      buffer = buffer.slice(sep + 2);
      const dataLine = lines.find((l) => l.startsWith('data:'));
      if (!dataLine) continue;
      const idLine = lines.find((l) => l.startsWith('id:'));
      yield {
        id: idLine ? Number(idLine.slice(3).trim()) : null,
        data: dataLine.slice(5).trim(),
      };
    }
  }
}

// What an external agent's runner reports while it answers, as AG-UI events
// (https://docs.ag-ui.com). Only the ones the chat renders are named; the rest of the
// protocol passes through and is ignored here.
interface AgUiEvent {
  type: string;
  delta?: string;
  content?: string;
  message?: string;
  toolCallId?: string;
  toolCallName?: string;
}

// How many times a dropped stream is picked up again. The answer keeps being produced
// on the operator's machine either way; this only decides how long the browser follows it.
const CHAT_STREAM_RETRIES = 3;

function toRunEvent(event: AgUiEvent): AgentRunEvent | null {
  switch (event.type) {
    case 'TEXT_MESSAGE_CONTENT':
      return { type: 'text', value: event.delta ?? '' };
    case 'TOOL_CALL_START':
      return {
        type: 'tool-start',
        toolCallId: event.toolCallId ?? '',
        toolName: event.toolCallName ?? '',
      };
    case 'TOOL_CALL_ARGS':
      return { type: 'tool-args', toolCallId: event.toolCallId ?? '', delta: event.delta ?? '' };
    // TOOL_CALL_END closes the call's arguments, which the runner reports in the same
    // batch as the call itself. The tool is done when its result arrives.
    case 'TOOL_CALL_RESULT':
      return { type: 'tool-end', toolCallId: event.toolCallId ?? '', result: event.content };
    default:
      return null;
  }
}

// The run is bound to this connection, so aborting `signal` is the whole stop: the API
// drops the run with it.
// Streams an internal agent's response over SSE, yielding each AgentRunEvent as it
// arrives. Sends the session cookie like every other call. Throws ApiError when the
// request itself fails before the stream starts (e.g. 403/404); a failure during
// the run arrives as an `error` event, not a throw.
export async function* streamAiAgentRun(
  projectKey: string,
  agentId: number,
  input: { prompt: string; threadId?: string | null },
  signal?: AbortSignal,
): AsyncGenerator<AgentRunEvent> {
  const body = input.threadId
    ? { prompt: input.prompt, threadId: input.threadId }
    : { prompt: input.prompt };
  const res = await fetch(`${API_URL}/projects/${projectKey}/ai-agents/${agentId}/run/stream`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  for await (const frame of readSseFrames(res)) {
    yield JSON.parse(frame.data) as AgentRunEvent;
  }
}

// Dropping the stream stops nothing here — the runner is on the operator's machine and
// only ever calls the API itself — so aborting `signal` also asks the API to cancel the
// answer, which is what the runner reads on its next report.
// Sends a message to an external agent and streams the answer its runner produces,
// yielding the same events as an internal agent's run so the chat consumes one shape.
// The answer starts only once a runner takes the message: until then the stream is open
// with nothing on it.
export async function* streamAiAgentChat(
  projectKey: string,
  agentId: number,
  input: { prompt: string; threadId?: string | null },
  signal?: AbortSignal,
): AsyncGenerator<AgentRunEvent> {
  const body = input.threadId
    ? { prompt: input.prompt, threadId: input.threadId }
    : { prompt: input.prompt };
  const sent = await request<{ threadId: string; messageId: number }>(
    `/projects/${projectKey}/ai-agents/${agentId}/chat`,
    { method: 'POST', body: JSON.stringify(body) },
  );
  const chat = `/projects/${projectKey}/ai-agents/${agentId}/chat/${sent.messageId}`;
  const cancel = () => {
    // A stop the API refused leaves the answer being produced. The stream this belongs
    // to is already gone, so the console is the only place left to report it.
    request(`${chat}/cancel`, { method: 'POST' }).catch((err) => {
      console.error('Could not stop the answer', err);
    });
  };
  if (signal?.aborted) cancel();
  else signal?.addEventListener('abort', cancel, { once: true });
  const base = `${API_URL}${chat}/stream`;
  let after = 0;
  // The answer always ends on a terminal event, so a stream that closed without one was
  // cut: pick it up again from the last event already shown.
  for (let attempt = 0; attempt <= CHAT_STREAM_RETRIES; attempt++) {
    let ended = false;
    try {
      const res = await fetch(`${base}?after=${after}`, { credentials: 'include', signal });
      for await (const frame of readSseFrames(res)) {
        after = frame.id ?? after;
        const event = JSON.parse(frame.data) as AgUiEvent;
        if (event.type === 'RUN_FINISHED') {
          ended = true;
          break;
        }
        if (event.type === 'RUN_ERROR') {
          ended = true;
          yield { type: 'error', message: event.message ?? 'The agent stopped answering' };
          break;
        }
        const mapped = toRunEvent(event);
        if (mapped) yield mapped;
      }
    } catch (err) {
      // A stop still has to name the thread: the reader binds it on `done`, and without
      // that the next message would open a second conversation.
      if (signal?.aborted) {
        yield { type: 'done', threadId: sent.threadId };
        throw err;
      }
      if (attempt === CHAT_STREAM_RETRIES) throw err;
    }
    if (ended) break;
  }
  yield { type: 'done', threadId: sent.threadId };
}

// The upload route takes the bytes as base64 rather than multipart, so the chat
// composer and an MCP client call the same route.
export async function uploadChatAttachment(
  projectKey: string,
  file: File,
): Promise<ChatAttachment> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'));
    reader.readAsDataURL(file);
  });
  return request(`/projects/${projectKey}/chat-attachments`, {
    method: 'POST',
    body: JSON.stringify({
      filename: file.name,
      contentBase64: dataUrl.slice(dataUrl.indexOf(',') + 1),
      contentType: file.type || undefined,
    }),
  });
}

// One of the caller's saved chat conversations with an agent. `title` is the first
// prompt (truncated); null when it was never set. `cliSessionId` is the coding agent
// session an external agent's runner keeps for the thread on its own machine — null
// before the runner has reported one, and always null for an internal agent.
// `contextTokens` is the size of the conversation's context after its last completed
// answer: absent while no answer has completed, null where the agent reports no counts
// that can be read as one.
// `favorite` is the star the caller put on the conversation. `snippet` and `match` come
// back from a search: the text around the hit, and where it was found.
export interface AiChatThread {
  id: string;
  title: string | null;
  cliSessionId: string | null;
  contextTokens?: number | null;
  favorite: boolean;
  snippet?: string;
  match?: 'title' | 'user' | 'assistant';
  createdAt: string;
  updatedAt: string;
}

// One piece of a message, in the order the agent produced it: what it wrote, and the
// tools it called between one stretch of text and the next. A call carries what it was
// given and what it answered where the agent reported them.
export interface AiChatToolPart {
  type: 'tool';
  toolCallId: string;
  toolName: string;
  args?: string;
  result?: string;
}

export type AiChatPart = { type: 'text'; text: string } | AiChatToolPart;

// One restored message of a chat thread's transcript. `stopped` marks an answer the
// member ended part-way: what the agent had written by then is all there is.
export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  parts: AiChatPart[];
  createdAt: string;
  stopped?: boolean;
}

export interface AiChatThreadPage {
  items: AiChatThread[];
  nextPage: number | null;
}

export interface AiChatMessagePage {
  items: AiChatMessage[];
  nextPage: number | null;
}

export interface ChatAttachment {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  url: string;
}

// One page of the caller's own chat threads with an agent, newest first. `q` searches
// them by title and message text instead, over every page.
export const listAiAgentThreads = (projectKey: string, agentId: number, page: number, q = '') =>
  request<AiChatThreadPage>(
    `/projects/${projectKey}/ai-agents/${agentId}/threads?page=${page}` +
      (q ? `&q=${encodeURIComponent(q)}` : ''),
  );

// The conversations the caller starred with an agent, newest first, in one go.
export const listAiAgentFavoriteThreads = (projectKey: string, agentId: number) =>
  request<AiChatThreadPage>(`/projects/${projectKey}/ai-agents/${agentId}/threads?favorites=true`);

// Stars one of the caller's conversations, or takes the star off it.
export const setAiAgentThreadFavorite = (
  projectKey: string,
  agentId: number,
  threadId: string,
  favorite: boolean,
) =>
  request<void>(
    `/projects/${projectKey}/ai-agents/${agentId}/threads/${encodeURIComponent(threadId)}/favorite`,
    { method: favorite ? 'PUT' : 'DELETE' },
  );

// The transcript of one chat thread, to restore the conversation.
export const getAiAgentThreadMessages = (
  projectKey: string,
  agentId: number,
  threadId: string,
  page: number,
) =>
  request<AiChatMessagePage>(
    `/projects/${projectKey}/ai-agents/${agentId}/threads/${encodeURIComponent(threadId)}/messages?page=${page}`,
  );

// Renames one of the caller's chat threads.
export const renameAiAgentThread = (
  projectKey: string,
  agentId: number,
  threadId: string,
  title: string,
) =>
  request<void>(
    `/projects/${projectKey}/ai-agents/${agentId}/threads/${encodeURIComponent(threadId)}`,
    { method: 'PATCH', body: JSON.stringify({ title }) },
  );

export const deleteAiAgentThread = (projectKey: string, agentId: number, threadId: string) =>
  request<void>(
    `/projects/${projectKey}/ai-agents/${agentId}/threads/${encodeURIComponent(threadId)}`,
    { method: 'DELETE' },
  );
