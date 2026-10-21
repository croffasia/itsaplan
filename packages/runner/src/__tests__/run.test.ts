import { expect, it, spyOn } from 'bun:test';
import { AnswerStream, type AgUiEvent } from '../agui';
import { Client, type Run } from '../client';
import type { RunnerConfig } from '../config';
import { runTask } from '../run';
import { handleRun } from '../tasks';

const sessionId = '0199a213-81c0-7800-8aa1-bbab2a035a53';

it('captures Codex command starts, MCP calls and file changes without duplicate tool calls', async () => {
  const events: AgUiEvent[] = [];
  const stream = new AnswerStream('codex-jsonl', 'thread', '1', async (batch) => {
    events.push(...batch);
  });
  const command = {
    id: 'cmd',
    type: 'command_execution',
    command: 'ls',
    aggregated_output: 'README.md',
  };
  for (const event of [
    { type: 'thread.started', thread_id: sessionId },
    { type: 'item.started', item: command },
    { type: 'item.completed', item: command },
    {
      type: 'item.completed',
      item: {
        id: 'mcp',
        type: 'mcp_tool_call',
        tool: 'get_issue',
        arguments: { id: 1 },
        result: { title: 'Task' },
      },
    },
    {
      type: 'item.completed',
      item: {
        id: 'file',
        type: 'file_change',
        status: 'completed',
        changes: [{ path: 'README.md', kind: 'update' }],
      },
    },
  ])
    stream.write(JSON.stringify(event) + '\n');
  await stream.finish('');
  expect(stream.startedSession()).toBe(sessionId);
  expect(events.filter((e) => e.type === 'TOOL_CALL_START')).toHaveLength(3);
  expect(events).toContainEqual(
    expect.objectContaining({ type: 'TOOL_CALL_RESULT', toolCallId: 'cmd', content: 'README.md' }),
  );
  expect(events).toContainEqual(
    expect.objectContaining({ type: 'TOOL_CALL_START', toolCallName: 'get_issue' }),
  );
  expect(events).toContainEqual(
    expect.objectContaining({ type: 'TOOL_CALL_START', toolCallName: 'file_change' }),
  );
});

it('executes a queued task and reports its session and tool events before the final result', async () => {
  const original = globalThis.fetch;
  const posts: { path: string; body: Record<string, unknown> }[] = [];
  globalThis.fetch = (async (input, init) => {
    posts.push({ path: new URL(String(input)).pathname, body: JSON.parse(String(init?.body)) });
    return Response.json({ nextOffset: 100, truncated: false });
  }) as typeof fetch;
  const output = [
    { type: 'thread.started', thread_id: sessionId },
    {
      type: 'item.completed',
      item: {
        id: 'tool',
        type: 'command_execution',
        command: 'ls',
        aggregated_output: 'README.md',
      },
    },
    { type: 'item.completed', item: { id: 'msg', type: 'agent_message', text: 'Done' } },
  ]
    .map((event) => JSON.stringify(event))
    .join('\n');
  const config: RunnerConfig = {
    name: '',
    url: 'http://plan.test',
    apiKey: 'test',
    command: `printf '%s' '${output}'`,
    args: [],
    env: {},
    concurrency: 1,
    pollIntervalMs: 1000,
    timeoutMs: 5000,
    outputFormat: 'codex-jsonl',
  };
  const run: Run = {
    id: 1,
    attempts: 2,
    traceEvents: true,
    trigger: 'manual',
    prompt: 'Task',
    systemPrompt: '',
    issueId: null,
    issueIdentifier: null,
  };
  try {
    await handleRun(config, new Client(config), () => {}, run);
    expect(posts[0].path).toBe('/agent-runs/1/events');
    expect(posts[0].body).toMatchObject({ attempt: 2, offset: 0, sessionId });
    expect(posts[0].body.events).toContainEqual(
      expect.objectContaining({ type: 'TOOL_CALL_RESULT', content: 'README.md' }),
    );
    expect(posts[posts.length - 1].path).toBe('/agent-runs/1/result');
    expect(posts[posts.length - 1].body).toMatchObject({
      status: 'success',
      attempt: 2,
      output: 'Done',
    });
  } finally {
    globalThis.fetch = original;
  }
});

it('retries a partially accepted stream batch with its original offsets', async () => {
  const original = globalThis.fetch;
  const offsets: number[] = [];
  let failed = false;
  globalThis.fetch = (async (input, init) => {
    if (String(input).endsWith('/events')) {
      const body = JSON.parse(String(init?.body));
      offsets.push(body.offset);
      if (body.offset === 200 && !failed) {
        failed = true;
        throw new Error('Lost response');
      }
    }
    return Response.json({ nextOffset: 0, truncated: false });
  }) as typeof fetch;
  const lines = Array.from({ length: 60 }, (_, id) =>
    JSON.stringify({
      type: 'item.completed',
      item: { id: String(id), type: 'command_execution', command: 'ls', aggregated_output: 'ok' },
    }),
  );
  lines.push(
    JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'Done' } }),
  );
  const config: RunnerConfig = {
    name: '',
    url: 'http://plan.test',
    apiKey: 'test',
    command: `printf '%s\\n' '${lines.join('\n')}'; sleep 2`,
    args: [],
    env: {},
    concurrency: 1,
    pollIntervalMs: 1000,
    timeoutMs: 5000,
    outputFormat: 'codex-jsonl',
  };
  try {
    await runTask(config, new Client(config), {
      id: 1,
      attempts: 1,
      traceEvents: true,
      trigger: 'manual',
      prompt: '',
      systemPrompt: '',
      issueId: null,
      issueIdentifier: null,
    });
    expect(offsets.slice(0, 4)).toEqual([0, 200, 0, 200]);
  } finally {
    globalThis.fetch = original;
  }
}, 15_000);

const shortTaskConfig: RunnerConfig = {
  name: '',
  url: 'http://plan.test',
  apiKey: 'test',
  command: "printf 'Done'",
  args: [],
  env: {},
  concurrency: 1,
  pollIntervalMs: 1000,
  timeoutMs: 5000,
  outputFormat: 'text',
};
const shortRun: Run = {
  id: 1,
  attempts: 2,
  traceEvents: true,
  trigger: 'manual',
  prompt: '',
  systemPrompt: '',
  issueId: null,
  issueIdentifier: null,
};

function isFinalBatch(body: Record<string, unknown>): boolean {
  const events = body.events as AgUiEvent[];
  return events.some((event) => event.type === 'RUN_FINISHED' || event.type === 'RUN_ERROR');
}

it('retries a transient final event failure before reporting the successful command once', async () => {
  const original = globalThis.fetch;
  const reports: Record<string, unknown>[] = [];
  const finalOffsets: number[] = [];
  globalThis.fetch = (async (input, init) => {
    const body = JSON.parse(String(init?.body));
    if (String(input).endsWith('/events') && isFinalBatch(body)) {
      finalOffsets.push(body.offset);
      if (finalOffsets.length === 1) return new Response('Temporary failure', { status: 503 });
    }
    if (String(input).endsWith('/result')) reports.push(body);
    return Response.json({ nextOffset: 100, truncated: false });
  }) as typeof fetch;
  try {
    await handleRun(shortTaskConfig, new Client(shortTaskConfig), () => {}, shortRun);
    expect(finalOffsets).toHaveLength(2);
    expect(finalOffsets[1]).toBe(finalOffsets[0]);
    expect(reports).toEqual([
      expect.objectContaining({ status: 'success', output: 'Done', attempt: 2 }),
    ]);
  } finally {
    globalThis.fetch = original;
  }
});

it('warns about an unavailable final trace without replacing the command outcome', async () => {
  const original = globalThis.fetch;
  const warning = spyOn(console, 'error').mockImplementation(() => {});
  const reports: Record<string, unknown>[] = [];
  let finalAttempts = 0;
  globalThis.fetch = (async (input, init) => {
    const body = JSON.parse(String(init?.body));
    if (String(input).endsWith('/events') && isFinalBatch(body)) {
      finalAttempts++;
      return new Response('Temporary failure', { status: 503 });
    }
    if (String(input).endsWith('/result')) reports.push(body);
    return Response.json({ nextOffset: 100, truncated: false });
  }) as typeof fetch;
  try {
    await handleRun(shortTaskConfig, new Client(shortTaskConfig), () => {}, shortRun);
    expect(finalAttempts).toBe(2);
    expect(reports).toEqual([
      expect.objectContaining({ status: 'success', output: 'Done', attempt: 2 }),
    ]);
    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning.mock.calls[0]?.[0]).toContain('trace upload failed');
  } finally {
    globalThis.fetch = original;
    warning.mockRestore();
  }
});

it('does not retry or ignore a final event rejection for a stale attempt', async () => {
  const original = globalThis.fetch;
  let finalAttempts = 0;
  let reports = 0;
  globalThis.fetch = (async (input, init) => {
    const body = JSON.parse(String(init?.body));
    if (String(input).endsWith('/events') && isFinalBatch(body)) {
      finalAttempts++;
      return new Response('Active run attempt not found', { status: 404 });
    }
    if (String(input).endsWith('/result')) reports++;
    return Response.json({ nextOffset: 100, truncated: false });
  }) as typeof fetch;
  try {
    await expect(
      runTask(shortTaskConfig, new Client(shortTaskConfig), shortRun),
    ).rejects.toMatchObject({
      status: 404,
    });
    expect(finalAttempts).toBe(1);
    expect(reports).toBe(0);
  } finally {
    globalThis.fetch = original;
  }
});
