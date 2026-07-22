export interface WorkerHandle {
  stop: () => void;
}

// Runs `tick` on a poll loop and returns a handle to stop it. The loop reschedules
// itself after each tick (recursive setTimeout, not setInterval) so ticks never
// overlap when one runs long. The interval is read per tick so config changes on a
// restart-free reload are picked up.
export function startPollLoop(
  name: string,
  tick: () => Promise<void>,
  intervalMs: () => number,
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
    timer = setTimeout(loop, intervalMs());
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
