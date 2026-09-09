import { app, internalApp } from './app';

// Bind the ports. The apps themselves are assembled in ./app.ts (without `.listen()`)
// so tests can import them and drive routes in memory. The internal listener serves
// the worker and the bot; keep INTERNAL_PORT unpublished.
app.listen(Number(process.env.API_PORT ?? 3000));
internalApp.listen(Number(process.env.INTERNAL_PORT ?? 3002));

console.log(`🦊 API running at http://${app.server?.hostname}:${app.server?.port}`);
console.log(
  `🔒 Internal API running at http://${internalApp.server?.hostname}:${internalApp.server?.port}`,
);

export type { App } from './app';
