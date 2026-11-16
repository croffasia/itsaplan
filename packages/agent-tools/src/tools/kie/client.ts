import { jsonOrThrow } from '../../http';
import { sleep } from '../time';

// Every Kie model except the chat models runs as a task: jobs/createTask returns a
// taskId, and jobs/recordInfo reports the task's state until it is success or fail.

export const KIE_API = 'https://api.kie.ai/api/v1';
export const KIE_DOCS = 'https://docs.kie.ai';

const POLL_MS = 3000;

// Kept well under the default agent run limit of 240 seconds: a run stopped in the middle
// of a wait loses the taskId of a task that is already paid for.
export const MAX_WAIT_SECONDS = 120;

// Kie answers a failed call with HTTP 200 and puts the status in `code`.
export async function kieRequest(
  apiKey: string,
  path: string,
  body: Record<string, unknown> | null,
  what: string,
): Promise<unknown> {
  const res = await fetch(`${KIE_API}/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = (await jsonOrThrow(res, what)) as { code?: number; msg?: string; data?: unknown };
  if (json.code !== 200) {
    throw new Error(`${what} failed (${json.code ?? 'no code'}): ${json.msg ?? 'no message'}`);
  }
  return json.data;
}

interface TaskRecord {
  state?: string;
  resultJson?: string | null;
  response?: unknown;
  failCode?: string | null;
  failMsg?: string | null;
  progress?: number;
  creditsConsumed?: number;
}

function parseResult(task: TaskRecord): unknown {
  if (task.response != null) return task.response;
  if (!task.resultJson) return null;
  try {
    return JSON.parse(task.resultJson);
  } catch {
    return task.resultJson;
  }
}

// Polls a task until it is success or fail, or until waitSeconds pass, and returns
// only the fields the model acts on.
export async function waitForTask(
  apiKey: string,
  taskId: string,
  waitSeconds: number,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + waitSeconds * 1000;
  for (;;) {
    const task = (await kieRequest(
      apiKey,
      `jobs/recordInfo?${new URLSearchParams({ taskId })}`,
      null,
      'Kie task status',
    )) as TaskRecord;
    const state = task.state ?? 'waiting';
    if (state === 'success') {
      return { taskId, state, result: parseResult(task), creditsConsumed: task.creditsConsumed };
    }
    if (state === 'fail') {
      return { taskId, state, error: task.failMsg || `Task failed with code ${task.failCode}` };
    }
    if (Date.now() >= deadline) {
      return { taskId, state, progress: task.progress ?? null };
    }
    await sleep(POLL_MS);
  }
}
