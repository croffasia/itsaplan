import { describe, it, expect } from 'bun:test';
import { AnswerStream, UsageReader, type AgUiEvent } from '../agui';

// The adapter is what a chat answer is read through, and the coding agents it reads
// print several shapes of the same thing, so the mapping is pinned here.

function collect() {
  const events: AgUiEvent[] = [];
  return {
    events,
    send: async (batch: AgUiEvent[]) => {
      events.push(...batch);
    },
  };
}

const types = (events: AgUiEvent[]) => events.map((e) => e.type);
const text = (events: AgUiEvent[]) =>
  events
    .filter((e) => e.type === 'TEXT_MESSAGE_CONTENT')
    .map((e) => (e as { delta: string }).delta)
    .join('');

describe('answer stream', () => {
  it('reports plain output as one message', async () => {
    const sink = collect();
    const stream = new AnswerStream('text', 'chat:1:u:x', '7', sink.send);

    stream.write('Two things ');
    stream.write('are left.');
    await stream.finish('');

    expect(types(sink.events)).toEqual([
      'RUN_STARTED',
      'TEXT_MESSAGE_START',
      'TEXT_MESSAGE_CONTENT',
      'TEXT_MESSAGE_END',
      'RUN_FINISHED',
    ]);
    expect(text(sink.events)).toBe('Two things are left.');
  });

  it('ends a failed answer with what went wrong, keeping what was said', async () => {
    const sink = collect();
    const stream = new AnswerStream('text', 'chat:1:u:x', '7', sink.send);

    stream.write('Started, then ');
    await stream.fail('Command exited with 1');

    expect(types(sink.events).at(-1)).toBe('RUN_ERROR');
    expect(text(sink.events)).toBe('Started, then ');
  });

  it("reads Claude's stream as text and tool calls", async () => {
    const sink = collect();
    const stream = new AnswerStream('claude-stream-json', 'chat:1:u:x', '7', sink.send);

    stream.write(
      [
        JSON.stringify({ type: 'system', subtype: 'init' }),
        JSON.stringify({
          type: 'stream_event',
          event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Check' } },
        }),
        JSON.stringify({
          type: 'assistant',
          message: {
            content: [{ type: 'tool_use', id: 'tool-1', name: 'Bash', input: { command: 'ls' } }],
          },
        }),
        JSON.stringify({
          type: 'user',
          message: {
            content: [{ type: 'tool_result', tool_use_id: 'tool-1', content: 'README.md' }],
          },
        }),
        JSON.stringify({
          type: 'stream_event',
          event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'ing done.' } },
        }),
        '',
      ].join('\n'),
    );
    await stream.finish('Checking done.');

    expect(types(sink.events)).toEqual([
      'RUN_STARTED',
      'TEXT_MESSAGE_START',
      'TEXT_MESSAGE_CONTENT',
      'TOOL_CALL_START',
      'TOOL_CALL_ARGS',
      'TOOL_CALL_END',
      'TOOL_CALL_RESULT',
      'TEXT_MESSAGE_CONTENT',
      'TEXT_MESSAGE_END',
      'RUN_FINISHED',
    ]);
    // The final text repeats the partials, so it is not appended a second time.
    expect(text(sink.events)).toBe('Checking done.');
  });

  it('takes the final message when the command reported no partials', async () => {
    const sink = collect();
    const stream = new AnswerStream('claude-stream-json', 'chat:1:u:x', '7', sink.send);

    stream.write(
      `${JSON.stringify({ type: 'result', subtype: 'success', result: 'All done.' })}\n`,
    );
    await stream.finish('All done.');

    expect(text(sink.events)).toBe('All done.');
  });

  it('shows output that is not the configured format as text', async () => {
    const sink = collect();
    const stream = new AnswerStream('claude-stream-json', 'chat:1:u:x', '7', sink.send);

    stream.write('not json at all\n');
    await stream.finish('');

    expect(text(sink.events)).toBe('not json at all\n');
  });

  it("reads Codex's jsonl as text and shell calls", async () => {
    const sink = collect();
    const stream = new AnswerStream('codex-jsonl', 'chat:1:u:x', '7', sink.send);

    stream.write(
      [
        JSON.stringify({ type: 'thread.started', thread_id: '01a00c82' }),
        JSON.stringify({ type: 'turn.started' }),
        JSON.stringify({
          type: 'item.completed',
          item: {
            id: 'item_0',
            type: 'command_execution',
            command: 'ls',
            aggregated_output: 'README.md',
          },
        }),
        JSON.stringify({
          type: 'item.completed',
          item: { id: 'item_1', type: 'agent_message', text: 'Checked.' },
        }),
        '',
      ].join('\n'),
    );
    await stream.finish('Checked.');

    expect(types(sink.events)).toEqual([
      'RUN_STARTED',
      'TOOL_CALL_START',
      'TOOL_CALL_ARGS',
      'TOOL_CALL_END',
      'TOOL_CALL_RESULT',
      'TEXT_MESSAGE_START',
      'TEXT_MESSAGE_CONTENT',
      'TEXT_MESSAGE_END',
      'RUN_FINISHED',
    ]);
    expect(text(sink.events)).toBe('Checked.');
  });

  it("reads opencode's json, adding only what a re-sent part grew by", async () => {
    const sink = collect();
    const stream = new AnswerStream('opencode-json', 'chat:1:u:x', '7', sink.send);

    stream.write(
      [
        JSON.stringify({
          type: 'message.part.updated',
          sessionID: 'ses_1',
          part: { type: 'text', text: 'Look' },
        }),
        JSON.stringify({
          type: 'message.part.updated',
          sessionID: 'ses_1',
          part: { type: 'text', text: 'Looking at it.' },
        }),
        '',
      ].join('\n'),
    );
    await stream.finish('Looking at it.');

    expect(text(sink.events)).toBe('Looking at it.');
  });

  it('reports what an opencode tool call ended with', async () => {
    const sink = collect();
    const stream = new AnswerStream('opencode-json', 'chat:1:u:x', '7', sink.send);

    stream.write(
      [
        JSON.stringify({
          sessionID: 'ses_1',
          part: {
            type: 'tool',
            callID: 'c1',
            tool: 'bash',
            state: { status: 'running', input: { command: 'ls' } },
          },
        }),
        JSON.stringify({
          sessionID: 'ses_1',
          part: {
            type: 'tool',
            callID: 'c1',
            tool: 'bash',
            state: { status: 'completed', input: { command: 'ls' }, output: 'README.md' },
          },
        }),
        '',
      ].join('\n'),
    );
    await stream.finish('');

    expect(types(sink.events)).toEqual([
      'RUN_STARTED',
      'TOOL_CALL_START',
      'TOOL_CALL_ARGS',
      'TOOL_CALL_END',
      'TOOL_CALL_RESULT',
      'RUN_FINISHED',
    ]);
    const result = sink.events.find((e) => e.type === 'TOOL_CALL_RESULT');
    expect((result as { content: string }).content).toBe('README.md');
  });

  it('reports what a failed opencode tool call said, once', async () => {
    const sink = collect();
    const stream = new AnswerStream('opencode-json', 'chat:1:u:x', '7', sink.send);

    const failed = JSON.stringify({
      sessionID: 'ses_1',
      part: {
        type: 'tool',
        callID: 'c1',
        tool: 'bash',
        state: { status: 'error', input: {}, error: 'exit 1' },
      },
    });
    stream.write([failed, failed, ''].join('\n'));
    await stream.finish('');

    const results = sink.events.filter((e) => e.type === 'TOOL_CALL_RESULT');
    expect(results).toHaveLength(1);
    expect((results[0] as { content: string }).content).toBe('exit 1');
  });

  it("reads Antigravity's stream as text fragments and tool steps", async () => {
    const sink = collect();
    const stream = new AnswerStream('antigravity-stream-json', 'chat:1:u:x', '7', sink.send);

    stream.write(
      [
        JSON.stringify({ event: 'init', conversation_id: 'c3b6', init: { cwd: '/repo' } }),
        JSON.stringify({
          event: 'step_update',
          step_update: {
            conversation_id: 'c3b6',
            step_index: 2,
            state: 'ACTIVE',
            step_type: 'tool',
            tool_name: 'run_command',
            tool_info: { name: 'run_command', parameters: { CommandLine: 'ls' } },
          },
        }),
        JSON.stringify({
          event: 'step_update',
          step_update: {
            conversation_id: 'c3b6',
            step_index: 2,
            state: 'DONE',
            step_type: 'tool',
            tool_name: 'run_command',
            tool_info: {
              name: 'run_command',
              parameters: { CommandLine: 'ls' },
              output: 'README.md',
            },
          },
        }),
        JSON.stringify({
          event: 'step_update',
          step_update: {
            conversation_id: 'c3b6',
            step_index: 3,
            state: 'ACTIVE',
            step_type: 'agent_response',
            text_delta: 'One file',
          },
        }),
        JSON.stringify({
          event: 'step_update',
          step_update: {
            conversation_id: 'c3b6',
            step_index: 3,
            state: 'DONE',
            step_type: 'agent_response',
            text_delta: ' is left.',
          },
        }),
        JSON.stringify({
          event: 'result',
          result: { conversation_id: 'c3b6', status: 'SUCCESS', response: 'One file is left.' },
        }),
        '',
      ].join('\n'),
    );
    await stream.finish('');

    expect(types(sink.events)).toEqual([
      'RUN_STARTED',
      'TOOL_CALL_START',
      'TOOL_CALL_ARGS',
      'TOOL_CALL_END',
      'TOOL_CALL_RESULT',
      'TEXT_MESSAGE_START',
      'TEXT_MESSAGE_CONTENT',
      'TEXT_MESSAGE_END',
      'RUN_FINISHED',
    ]);
    // Every fragment is new, and the result repeats them rather than adding to them.
    expect(text(sink.events)).toBe('One file is left.');
    expect(stream.startedSession()).toBe('c3b6');
  });

  it('takes the Antigravity result as the answer when no fragment carried one', async () => {
    const sink = collect();
    const stream = new AnswerStream('antigravity-stream-json', 'chat:1:u:x', '7', sink.send);

    stream.write(
      `${JSON.stringify({
        event: 'result',
        result: { conversation_id: 'c3b6', status: 'SUCCESS', response: 'Done.' },
      })}\n`,
    );
    await stream.finish('');

    expect(text(sink.events)).toBe('Done.');
    expect(stream.startedSession()).toBe('c3b6');
  });

  it("reads Copilot's json as text, tool calls and the session it closes with", async () => {
    const sink = collect();
    const stream = new AnswerStream('copilot-json', 'chat:1:u:x', '7', sink.send);

    stream.write(
      [
        JSON.stringify({
          type: 'assistant.message_delta',
          data: { messageId: 'm1', deltaContent: 'Reading it' },
        }),
        JSON.stringify({
          type: 'assistant.message',
          data: {
            messageId: 'm1',
            content: 'Reading it',
            toolRequests: [{ toolCallId: 'call_1', name: 'view' }],
          },
        }),
        JSON.stringify({
          type: 'tool.execution_start',
          data: { toolCallId: 'call_1', toolName: 'view', arguments: { path: 'alpha.txt' } },
        }),
        JSON.stringify({
          type: 'tool.execution_complete',
          data: { toolCallId: 'call_1', success: true, result: { content: 'hello from alpha' } },
        }),
        JSON.stringify({
          type: 'assistant.message_delta',
          data: { messageId: 'm2', deltaContent: '. It says hello.' },
        }),
        JSON.stringify({ type: 'result', sessionId: 'c66bf000', exitCode: 0 }),
        '',
      ].join('\n'),
    );
    await stream.finish('');

    expect(types(sink.events)).toEqual([
      'RUN_STARTED',
      'TEXT_MESSAGE_START',
      'TEXT_MESSAGE_CONTENT',
      'TOOL_CALL_START',
      'TOOL_CALL_ARGS',
      'TOOL_CALL_END',
      'TOOL_CALL_RESULT',
      'TEXT_MESSAGE_CONTENT',
      'TEXT_MESSAGE_END',
      'RUN_FINISHED',
    ]);
    // The assistant message repeats the deltas, so it is not appended a second time.
    expect(text(sink.events)).toBe('Reading it. It says hello.');
    expect(stream.startedSession()).toBe('c66bf000');
  });

  it('reports what a denied Copilot tool call said', async () => {
    const sink = collect();
    const stream = new AnswerStream('copilot-json', 'chat:1:u:x', '7', sink.send);

    stream.write(
      `${JSON.stringify({
        type: 'tool.execution_complete',
        data: { toolCallId: 'call_1', success: false, result: null, error: { message: 'denied' } },
      })}\n`,
    );
    await stream.finish('');

    const result = sink.events.find((e) => e.type === 'TOOL_CALL_RESULT');
    expect((result as { content: string }).content).toBe('denied');
  });

  it('ignores a line that parses to something other than an object', async () => {
    for (const format of [
      'claude-stream-json',
      'codex-jsonl',
      'opencode-json',
      'antigravity-stream-json',
      'copilot-json',
    ] as const) {
      const sink = collect();
      const stream = new AnswerStream(format, 'chat:1:u:x', '7', sink.send);

      stream.write('null\n42\n');
      await stream.finish('');

      expect(types(sink.events)).toEqual(['RUN_STARTED', 'RUN_FINISHED']);
    }
  });

  it('reports the session each format names, from its first line', async () => {
    const claude = collect();
    const claudeStream = new AnswerStream('claude-stream-json', 'chat:1:u:x', '7', claude.send);
    claudeStream.write(
      `${JSON.stringify({ type: 'system', subtype: 'init', session_id: 'abc' })}\n`,
    );
    expect(claudeStream.startedSession()).toBe('abc');

    const codex = collect();
    const codexStream = new AnswerStream('codex-jsonl', 'chat:1:u:x', '7', codex.send);
    codexStream.write(`${JSON.stringify({ type: 'thread.started', thread_id: '01a0' })}\n`);
    expect(codexStream.startedSession()).toBe('01a0');

    const opencode = collect();
    const opencodeStream = new AnswerStream('opencode-json', 'chat:1:u:x', '7', opencode.send);
    opencodeStream.write(`${JSON.stringify({ type: 'step.started', sessionID: 'ses_9' })}\n`);
    expect(opencodeStream.startedSession()).toBe('ses_9');
  });

  it('keeps the first session it saw when later lines name another', async () => {
    const sink = collect();
    const stream = new AnswerStream('claude-stream-json', 'chat:1:u:x', '7', sink.send);

    stream.write(`${JSON.stringify({ type: 'system', session_id: 'first' })}\n`);
    stream.write(`${JSON.stringify({ type: 'assistant', session_id: 'second' })}\n`);

    expect(stream.startedSession()).toBe('first');
  });

  it('reports no session for a format that names none', async () => {
    const sink = collect();
    const stream = new AnswerStream('text', 'chat:1:u:x', '7', sink.send);

    stream.write('done\n');

    expect(stream.startedSession()).toBeNull();
  });
});

// The context size is what the chat shows as the size of the conversation, so what each
// command reports has to end up as the same pair of numbers, measured on the last model
// call and never summed over the calls an answer took.
describe('context size', () => {
  it("adds Claude's cache reads to the tokens read, and keeps the last call", async () => {
    const sink = collect();
    const stream = new AnswerStream('claude-stream-json', 'chat:1:u:x', '7', sink.send);

    stream.write(
      [
        JSON.stringify({
          type: 'stream_event',
          event: {
            type: 'message_start',
            message: { usage: { input_tokens: 4, output_tokens: 1 } },
          },
        }),
        JSON.stringify({
          type: 'stream_event',
          event: { type: 'message_delta', usage: { output_tokens: 120 } },
        }),
        JSON.stringify({
          type: 'stream_event',
          event: {
            type: 'message_start',
            message: {
              usage: {
                input_tokens: 3000,
                cache_read_input_tokens: 40_000,
                cache_creation_input_tokens: 1945,
                output_tokens: 1,
              },
            },
          },
        }),
        JSON.stringify({
          type: 'stream_event',
          event: { type: 'message_delta', usage: { output_tokens: 300 } },
        }),
        '',
      ].join('\n'),
    );
    await stream.finish('');

    expect(stream.contextUsage()).toEqual({ inputTokens: 44_945, outputTokens: 300 });
  });

  it('takes the turn total Codex reports, the only number it has', async () => {
    const sink = collect();
    const stream = new AnswerStream('codex-jsonl', 'chat:1:u:x', '7', sink.send);

    stream.write(
      `${JSON.stringify({
        type: 'turn.completed',
        usage: { input_tokens: 46_356, cached_input_tokens: 20_000, output_tokens: 800 },
      })}\n`,
    );
    await stream.finish('');

    expect(stream.contextUsage()).toEqual({ inputTokens: 46_356, outputTokens: 800 });
  });

  it("adds opencode's cache and reasoning counts to the tokens the last step read", async () => {
    const sink = collect();
    const stream = new AnswerStream('opencode-json', 'chat:1:u:x', '7', sink.send);

    stream.write(
      [
        JSON.stringify({
          part: {
            type: 'step-finish',
            tokens: { input: 10, output: 20, cache: { read: 0, write: 0 } },
          },
        }),
        JSON.stringify({
          part: {
            type: 'step-finish',
            tokens: {
              input: 1200,
              output: 90,
              reasoning: 40,
              cache: { read: 30_000, write: 800 },
            },
          },
        }),
        '',
      ].join('\n'),
    );
    await stream.finish('');

    expect(stream.contextUsage()).toEqual({ inputTokens: 32_000, outputTokens: 130 });
  });

  it("adds Antigravity's cache reads and thinking tokens to the counts of its last step", async () => {
    const sink = collect();
    const stream = new AnswerStream('antigravity-stream-json', 'chat:1:u:x', '7', sink.send);

    stream.write(
      [
        JSON.stringify({
          event: 'step_update',
          step_update: {
            step_index: 1,
            step_type: 'agent_response',
            usage: {
              input_tokens: 2000,
              cache_read_tokens: 18_000,
              output_tokens: 250,
              thinking_tokens: 60,
            },
          },
        }),
        // The closing result carries the total of the turn; taking it would report the
        // steps added up instead of the context.
        JSON.stringify({
          event: 'result',
          usage: { input_tokens: 90_000, output_tokens: 4000 },
          result: { conversation_id: 'c3b6', response: 'Done.' },
        }),
        '',
      ].join('\n'),
    );
    await stream.finish('');

    expect(stream.contextUsage()).toEqual({ inputTokens: 20_000, outputTokens: 310 });
  });

  it('says Copilot reports no context size, rather than saying nothing', async () => {
    const sink = collect();
    const stream = new AnswerStream('copilot-json', 'chat:1:u:x', '7', sink.send);

    stream.write(`${JSON.stringify({ type: 'result', sessionId: 'abc' })}\n`);
    await stream.finish('');

    expect(stream.contextUsage()).toBeNull();
  });

  it('reports nothing for an answer that said nothing about its context', async () => {
    const sink = collect();
    const stream = new AnswerStream('claude-stream-json', 'chat:1:u:x', '7', sink.send);

    stream.write(`${JSON.stringify({ type: 'result', result: 'Done.' })}\n`);
    await stream.finish('Done.');

    expect(stream.contextUsage()).toBeUndefined();
  });
});

// A run streams nothing to a chat, so it reads the counts straight off the command's
// output. The chat's stream owns a reader of the same kind, which the tests above cover.
describe('usage of a run', () => {
  it('reads the counts across the chunks the output arrived in', () => {
    const reader = new UsageReader('claude-stream-json');
    const line = JSON.stringify({
      type: 'stream_event',
      event: { type: 'message_start', message: { usage: { input_tokens: 8000 } } },
    });

    reader.write(line.slice(0, 30));
    reader.write(`${line.slice(30)}\n`);
    // A last line the command wrote without a newline still counts.
    reader.write(
      JSON.stringify({
        type: 'stream_event',
        event: { type: 'message_delta', usage: { output_tokens: 120 } },
      }),
    );
    reader.end();

    expect(reader.value()).toEqual({ inputTokens: 8000, outputTokens: 120 });
  });

  it('reports nothing for an output that said nothing about its counts', () => {
    const reader = new UsageReader('codex-jsonl');
    reader.write(`${JSON.stringify({ type: 'thread.started', thread_id: '01a0' })}\n`);
    reader.end();
    expect(reader.value()).toBeUndefined();
  });

  it('says Copilot reports no counts, rather than saying nothing', () => {
    const reader = new UsageReader('copilot-json');
    reader.write('{"type":"result"}\n');
    reader.end();
    expect(reader.value()).toBeNull();
  });

  it('reads nothing from the plain output of a command with no format', () => {
    const reader = new UsageReader('text');
    reader.write('Done.\n');
    reader.end();
    expect(reader.value()).toBeUndefined();
  });
});
