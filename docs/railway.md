# Deploy on Railway

Railway builds the stack from source and generates the secrets itself. You supply two
hostnames; everything else is wired by the template.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/its-a-plan?referralCode=lQ5O6i&utm_medium=integration&utm_source=button&utm_campaign=itsaplan)

The template provisions six resources: Postgres with a volume, a storage bucket for
attachments, and the api, web, worker and bot services, each built from its own Dockerfile
in this repository. It tracks the `release` branch, so a deploy gets the latest published
release.

## 1. A domain of your own is required

Railway's generated `*.up.railway.app` hostnames are on the Public Suffix List, which makes
the browser treat every service as a separate site and reject the session cookie: sign-in
returns 200 and then bounces straight back to the login page. Two hostnames under one
registrable domain — `api.example.com` and `app.example.com` — fix this, because the cookie
is issued on their shared parent.

## 2. Deploy

Press the button and fill in the two fields on the **web** service:

| Field     | Example                   |
| --------- | ------------------------- |
| `API_URL` | `https://api.example.com` |
| `APP_URL` | `https://app.example.com` |

Full origins, including `https://`. The api reads both by reference, and web reads `API_URL`
at startup and hands it to the browser on every render.

## 3. Attach the hostnames

After the deploy, add each hostname under **Settings → Networking → Custom Domain**:

| Service | Hostname          | Port |
| ------- | ----------------- | ---- |
| api     | `api.example.com` | 3000 |
| web     | `app.example.com` | 3001 |

Here Railway wants the bare hostname, without a scheme — unlike the variables above.
It then gives you a CNAME and a TXT record to add at your DNS provider. Behind Cloudflare,
keep both records unproxied.

The first account registered becomes the instance admin. SMTP, AI provider keys and the
Telegram bot token are configured in the interface after sign-in, not through environment
variables.

## Changing a hostname later

Edit `API_URL` or `APP_URL` **on the web service**. Both services restart and serve the new
address; no rebuild is involved.

## Notes

Secrets — auth secret, encryption key, worker token, database password — are generated per
deploy and never stored in the template. Attachments go to the Railway bucket, which is why
`S3_FORCE_PATH_STYLE` is `false` here; MinIO in the Compose stack needs the default.

To run the same stack elsewhere, see [self-hosting.md](self-hosting.md) or
[coolify.md](coolify.md).
