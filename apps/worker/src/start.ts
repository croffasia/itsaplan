import { startWorker } from './worker';
import { startAgentWorker } from './agent-worker';
import { startImportWorker } from './import-worker';

// Starts webhook delivery, agent scheduling, autonomous agent runs and source imports,
// and stops them on SIGTERM or SIGINT. A build that registers import sources of its own
// (registerImportSource) does it before calling this.
export function startWorkers(): void {
  console.log('[worker] worker starting');
  const worker = startWorker();
  const agentWorker = startAgentWorker();
  const importWorker = startImportWorker();

  function shutdown(signal: string): void {
    console.log(`[worker] ${signal} received, stopping`);
    worker.stop();
    agentWorker.stop();
    importWorker.stop();
    process.exit(0);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
