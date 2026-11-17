import { expect, it } from 'bun:test';
import type { AgUiEvent } from '../agui';
import { answer } from '../chat';
import { Client, type ChatMessage } from '../client';
import type { RunnerConfig } from '../config';

const message: ChatMessage = {
  id: 7,
  threadId: 't',
  prompt: '',
  systemPrompt: '',
  sessionId: null,
};

// One line of output per tool call, all printed at once, so a single flush holds more
// events than the server takes in one request.
function toolCallsConfig(count: number): RunnerConfig {
  const lines = Array.from({ length: count }, (_, id) =>
    JSON.stringify({
      type: 'item.completed',
      item: { id: String(id), type: 'command_execution', command: 'ls', aggregated_output: 'ok' },
    }),
  );
  lines.push(
    JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'Done' } }),
  );
  return {
    name: '',
    url: 'http://plan.test',
    apiKey: 'test',
    command: `printf '%s\\n' '${lines.join('\n')}'; sleep 1`,
    args: [],
    env: {},
    concurrency: 1,
    pollIntervalMs: 1000,
    timeoutMs: 5000,
    outputFormat: 'codex-jsonl',
  };
}

it('sends an answer of more than 200 events in requests the server accepts', async () => {
  const original = globalThis.fetch;
  const sizes: number[] = [];
  const stored: AgUiEvent[] = [];
  const results: Record<string, unknown>[] = [];
  // The limit of chatEventsBody: more than 200 events is refused with 422.
  globalThis.fetch = (async (input, init) => {
    const body = JSON.parse(String(init?.body));
    if (String(input).endsWith('/result')) results.push(body);
    if (!String(input).endsWith('/events')) return Response.json({});
    sizes.push(body.events.length);
    if (body.events.length > 200) return new Response('Too many events', { status: 422 });
    stored.push(...body.events);
    return Response.json({ canceled: false });
  }) as typeof fetch;
  const config = toolCallsConfig(100);
  try {
    await answer(config, new Client(config), message, new AbortController());
    expect(Math.max(...sizes)).toBeLessThanOrEqual(200);
    expect(stored.filter((e) => e.type === 'TOOL_CALL_START')).toHaveLength(100);
    expect(stored[0].type).toBe('RUN_STARTED');
    expect(stored[stored.length - 1].type).toBe('RUN_FINISHED');
    expect(results).toEqual([expect.objectContaining({ status: 'success' })]);
  } finally {
    globalThis.fetch = original;
  }
}, 15_000);

it('sends nothing more of an answer once the server says it was stopped', async () => {
  const original = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = (async (input) => {
    requests.push(new URL(String(input)).pathname);
    return Response.json({ canceled: true });
  }) as typeof fetch;
  const config = toolCallsConfig(100);
  try {
    await answer(config, new Client(config), message, new AbortController());
    expect(requests).toEqual(['/agent-chats/7/events']);
  } finally {
    globalThis.fetch = original;
  }
}, 15_000);
