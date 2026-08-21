# Telemetry

A self-hosted instance sends one snapshot of itself a day. It tells the project which
versions are still running, which features get used, and where deliveries fail on
machines nobody reports from.

Telemetry is on by default. Everything it sends is listed below.

## When it is sent

The first snapshot goes out when the worker starts, so an instance that is set up and
removed the same hour is still counted once. After that each instance picks one minute
of the day at random and keeps it, then reports once a day from that minute on. That
spreads the traffic instead of every instance reporting at midnight UTC.

A send that fails is retried with a growing delay for five attempts, then once an hour.
The worker logs each failure and carries on with its other work.

## Turning it off

Set either variable in `.env`:

```bash
TELEMETRY_DISABLED=1
# or the cross-tool convention, read the same way:
DO_NOT_TRACK=1
```

Any value except `0` (and an empty one) turns telemetry off. Nothing is sent after
that, and no instance id is generated.

## Seeing what is sent

```bash
TELEMETRY_DEBUG=1
```

The worker logs the exact body before each send.

## What is sent

- A random id, generated once for this instance.
- The day the instance was installed, taken from the timestamp of its first database
  migration.
- The running version.
- The runtime: Bun version, OS and architecture, Postgres major version, whether it
  runs in Docker.
- How many users, projects and issues there are, plus how many users signed in and how
  many issues were created in the last 30 days, and how much space attachments take.
  All of it as size ranges (`6-20`, `101-1000`), never exact numbers.
- Which features are used, as yes/no, twice over: ever, and in the last 30 days.
  Initiatives, note boards, dashboards, saved views, custom fields, label groups,
  project actions, attachments, cycles, checklists, sub-issues, issue links, watchers,
  shared issues, shared views, agent chats, agent skills.
- Which optional sections a project switched off in Settings -> Features, as yes/no.
- Which integrations are set up and switched on, as yes/no: email, Google sign-in,
  Telegram bot, webhooks, API keys, MCP, repository hosting, per-project integration
  credentials.
- Which integrations hold a credential, by their catalogue key (`openai`, `jina`), and
  which repository hosts have delivered (`github`, `gitlab`, `gitea`, `forgejo`,
  `bitbucket`). The keys only, never a credential or a repository name.
- The sign-up policy: whether registration is open, invite-only or closed, whether
  email has to be confirmed, whether magic links are on.
- The interface languages users picked, as language codes.
- AI agents: how many, how many are internal and how many external, how many runs in
  the last 30 days (as ranges), how many skills, how many chats, whether schedules are
  used, whether an external agent's runner polled in the last 30 days, and which
  triggers started a run (mention, delegation, schedule, manual).
- The share of webhook deliveries and of agent runs that failed in the last 30 days.

## What is never sent

Names of anything. Project keys, issue titles, descriptions, comments. Email
addresses, user names. Webhook URLs, agent prompts, credentials, environment
variables, file contents, logs, error messages. Exact counts.

The instance id is a random uuid stored in the database. It is not derived from your
domain, your keys, or anything else in the instance.

## Where it goes

`https://telemetry.itsaplan.dev`, operated by the project. No third-party analytics
service is involved. The address is fixed in the worker; there is no setting that
points it somewhere else.
