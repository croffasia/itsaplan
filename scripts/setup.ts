#!/usr/bin/env bun
import { existsSync } from 'node:fs';
import { connect } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as p from '@clack/prompts';
import { EnvFile } from './env-file.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = (name: string) => join(root, name);

const answer = <T>(value: T | symbol): T => {
  if (p.isCancel(value)) {
    p.cancel('Setup cancelled.');
    process.exit(0);
  }
  return value as T;
};

// Output is captured rather than inherited: docker and drizzle write while a spinner
// is running, and only a failure is worth showing.
const exec = async (...cmd: string[]) => {
  const proc = Bun.spawn(cmd, { cwd: root, stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { ok: code === 0, code, stdout, stderr };
};

const run = async (...cmd: string[]) => {
  const { ok, code, stdout, stderr } = await exec(...cmd);
  if (!ok) {
    p.cancel(`\`${cmd.join(' ')}\` failed:\n${`${stderr}\n${stdout}`.trim()}`);
    process.exit(code);
  }
};

const accepts = (host: string, port: number) =>
  new Promise<boolean>((resolve) => {
    const socket = connect({ host, port });
    const done = (reachable: boolean) => {
      socket.destroy();
      resolve(reachable);
    };
    socket.setTimeout(500);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });

/**
 * Asked by connecting, not by binding: macOS lets a bind on one loopback address succeed
 * beside a listener on the other, so a native Postgres on 127.0.0.1 and a container
 * published on the wildcard both read as free. Both addresses are tried — Docker publishes
 * on one, a host service often listens on both.
 */
const portFree = async (port: number) =>
  !(await accepts('127.0.0.1', port)) && !(await accepts('::1', port));

/**
 * The port is only offered for change, never forced: a port held by a container of this
 * project is in use and correct at the same time, and only the person running this knows.
 */
const askPort = async (what: string, wanted: number) => {
  if (await portFree(wanted)) return wanted;

  let free = wanted + 1;
  while (!(await portFree(free))) free += 1;

  return Number(
    answer(
      await p.text({
        message: `Port ${wanted} is in use. Pick another for ${what}:`,
        initialValue: String(free),
        validate: (value = '') => (/^\d+$/.test(value) ? undefined : 'Enter a port number.'),
      }),
    ),
  );
};

/** True while a service of this compose project — any of them, or the named one — is running. */
const isUp = async (compose: string[], ...service: string[]) =>
  (await exec(...compose, 'ps', '-q', '--status', 'running', ...service)).stdout.trim() !== '';

/** The two stacks read the same .env, so they publish the same api and web ports. */
const stopOther = async (other: string[], what: string, hint = '') => {
  if (!(await isUp(other))) return;

  if (!answer(await p.confirm({ message: `The ${what} stack holds these ports. Stop it?` }))) {
    p.cancel(`Nothing changed.${hint}`);
    process.exit(0);
  }
  await run(...other, 'down');
};

const requireDocker = async () => {
  if ((await exec('docker', 'info')).ok) return;
  p.cancel('Docker is not running. Start it and run this again.');
  process.exit(1);
};

const openBrowser = (url: string) => exec(process.platform === 'darwin' ? 'open' : 'xdg-open', url);

const secrets = ['BETTER_AUTH_SECRET', 'APP_ENCRYPTION_KEY', 'WORKER_INTERNAL_TOKEN'];

/** Every value the setup chooses, with the default to prefill when the file carries none. */
const generated: Record<string, string> = {
  POSTGRES_USER: 'itsaplan',
  POSTGRES_PASSWORD: 'itsaplan',
  POSTGRES_DB: 'itsaplan',
  ...Object.fromEntries(secrets.map((key) => [key, ''])),
};

const volumeExists = async (volume: string) =>
  (await exec('docker', 'volume', 'inspect', volume)).ok;

/**
 * Secrets are chosen once, into a fresh install: past the first start BETTER_AUTH_SECRET
 * signs live sessions and APP_ENCRYPTION_KEY decrypts the stored provider keys, so a new
 * value would make what the instance saved unreadable.
 */
const writeSecrets = async (env: EnvFile, volume: string) => {
  if (!(await volumeExists(volume))) {
    secrets.forEach((key) => env.generate(key));
    return;
  }

  const kept = secrets.filter((key) => env.isPlaceholder(key));
  if (kept.length > 0)
    p.log.warn(`${kept.join(', ')} keep their example value: the database exists.`);
};

/** Whether the running database accepts the credentials .env holds now, over TCP as the api does. */
const databaseAccepts = async (compose: string[], env: EnvFile) =>
  (
    await exec(
      ...compose,
      'exec',
      '-T',
      '-e',
      `PGPASSWORD=${env.get('POSTGRES_PASSWORD')}`,
      'postgres',
      'psql',
      '-h',
      '127.0.0.1',
      '-U',
      env.get('POSTGRES_USER'),
      '-d',
      env.get('POSTGRES_DB'),
      '-c',
      'select 1',
    )
  ).ok;

/**
 * A container keeps the port it started with, so one that was not recreated still publishes
 * the old one and nothing answers on the port .env names. Asked of the host, which is where
 * the migrations connect from, and only a recreate moves it.
 */
const matchPort = async (compose: string[], wanted: number) => {
  if (await accepts('127.0.0.1', wanted)) return;

  await run(...compose, 'up', '-d', '--force-recreate', '--wait', 'postgres');
  if (await accepts('127.0.0.1', wanted)) return;

  p.cancel(`Nothing answers on port ${wanted}, the one .env names for Postgres.`);
  process.exit(1);
};

/**
 * Postgres creates the role and the database when it initialises its volume and never reads
 * those variables again, so credentials changed afterwards reach nothing and every
 * connection fails. Starting over is the only way to apply them, and it deletes the data,
 * so it is offered rather than done.
 */
const matchCredentials = async (compose: string[], env: EnvFile) => {
  if (await databaseAccepts(compose, env)) return;

  p.log.warn(
    `The database does not accept ${env.get('POSTGRES_USER')}. It was created with other credentials.`,
  );

  const confirmed = answer(
    await p.confirm({
      message: 'Recreate it? Every row and every uploaded file is deleted.',
      initialValue: false,
    }),
  );
  if (!confirmed) {
    p.cancel('Nothing changed. Restore the old credentials in .env.');
    process.exit(0);
  }

  await run(...compose, 'down', '-v');
  await run(...compose, 'up', '-d');
  await run(...compose, 'up', '-d', '--wait', '--no-recreate', 'postgres');
};

/** Every chosen value, one prompt each, prefilled, so any of them can be replaced. */
const walk = async (env: EnvFile, fields: Record<string, string>) => {
  for (const [key, fallback] of Object.entries(fields)) {
    const value = answer(
      await p.text({
        message: key,
        initialValue: env.get(key) || fallback,
        validate: (input = '') => (input.trim() === '' ? 'Enter a value.' : undefined),
      }),
    );
    env.set(key, value.trim());
  }
};

p.intro("It's a Plan setup");

const mode = answer(
  await p.select({
    message: 'What do you want to set up?',
    options: [
      { value: 'try', label: 'Try it', hint: 'the whole stack in Docker, on localhost' },
      {
        value: 'dev',
        label: 'Develop',
        hint: 'Postgres and MinIO in Docker, the apps on your machine',
      },
      { value: 'env', label: 'Generate env', hint: 'the secrets and every value, step by step' },
    ],
  }),
);

if (mode !== 'env') await requireDocker();
// Generate env builds both files from the examples: it is a fresh set of values, not an
// edit of the ones already here.
const env = new EnvFile(file('.env'), mode === 'env');

if (mode === 'env') {
  secrets.forEach((key) => env.generate(key));
  await walk(env, generated);

  const web = new EnvFile(file('apps/web/.env'), true);
  web.set('API_URL', env.get('API_URL'));

  let write = answer(
    await p.confirm({ message: 'Write .env and apps/web/.env? No prints them instead.' }),
  );

  // A running instance reads its own data with the secrets in the file being replaced.
  if (write && existsSync(file('.env')))
    write = answer(
      await p.confirm({
        message:
          'Overwrite the .env you have? Copy its secrets first — an instance built on them cannot read its data without them.',
        initialValue: false,
      }),
    );

  if (write) {
    env.save();
    web.save();
    p.outro('.env and apps/web/.env are written.');
  } else {
    p.outro('Nothing was written.');
    // Printed unindented and unboxed so it can be copied straight into another file.
    console.log(`# .env\n${env}\n# apps/web/.env\n${web}`);
  }
}

if (mode === 'try') {
  const compose = ['docker', 'compose'];
  await stopOther(['docker', 'compose', '-f', 'docker-compose.dev.yml'], 'Develop');

  const running = await isUp(compose);

  if (running) {
    const restart = answer(
      await p.confirm({
        message: 'An instance is running. Restart it? The data is kept.',
      }),
    );
    if (!restart) {
      p.outro('Nothing changed.');
      process.exit(0);
    }
  } else {
    const apiPort = await askPort('the api', Number(env.get('API_PORT') || 3000));
    const webPort = await askPort('the web app', Number(env.get('WEB_PORT') || 3001));
    env.set('API_PORT', String(apiPort));
    env.set('WEB_PORT', String(webPort));
    env.set('API_URL', `http://localhost:${apiPort}`);
    env.set('APP_URL', `http://localhost:${webPort}`);
    await writeSecrets(env, 'itsaplan_postgres-data');
    env.save();
  }

  const database = p.spinner();
  database.start(running ? 'Restarting Postgres' : 'Starting Postgres');
  if (running) await run(...compose, 'down');
  await run(...compose, 'up', '-d', '--wait', 'postgres');
  database.stop('Postgres is up');

  // Before the api, which would otherwise fail its healthcheck on the same mismatch.
  await matchCredentials(compose, env);

  const spinner = p.spinner();
  spinner.start('Starting the rest of the stack');
  await run(...compose, 'up', '-d');
  // --wait names api and web only: minio-init is a one-shot and its exit counts as a
  // failure. api is worth waiting for on its own — it migrates before it listens, and
  // web renders /login without it.
  await run(...compose, 'up', '-d', '--wait', '--no-recreate', 'api', 'web');
  spinner.stop('Stack is up');

  const url = env.get('APP_URL');
  await openBrowser(url);
  p.outro(`${url} is open in your browser. The first account you register is the admin.`);
}

if (mode === 'dev') {
  const compose = ['docker', 'compose', '-f', 'docker-compose.dev.yml'];

  // Stopped before the ports are chosen, so a port this stack holds reads as free.
  // Only the containers go; the volumes stay and the migrations below top the data up.
  if (await isUp(compose)) {
    const stopping = p.spinner();
    stopping.start('Stopping the dev stack');
    await run(...compose, 'down');
    stopping.stop('Dev stack stopped');
  }

  await stopOther(['docker', 'compose'], 'Try it');
  // The PR stack fixes the MinIO ports in its own compose file, so no port question can
  // resolve an overlap with the dev one.
  await stopOther(
    ['docker', 'compose', '-f', 'docker-compose.dev.pr.yml'],
    'pull request',
    ' `dev-scripts/dev-stack.sh dev` switches the two over.',
  );

  const dbPort = await askPort('Postgres', Number(env.get('POSTGRES_PORT') || 5432));
  const apiPort = await askPort('the api', Number(env.get('API_PORT') || 3000));

  env.set('POSTGRES_PORT', String(dbPort));
  env.set('API_PORT', String(apiPort));
  env.set('API_URL', `http://localhost:${apiPort}`);
  await writeSecrets(env, 'itsaplan-dev_postgres-dev-data');

  const user = env.get('POSTGRES_USER');
  const database = env.get('POSTGRES_DB');
  // The password reaches DATABASE_URL as a URL component; a typed one may need escaping.
  const password = encodeURIComponent(env.get('POSTGRES_PASSWORD'));

  env.set('DATABASE_URL', `postgres://${user}:${password}@localhost:${dbPort}/${database}`);
  env.save();

  const web = new EnvFile(file('apps/web/.env'));
  web.set('API_URL', `http://localhost:${apiPort}`);
  web.save();

  const spinner = p.spinner();
  spinner.start('Starting Postgres and MinIO');
  await run(...compose, 'up', '-d');
  // --wait names postgres only: minio-init is a one-shot and its exit counts as a failure.
  await run(...compose, 'up', '-d', '--wait', '--no-recreate', 'postgres');
  spinner.stop('Postgres and MinIO are up');

  await matchPort(compose, dbPort);
  await matchCredentials(compose, env);

  // The integration suite TRUNCATEs every table, so it gets a database of its own
  // next to the dev one. Already created on a re-run, which psql reports as an error.
  const testDatabase = `${database}_test`;
  await exec(
    ...compose,
    'exec',
    '-T',
    'postgres',
    'psql',
    '-U',
    user,
    '-d',
    database,
    '-c',
    `CREATE DATABASE ${testDatabase}`,
  );

  const test = new EnvFile(file('.env.test'));
  test.set('DATABASE_URL', `postgres://${user}:${password}@localhost:${dbPort}/${testDatabase}`);
  test.set('API_URL', `http://localhost:${apiPort}`);
  test.set('APP_URL', env.get('APP_URL'));
  for (const key of ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'])
    test.set(key, env.get(key));
  test.save();

  const migrations = p.spinner();
  migrations.start('Applying migrations');
  // The programmatic runner, not `bun run db:migrate`: drizzle-kit exits 1 without printing
  // what the database refused, and a failure here is exactly what needs reading.
  await run('bun', '--env-file=.env', 'packages/db/src/migrate.ts');
  await run('bun', '--env-file=.env.test', 'packages/db/src/migrate.ts');
  migrations.stop(`Migrated ${database} and ${testDatabase}`);

  p.outro(
    `Run \`bun run dev\` — web on http://localhost:3001, api on http://localhost:${apiPort}.`,
  );
}
