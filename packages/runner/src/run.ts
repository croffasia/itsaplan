import { AnswerStream, UsageReader } from './agui';
import { RequestError, type Client, type Run } from './client';
import type { RunnerConfig } from './config';
import { execute } from './execute';

// `stop` is aborted when the server says someone stopped the run, on the events report
// here or on the heartbeat. The server has already ended the run by then, so the command
// is killed and nothing more is reported for it.
export async function runTask(
  config: RunnerConfig,
  client: Client,
  run: Run,
  stop: AbortController,
) {
  let offset = 0;
  const stream = new AnswerStream(
    config.outputFormat,
    `run-${run.id}`,
    String(run.id),
    async (events) => {
      if (!run.traceEvents || stop.signal.aborted) return;
      const session = config.outputFormat === 'codex-jsonl' ? stream.startedSession() : null;
      const sessionId =
        session && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session)
          ? session
          : undefined;
      if (await client.runEvents(run, offset, events, sessionId)) stop.abort();
      offset += events.length;
    },
  );
  const usage = new UsageReader(config.outputFormat);
  const timer = setInterval(() => {
    void stream.flush().catch(() => {});
  }, 500);
  try {
    const outcome = await execute(
      config,
      {
        prompt: run.prompt,
        systemPrompt: run.systemPrompt,
        env: {
          ITSAPLAN_RUN_ID: String(run.id),
          ITSAPLAN_TRIGGER: run.trigger,
          ITSAPLAN_SYSTEM_PROMPT: run.systemPrompt,
          ITSAPLAN_ISSUE: run.issueIdentifier ?? '',
          ITSAPLAN_ISSUE_ID: run.issueId == null ? '' : String(run.issueId),
        },
      },
      {
        onData: (chunk) => {
          usage.write(chunk);
          stream.write(chunk);
        },
        signal: stop.signal,
      },
    );
    clearInterval(timer);
    usage.end();
    try {
      if (outcome.status === 'success') await stream.finish(outcome.output);
      else await stream.fail(outcome.error ?? 'The command failed', outcome.output);
    } catch (error) {
      if (!isTransientEventError(error)) throw error;
      try {
        await stream.flush();
      } catch (retryError) {
        if (!isTransientEventError(retryError)) throw retryError;
        console.error(
          `Run ${run.id}: trace upload failed; reporting the command result: ${String(retryError)}`,
        );
      }
    }
    if (stop.signal.aborted) return outcome;
    // A stream format's stdout is its raw event lines; the run reports the answer read out
    // of them. Plain text is the answer as printed.
    const output = config.outputFormat === 'text' ? outcome.output : stream.answer();
    await client.report(run.id, {
      ...outcome,
      output,
      ...(run.traceEvents && { attempt: run.attempts }),
      usage: usage.value(),
    });
    return outcome;
  } finally {
    clearInterval(timer);
  }
}

function isTransientEventError(error: unknown): boolean {
  if (error instanceof RequestError) {
    return error.status === 408 || error.status === 429 || error.status >= 500;
  }
  return (
    error instanceof TypeError ||
    (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name))
  );
}
