import type { OutputFormat } from './config';

// Turns what the command prints into AG-UI events (https://docs.ag-ui.com), which is what
// the server stores and the chat reads. A CLI that reports its own stream also carries the
// tool calls it makes, and those become tool events rather than text.

export type AgUiEvent =
  | { type: 'RUN_STARTED'; threadId: string; runId: string }
  | { type: 'RUN_FINISHED'; threadId: string; runId: string }
  | { type: 'RUN_ERROR'; message: string }
  | { type: 'TEXT_MESSAGE_START'; messageId: string; role: 'assistant' }
  | { type: 'TEXT_MESSAGE_CONTENT'; messageId: string; delta: string }
  | { type: 'TEXT_MESSAGE_END'; messageId: string }
  | { type: 'TOOL_CALL_START'; toolCallId: string; toolCallName: string; parentMessageId: string }
  | { type: 'TOOL_CALL_ARGS'; toolCallId: string; delta: string }
  | { type: 'TOOL_CALL_END'; toolCallId: string }
  | { type: 'TOOL_CALL_RESULT'; messageId: string; toolCallId: string; content: string };

// Text is sent in batches rather than per chunk: a token at a time would be a request
// per token, and the reader cannot tell the difference at this size anyway.
const FLUSH_CHARS = 1500;
// The server's own cap on one text event. Longer output is split across events.
const DELTA_LIMIT = 12_000;
// A tool's arguments and result are reported whole: cutting one breaks the JSON the chat
// indents and highlights. An outsized one is cut from the front, where a long output says
// least.
const TOOL_TEXT_LIMIT = 32_000;

// Produces the events of one answer and hands them to `send` in batches. The caller
// writes the command's output as it arrives and calls flush on a timer, so a long
// answer reaches the chat while it is still being written.
export class AnswerStream {
  private readonly messageId: string;
  private queued: AgUiEvent[] = [];
  private text = '';
  private started = false;
  private line = '';
  // Every event-stream format names its session before the model has produced anything,
  // so it is known in time for the first batch of events.
  private sessionId: string | null = null;
  // opencode re-sends a growing part rather than the delta, so the last text seen says
  // how much of the next one is new. Tool parts are re-sent the same way, hence the set.
  private openTextPart = '';
  private readonly openToolCalls = new Set<string>();
  // Whether the command reported partial text of its own. Its final message repeats
  // that text, and emitting both would say everything twice.
  private sawPartialText = false;
  private sawAnyText = false;
  // The flush in flight, so the next one waits for it instead of racing it.
  private sending: Promise<void> = Promise.resolve();

  constructor(
    private readonly format: OutputFormat,
    private readonly threadId: string,
    private readonly runId: string,
    private readonly send: (events: AgUiEvent[]) => Promise<void>,
  ) {
    this.messageId = `msg-${runId}`;
    this.queued.push({ type: 'RUN_STARTED', threadId, runId });
  }

  write(chunk: string): void {
    if (this.format === 'text') {
      this.appendText(chunk);
      return;
    }
    this.line += chunk;
    const lines = this.line.split('\n');
    this.line = lines.pop() ?? '';
    for (const line of lines) this.readLine(line);
  }

  // Null for a format that reports no session, and for a run that printed nothing.
  startedSession(): string | null {
    return this.sessionId;
  }

  // Two flushes can overlap — the timer and the close — so they are chained to keep the
  // events in the order they were produced. A batch that fails to send goes back to the
  // front of the queue for the next flush to carry.
  async flush(): Promise<void> {
    const sending = this.sending.catch(() => {}).then(() => this.sendQueued());
    this.sending = sending.catch(() => {});
    return sending;
  }

  private async sendQueued(): Promise<void> {
    this.drainText();
    if (this.queued.length === 0) return;
    const batch = this.queued;
    this.queued = [];
    try {
      await this.send(batch);
    } catch (err) {
      this.queued.unshift(...batch);
      throw err;
    }
  }

  // `fallback` is the command's plain output, used when it printed nothing the adapter
  // recognised as text — a stream-json that says only that it ran still has something to
  // show.
  async finish(fallback: string): Promise<void> {
    this.closeText(fallback);
    this.queued.push({ type: 'RUN_FINISHED', threadId: this.threadId, runId: this.runId });
    await this.flush();
  }

  async fail(message: string, fallback = ''): Promise<void> {
    this.closeText(fallback);
    this.queued.push({ type: 'RUN_ERROR', message });
    await this.flush();
  }

  private closeText(fallback: string): void {
    if (this.line) {
      this.readLine(this.line);
      this.line = '';
    }
    if (!this.sawAnyText && fallback) this.appendText(fallback);
    this.drainText();
    if (this.started) this.queued.push({ type: 'TEXT_MESSAGE_END', messageId: this.messageId });
    this.started = false;
  }

  private appendText(text: string): void {
    if (!text) return;
    this.sawAnyText = true;
    this.text += text;
    if (this.text.length >= FLUSH_CHARS) this.drainText();
  }

  private drainText(): void {
    if (this.text.length === 0) return;
    if (!this.started) {
      this.started = true;
      this.queued.push({
        type: 'TEXT_MESSAGE_START',
        messageId: this.messageId,
        role: 'assistant',
      });
    }
    while (this.text.length > 0) {
      const delta = this.text.slice(0, DELTA_LIMIT);
      this.text = this.text.slice(DELTA_LIMIT);
      this.queued.push({ type: 'TEXT_MESSAGE_CONTENT', messageId: this.messageId, delta });
    }
  }

  // Anything unrecognised is ignored: these formats carry more than a chat needs, and a
  // new message type is not an error.
  private readLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      // Output that is not the format it was configured with still has something to say.
      // A CLI writing its own diagnostics to stdout alongside the stream lands here too.
      this.appendText(`${trimmed}\n`);
      return;
    }
    // A line that parses to null, a number or a string carries none of the fields below,
    // and reading them off it would end the run with a type error.
    if (!parsed || typeof parsed !== 'object') return;
    switch (this.format) {
      case 'claude-stream-json':
        this.readClaudeLine(parsed as StreamJsonLine);
        break;
      case 'codex-jsonl':
        this.readCodexLine(parsed as CodexLine);
        break;
      case 'opencode-json':
        this.readOpencodeLine(parsed as OpencodeLine);
        break;
    }
  }

  // `thread.started` names the session; the answer arrives as a completed item of type
  // agent_message, and the commands it ran as items of their own.
  private readCodexLine(message: CodexLine): void {
    if (message.type === 'thread.started' && message.thread_id) {
      this.sessionId ??= message.thread_id;
      return;
    }
    const item = message.item;
    if (message.type !== 'item.completed' || !item) return;
    if (item.type === 'agent_message' && item.text) {
      this.appendText(item.text);
      return;
    }
    if (item.type === 'command_execution' && item.id) {
      this.pushToolCall(item.id, 'shell', item.command ?? '');
      this.pushToolResult(item.id, item.aggregated_output ?? '');
    }
  }

  // opencode names the session on every event, and text arrives as parts of an assistant
  // message rather than as deltas of its own.
  private readOpencodeLine(message: OpencodeLine): void {
    if (message.sessionID) this.sessionId ??= message.sessionID;
    const part = message.part;
    if (!part) return;
    if (part.type === 'text' && part.text) {
      const grown = part.text.startsWith(this.openTextPart)
        ? part.text.slice(this.openTextPart.length)
        : part.text;
      this.openTextPart = part.text;
      this.appendText(grown);
      return;
    }
    if (part.type === 'tool' && part.callID) {
      if (this.openToolCalls.has(part.callID)) return;
      this.openToolCalls.add(part.callID);
      this.pushToolCall(part.callID, part.tool ?? 'tool', JSON.stringify(part.state?.input ?? {}));
    }
  }

  private readClaudeLine(message: StreamJsonLine): void {
    if (message.session_id) this.sessionId ??= message.session_id;
    switch (message.type) {
      case 'stream_event':
        this.readPartial(message.event);
        break;
      case 'assistant':
        this.readAssistant(message.message?.content ?? []);
        break;
      case 'user':
        this.readToolResults(message.message?.content ?? []);
        break;
      case 'result':
        // The final text repeats what was already streamed; it is the fallback for a
        // command that reported no partials.
        if (!this.sawAnyText && typeof message.result === 'string') this.appendText(message.result);
        break;
    }
  }

  private readPartial(event: StreamEvent | undefined): void {
    if (event?.type !== 'content_block_delta') return;
    if (event.delta?.type === 'text_delta' && event.delta.text) {
      this.sawPartialText = true;
      this.appendText(event.delta.text);
    }
  }

  private readAssistant(content: ContentBlock[]): void {
    for (const block of content) {
      if (block.type === 'text' && block.text && !this.sawPartialText) {
        this.appendText(block.text);
      }
      if (block.type === 'tool_use' && block.id) {
        this.pushToolCall(block.id, block.name ?? 'tool', JSON.stringify(block.input ?? {}));
      }
    }
  }

  private readToolResults(content: ContentBlock[]): void {
    for (const block of content) {
      if (block.type !== 'tool_result' || !block.tool_use_id) continue;
      this.pushToolResult(block.tool_use_id, textOfResult(block.content));
    }
  }

  // The text so far is drained first, so a tool call lands between the words said before
  // it and the words said after it.
  private pushToolCall(toolCallId: string, toolCallName: string, args: string): void {
    this.drainText();
    this.queued.push(
      { type: 'TOOL_CALL_START', toolCallId, toolCallName, parentMessageId: this.messageId },
      { type: 'TOOL_CALL_ARGS', toolCallId, delta: tail(args, TOOL_TEXT_LIMIT) },
      { type: 'TOOL_CALL_END', toolCallId },
    );
  }

  private pushToolResult(toolCallId: string, content: string): void {
    this.drainText();
    this.queued.push({
      type: 'TOOL_CALL_RESULT',
      messageId: this.messageId,
      toolCallId,
      content: tail(content, TOOL_TEXT_LIMIT),
    });
  }
}

function tail(text: string, limit: number): string {
  return text.length <= limit ? text : `…${text.slice(-limit)}`;
}

// A tool result is either a string or the block list the model was shown.
function textOfResult(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'object' && part && 'text' in part ? String(part.text) : ''))
      .join('');
  }
  return '';
}

// The parts of Claude Code's stream-json this adapter reads. `session_id` rides on every
// line, including the first.
interface StreamJsonLine {
  type?: string;
  session_id?: string;
  event?: StreamEvent;
  message?: { content?: ContentBlock[] };
  result?: unknown;
}

// The parts of Codex's --json output this adapter reads.
interface CodexLine {
  type?: string;
  thread_id?: string;
  item?: {
    id?: string;
    type?: string;
    text?: string;
    command?: string;
    aggregated_output?: string;
  };
}

// The parts of opencode's --format json output this adapter reads.
interface OpencodeLine {
  type?: string;
  sessionID?: string;
  part?: {
    type?: string;
    text?: string;
    callID?: string;
    tool?: string;
    state?: { input?: unknown };
  };
}

interface StreamEvent {
  type?: string;
  delta?: { type?: string; text?: string };
}

interface ContentBlock {
  type?: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: unknown;
}
