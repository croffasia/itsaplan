# Self-hosting

Requirements: Docker and a domain behind a TLS-terminating reverse proxy.

```bash
git clone https://github.com/croffasia/itsaplan.git
cd itsaplan
cp .env.example .env
# Set the public origins: API_URL, APP_URL
# Generate each secret with `openssl rand -base64 32`:
#   POSTGRES_PASSWORD, BETTER_AUTH_SECRET, APP_ENCRYPTION_KEY,
#   WORKER_INTERNAL_TOKEN, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY

docker compose up -d
```

One command brings up the whole stack: Postgres, MinIO, api, worker, bot, and web. The four
services run from the images published on each release; `VERSION` in `.env` pins one instead
of the newest. The API applies migrations on startup, and the first account registered
becomes the instance admin.

`.env.example` documents every variable, including the optional ones: legal document URLs,
passkey and cookie settings, telemetry opt-out, and worker tuning.

## Updating

```bash
git pull
docker compose pull
docker compose up -d
```

`git pull` is for the compose file itself; the services come from the registry. Changing
`API_URL` or `APP_URL` afterwards only needs `docker compose up -d`.

## Building from source instead

```bash
docker compose up -d --build
```

Builds every service from this checkout and runs those images. Nothing else changes, and
the same command picks up local edits.

For a Coolify instance, see [coolify.md](coolify.md). For a hosted deploy without a
server of your own, see [railway.md](railway.md).
