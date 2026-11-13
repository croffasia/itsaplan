import { getJobSettings, type JobSettings } from '@repo/db';

// How soon a loop tries again when the job settings could not be read.
const SETTINGS_RETRY_MS = 5000;

export interface WorkerHandle {
  stop: () => void;
}

// Runs `tick` on a poll loop and returns a handle to stop it. The loop reschedules
// itself after each tick (recursive setTimeout, not setInterval) so ticks never
// overlap when one runs long. The interval is read from the job settings after each
// tick, so a change in god mode applies from the next one.
export function startPollLoop(
  name: string,
  tick: () => Promise<void>,
  intervalMs: (jobs: JobSettings) => number,
): WorkerHandle {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function loop(): Promise<void> {
    if (stopped) return;
    try {
      await tick();
    } catch (error) {
      console.error(`[${name}] tick failed:`, error);
    }
    if (stopped) return;
    const delay = await getJobSettings().then(intervalMs, (error: unknown) => {
      console.error(`[${name}] could not read the job settings:`, error);
      return SETTINGS_RETRY_MS;
    });
    if (stopped) return;
    timer = setTimeout(loop, delay);
  }

  void loop();

  return {
    stop(): void {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
