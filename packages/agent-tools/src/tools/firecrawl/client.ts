import { jsonOrThrow } from '../../http';
import { sleep } from '../time';

// Shared client for the Firecrawl API. Every tool authenticates with the
// credential's API key as a bearer token and posts a JSON body. The crawl and
// extract endpoints are asynchronous: the POST returns a job id, which is then
// polled with pollJob until the job reaches a terminal status.

const FIRECRAWL_BASE = 'https://api.firecrawl.dev/v2';

const TERMINAL = new Set(['completed', 'failed', 'cancelled']);

// Posts to a Firecrawl endpoint and returns its parsed JSON body. `what` names the
// call in the error message a failure throws.
export async function firecrawlPost(
  apiKey: string,
  path: string,
  body: Record<string, unknown>,
  what: string,
): Promise<unknown> {
  const res = await fetch(`${FIRECRAWL_BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  return jsonOrThrow(res, what);
}

// A job status body. `status` moves from processing to a terminal value; the rest of
// the fields depend on the job type.
export type JobStatus = { status?: string } & Record<string, unknown>;

// Polls a job until it finishes or maxWaitMs elapses. Returns the last status body
// either way, so a caller can report a still-processing job (with its id) rather than
// block indefinitely.
export async function pollJob(
  jobPath: string,
  apiKey: string,
  what: string,
  { intervalMs = 3000, maxWaitMs = 60000 }: { intervalMs?: number; maxWaitMs?: number } = {},
): Promise<JobStatus> {
  const deadline = Date.now() + maxWaitMs;
  for (;;) {
    const res = await fetch(`${FIRECRAWL_BASE}/${jobPath}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = (await jsonOrThrow(res, what)) as JobStatus;
    if (data.status && TERMINAL.has(data.status)) return data;
    if (Date.now() >= deadline) return data;
    await sleep(intervalMs);
  }
}
