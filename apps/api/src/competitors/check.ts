import { HttpError } from '../shared/lib';
import { detectEvents } from './diff';
import { readProfile, type CompetitorPlatform } from './providers';
import {
  getLatestSnapshot,
  insertEvents,
  insertSnapshot,
  recordCheckFailure,
  recordCheckSuccess,
} from './store';

export interface CheckResult {
  ok: boolean;
  events: number;
  error?: string;
}

// Reads one account, stores the reading, and turns the difference with the
// previous one into alerts. A provider failure is recorded on the competitor
// rather than thrown, so one broken account does not stop a sweep — the caller
// decides what to do with the result.
export async function checkCompetitor(input: {
  id: number;
  projectId: number;
  platform: CompetitorPlatform;
  handle: string;
}): Promise<CheckResult> {
  let snapshot;
  try {
    snapshot = await readProfile(input.projectId, input.platform, input.handle);
  } catch (error) {
    const message =
      error instanceof HttpError ? error.message : ((error as Error)?.message ?? 'Check failed');
    await recordCheckFailure(input.id, message);
    return { ok: false, events: 0, error: message };
  }

  const previous = await getLatestSnapshot(input.id);
  const events = detectEvents(input.handle, previous, snapshot);
  await insertSnapshot(input.id, snapshot);
  await insertEvents(input.projectId, input.id, events);
  await recordCheckSuccess(input.id);
  return { ok: true, events: events.length };
}
