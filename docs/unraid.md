# Unraid with Compose Manager

This guide uses the Community edition's existing Docker Compose stack through
[Compose Manager Plus](https://github.com/mstrhakr/compose_plugin). It does not install
an It's a Plan entry from Community Applications (CA). Catalog distribution is tracked
in [#639](https://github.com/croffasia/itsaplan/issues/639).

This procedure has not been tested on an Unraid host. Before using it for real data,
complete the acceptance checklist below on a disposable instance.

## Requirements

- An Unraid host with Docker enabled and a compatible Compose Manager Plus installation.
  Follow the plugin's current requirements; its documented minimum is not a promise
  that this application has been tested on every supported Unraid version.
- A domain and a TLS reverse proxy. Plain HTTP on the server's LAN IP does not support
  production sign-in. See [self-hosting](self-hosting.md#where-the-api-lives) for routing,
  cookies, OAuth discovery, and proxy headers.
- Space for PostgreSQL data, attachments, database dumps, and an independent backup.

The stack runs PostgreSQL 17, RustFS, api, worker, bot, and web. Two additional services
initialize the attachment bucket and run database migrations. Compose waits for these
steps before starting the dependent application services. Keep the stack together;
independently updating the api, web, worker, or bot can mix release versions.

## Prepare the stack

1. Choose a persistent project directory on an Unraid data pool/share. Keep it separate
   from other Compose projects. Do not place application data on the boot flash drive.
2. Obtain a checkout of an explicitly selected published release from the
   [releases page](https://github.com/croffasia/itsaplan/releases). Keep the full checkout
   so Compose's relative build paths resolve, even though this procedure uses images.
3. Copy `.env.example` to `.env` in that directory. Follow the required-values table in
   [self-hosting](self-hosting.md). Generate unique secrets; do not reuse example values.
   Restrict access to `.env` and keep an encrypted backup of it. Losing
   `APP_ENCRYPTION_KEY` makes stored provider credentials unreadable.
4. Set `VERSION` to that release's exact image tag, without the release tag's `v` prefix,
   rather than `latest`. For example, release `v1.8.0` uses `VERSION=1.8.0`. Use the
   same value for all application services. Configure `API_URL` and `APP_URL` for the
   public HTTPS origins, and choose unused `API_PORT` and `WEB_PORT` host ports.
5. In Compose Manager, add a stack using the existing project directory (the plugin's
   external/indirect path option). Select `docker-compose.yml` and the `.env` beside it.
   Confirm that the generated configuration resolves the intended files and variables
   before starting. Do not paste credentials into a support issue or screenshot.

Keep the Compose project name `itsaplan`, as defined in the file. Changing the project
name changes the default volume names and can make an existing instance appear empty.
This guide assumes a single instance on the host.

### Persistent storage

The upstream stack uses Docker named volumes:

| Volume | Container path | Contents |
| --- | --- | --- |
| `postgres-data` | `/var/lib/postgresql/data` | PostgreSQL database |
| `minio-data` | `/data` | RustFS attachments; the name is retained for MinIO compatibility |
| `db-backups` | `/backups` in `migrate` | Pre-migration database dumps |

With the default project name these become `itsaplan_postgres-data`,
`itsaplan_minio-data`, and `itsaplan_db-backups`. They are Docker-managed storage,
not automatically folders in Unraid's `appdata` share. Locate them in the host's
Docker storage configuration and explicitly include them in the backup plan.
Backing up only the Compose Manager project directory does not back up these volumes.
Never remove volumes when deleting/recreating a stack you want to retain.

## First start

Use the stack's pull operation, then Compose Up without building local images
(`docker compose pull` and `docker compose up -d --no-build` from the project directory
are the equivalent CLI operations). If the manager offers separate build/update
actions because the upstream file contains `build:`, select the image-only operation.

Check that PostgreSQL and RustFS become healthy, `minio-init` and `migrate` exit
successfully, and the application services stay running. A completed one-shot service
is expected; do not configure it to restart continuously. Keep the bot at one replica.

Route the web and api through the TLS proxy using the self-hosting guide. Database and
storage ports are not published by the stack. Restrict the api's published host port
to the intended proxy/network; do not expose backing services to make setup easier.
Open the configured HTTPS web origin and register the instance administrator.

## Update and recover

Update the stack as a unit, rather than through per-container automatic updates:

1. Read the target release notes. Preserve the current Compose files, `.env`, exact
   release tag, and any local configuration before updating the checkout.
2. Stop `web`, `api`, `worker`, and `bot` before the coordinated backup and keep them
   stopped until the update. Leave PostgreSQL and RustFS available for logical backups.
   Take an independent, recoverable backup of the database and attachments together
   with `.env`, with no other clients writing to either store. A raw copy of
   PostgreSQL's live data directory is not a database dump; use a consistent database
   backup or stop PostgreSQL before a filesystem copy.
3. Obtain the target release's Compose files and update `VERSION` to its exact tag.
   Keep the existing project name, volumes, and secrets. Pull the images, then run
   Compose Up without building, as for the first start.
4. Check the migration result before using the application. A failed dump or migration
   must be investigated; do not bypass it by setting `SKIP_PRE_MIGRATION_BACKUP=1`.
   Verify sign-in, an existing issue, an attachment, and worker activity afterward.

When migrations are pending, the migration runner takes a PostgreSQL custom-format
dump before applying them. A failed dump stops migration. Dumps are retained for 30
days by default; `BACKUP_RETENTION_DAYS` changes that window. The local `db-backups`
volume does not protect against loss of the host and contains no attachment backup.

To recover a failed upgrade, stop the application services and preserve the failed
instance for diagnosis. On a separate disposable recovery instance, restore the
matching database dump with PostgreSQL's `pg_restore`, restore the corresponding
attachment backup and original encryption key, and use the release/configuration
that produced that backup. Keep the recovery instance isolated from production
integrations so its worker and bot cannot send duplicate jobs or notifications.
Validate it before replacing the failed instance. Pulling older application images
alone does not undo schema or data migrations. Do not restore over the only copy
of your current data.

## Community and Pro

The [Pro stack](../docker-compose.pro.yml) uses different images and startup commands
with the same project name and volumes. Follow the project's
[Pro instructions](self-hosting.md) if choosing that edition; do not change only the
api image or mix Community and Pro components. This guide's Unraid acceptance remains
unverified for both editions. Pro catalog submission is a separate decision from
documenting Community installation.

## Unraid acceptance before production use

Record the Unraid version, Compose Manager version, image tags, storage configuration,
and results for each check:

- Install from an empty project with generated secrets; verify bucket initialization,
  successful migrations, HTTPS sign-in, issue creation, and attachment upload/download.
- Restart the stack and reboot the host; verify the same account, issues, attachments,
  secrets, and volumes remain available. Check stack autostart ordering.
- Upgrade between two published versions with pending migrations; verify a usable dump
  is retained and all application services use the selected release.
- On disposable data, verify a failed pre-migration backup prevents dependent services
  from starting against the new release.
- Restore the database, attachments, and configuration on a separate isolated instance;
  verify sign-in and attachment bytes, not just container health.

For a CA listing, maintainers still need to choose the distribution format, template
repository owner, and support contact. CA submissions require moderation and the
repository owner's confirmation of its security requirements, including 2FA; this
guide neither submits an application nor makes those confirmations. See the current
[CA application policies](https://forums.unraid.net/topic/87144-ca-application-policies-privacy-policy/).
