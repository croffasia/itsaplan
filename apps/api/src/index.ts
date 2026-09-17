import { app } from './app';
import { startBackgroundJobs } from './background';

// Bind the port. The app itself is assembled in ./app.ts (without `.listen()`)
// so tests can import it and drive routes in memory.
app.listen(Number(process.env.API_PORT ?? 3000));

startBackgroundJobs();

console.log(`🦊 API running at http://${app.server?.hostname}:${app.server?.port}`);

export type { App } from './app';
