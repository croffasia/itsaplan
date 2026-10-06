import { idlePollDebug, nextIdlePollMs } from './idle-poll';

export interface WorkerHandle {
  stop: () => void;
}

// Runs `tick` on a poll loop and returns a handle to stop it. The loop reschedules
// itself after each tick (recursive setTimeout, not setInterval) so ticks never
// overlap when one runs long. The interval is read per tick so config changes on a
// restart-free reload are picked up.
//
// `tick` returns whether it found work. Empty ticks double the wait from intervalMs
// up to maxIdleMs; a busy tick resets to the base. A base already above maxIdleMs
// stays there, so raising the interval does not get shortened.
export function startPollLoop(
  name: string,
  tick: () => Promise<boolean>,
  intervalMs: () => number,
  maxIdleMs: () => number,
): WorkerHandle {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let emptyStreak = 0;

  async function loop(): Promise<void> {
    if (stopped) return;
    let busy = false;
    try {
      busy = await tick();
    } catch (error) {
      console.error(`[${name}] tick failed:`, error);
    }
    if (stopped) return;
    let delay = intervalMs();
    if (busy) emptyStreak = 0;
    else {
      delay = nextIdlePollMs(emptyStreak, delay, maxIdleMs());
      idlePollDebug(name, delay, emptyStreak);
      emptyStreak += 1;
    }
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
