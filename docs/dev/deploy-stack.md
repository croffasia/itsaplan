# Deploy stack

- The deploy composes do not publish the Postgres port.
- `docker-compose.pro.yml` and `docker-compose.coolify-pro.yml` run the published Pro images:
  migrate from `vendor/itsaplan/packages/db/src/migrate.ts`, start the api with `./pro-api`. The
  Helm chart does the same with `values-pro.yaml`, which sets the Pro image repositories and
  `pro: true`. `pro: true` alone selects only the two paths, so the core images fail on it.
- Migrations run as a separate step before the apps start:
  - Compose: the one-shot `migrate` service. api, worker and bot wait for it.
  - Helm: the `migrate` init container of the api pods. Worker and bot pods wait in a
    `wait-for-migrations` init container.
  - Both run `migrate.ts` from the api image. The api container sets its own command, which
    replaces the image CMD, so it only starts the server.
- The api image's own CMD also runs the migrations before the server starts. Deploy targets
  with no separate step (Railway, a plain `docker run`) need this.
- Every `migrate.ts` run takes a Postgres advisory lock, so runs that start together apply each
  migration only once.
- When migrations are pending on an existing database, `migrate.ts` runs `pg_dump` into
  `BACKUP_DIR` (default `/backups`) before it applies them. A failed dump stops the run, and no
  migration is applied.
- Migrations run without a dump in three cases: on a new database, with
  `SKIP_PRE_MIGRATION_BACKUP=1`, and through `bun run db:migrate`, which uses drizzle-kit and
  skips `migrate.ts`, so it also takes no lock.
- Where the dump is stored:
  - Compose: the `db-backups` volume, mounted on the `migrate` service only.
  - Helm: the `backups` volume of the api pods. It is an `emptyDir`, lost with the pod, unless
    `api.backups.persistence.enabled` is true.
  - With no volume at `/backups` (Railway, a plain `docker run`): the container filesystem, lost
    with the container.
- Each `migrate.ts` run deletes dumps older than `BACKUP_RETENTION_DAYS` (default 30).
