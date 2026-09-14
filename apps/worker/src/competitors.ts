import { workerConfig } from './config';
import { postInternal } from './internal-api';

interface SweepResult {
  checked: number;
  failed: number;
  events: number;
  pruned: number;
  error?: string;
}

// Asks the API to check the tracked accounts that are due. The reading needs the
// project's integration credentials, which only the API can decrypt, so the worker
// owns the schedule and the API owns the work.
export async function processCompetitorSweep(): Promise<void> {
  const cfg = workerConfig();
  let response: Response;
  try {
    response = await postInternal(
      '/internal/competitors/sweep',
      {
        intervalMs: cfg.competitorIntervalMs,
        batchSize: cfg.competitorBatchSize,
        retainDays: cfg.competitorRetainDays,
      },
      cfg.competitorTimeoutMs,
    );
  } catch (error) {
    console.error('[worker] competitor sweep could not reach the api:', error);
    return;
  }
  if (!response.ok) {
    console.error(`[worker] competitor sweep returned ${response.status}`);
    return;
  }
  const result = (await response.json().catch(() => null)) as SweepResult | null;
  if (result && result.checked > 0) {
    console.log(
      `[worker] competitors: checked ${result.checked}, ${result.failed} failed, ${result.events} alerts`,
    );
  }
}
