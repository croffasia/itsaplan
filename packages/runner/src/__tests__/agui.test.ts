import { describe, it, expect } from 'bun:test';
import { AnswerStream, type AgUiEvent } from '../agui';

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
