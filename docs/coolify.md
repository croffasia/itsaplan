# Deploy on Coolify

Coolify builds the stack from source and generates the secrets itself, so the setup is a
resource, a branch, and two domains.

## 1. Create the application

**New Resource → Public Repository**, then pick the server to deploy on.

Enter the repository URL and press **Check repository**:

```
https://github.com/croffasia/itsaplan.git
```

Fill in the rest and press **Continue**:

| Field                  | Value                         |
| ---------------------- | ----------------------------- |
| Build Pack             | Docker Compose                |
| Base Directory         | `/`                           |
| Docker Compose Location| `/docker-compose.coolify.yml` |

## 2. Choose the branch

The application starts on `main`. Change it in **Configuration → Git Source**: set
**Branch**, leave **Commit SHA** as `HEAD`, and press **Save**.

| Branch    | What you get                                                                                                                                                                       |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `release` | released versions only. A mirror branch the release workflow moves to each published release. It appears with the first published release; until then there is nothing to deploy from. |
| `main`    | the latest features, the moment they merge. Expect breaking changes between releases.                                                                                              |

## 3. Set the domains

The stack serves two origins: the api and the web app. Both are set in
**Configuration → General**, one field per service, and each needs the container port after
the host:

| Field           | Example                         |
| --------------- | ------------------------------- |
| Domains for api | `https://api.example.com:3000`  |
| Domains for web | `https://plan.example.com:3001` |

Coolify turns those into `SERVICE_URL_API` and `SERVICE_URL_WEB`, which the compose file
reads as the api's `API_URL` / `APP_URL` and as the api origin baked into the web bundle.

Set both **before the first deploy**. Next.js inlines the api origin at build time, so
changing the api domain later needs a redeploy.

## 4. Deploy

Press **Deploy**. Postgres, MinIO, api, worker, bot, and web come up together; the api
applies the migrations on startup. The first account registered becomes the instance admin.

Secrets (database password, auth secret, encryption key, worker token, MinIO credentials)
are generated on the first deploy and stay stable across later ones — nothing to fill in by
hand. Optional variables from `.env.example` — legal document URLs, telemetry opt-out,
worker tuning — go in **Configuration → Environment Variables**.

To run the same stack outside Coolify, see [self-hosting.md](self-hosting.md).
