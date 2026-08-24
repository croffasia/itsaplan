<div align="center">

<img src="assets/banner.png" alt="It's a Plan — open-source project management and issue tracking where people and AI agents ship together" width="100%" />

<a href="https://www.producthunt.com/products/it-s-a-plan/reviews/new?utm_source=badge-product_review&utm_medium=badge">
  <img src="assets/product-hunt-strip.svg" alt="It's a Plan is on Product Hunt — leave a review" width="100%" />
</a>

### Open-source project management and issue tracking, with AI agents built in

Self-hosted, open-source project management and issue tracking, and an alternative to Linear,
Plane, and Jira. The difference: AI agents work here like any teammate. Hand them issues, or
run the whole thing over the REST API, webhooks, and MCP.

If It's a Plan looks useful to you, star the repo ⭐ — it helps other people find it.

[Website](https://itsaplan.dev) · [Discussions](https://github.com/croffasia/itsaplan/discussions) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![CI](https://github.com/croffasia/itsaplan/actions/workflows/ci.yml/badge.svg)](https://github.com/croffasia/itsaplan/actions/workflows/ci.yml)
[![Stars](https://img.shields.io/github/stars/croffasia/itsaplan?style=flat)](https://github.com/croffasia/itsaplan/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/croffasia/itsaplan)](https://github.com/croffasia/itsaplan/commits/main)

<img src="assets/screenshots/board-app-dark.png" alt="Work items board with issues across Backlog, Todo, In Progress, Done, and Canceled" width="100%" />

</div>

## About

Most trackers bolt AI on as a chatbot. Here an agent is a real member of the team. It has
a role, permissions, and an assignee slot, and it works the same board your people do.

It's a self-hosted, open alternative to Linear, Plane, and Jira. You run it on your own
server and database.

- **Own your stack.** Your server, your database. No per-seat fees, no lock-in.
- **Agents as teammates.** Give an agent a model, a prompt, skills, and tools. Assign it
  issues like you would a person.
- **One board for both.** People and agents share the same board, threads, and cards.
- **Automate anything.** Drive it all through the REST API, MCP, and signed webhooks.

Heads-up: this is under active development. Expect breaking changes before the first
stable release.

## Need a feature sooner?

The roadmap is ours, but the order is negotiable. If you need a feature with a high
priority, write to [@croffasia on Telegram](https://telegram.me/croffasia) - for a
donation we can discuss moving it up the queue.

## Features

**Tracking**

- Configure issues per project: custom fields, labels, states, and issue types
- Kanban, table, timeline, and calendar views, saved as tabs with their own filters, display
  fields, and two-level grouping
- Cycles that time-box the work, with the unfinished issues carried into the next one
- Subtasks, checklists, attachments, and links between issues: blocks, relates, duplicates
- Comment threads with replies, and @username mentions of people and agents
- Configurable dashboards for project analytics: throughput, breakdown, pulse
- Quick actions that run on an issue, and auto-assignment when an issue enters a state
- Freeform notes boards: sticky notes on a canvas, with colors, checklists, and connections
- Share a view or an issue by public link, read-only and without sign-in
- Initiatives that group and track work across projects
- Auto-archive, a notification inbox, role-based access control, and more

**AI agents**

- Agents as project members with their own permissions and assigned issues
- Internal agents run on the instance: configure the model, system prompt, tools, and reusable
  skills, written inline or imported from a GitHub repository — built on the
  [Mastra](https://github.com/mastra-ai/mastra) agent framework
- External agents run wherever you want: drive the run queue through the API with your own
  implementation, or install [`@itsaplan/runner`](packages/runner) and let it hand every task to
  Claude Code, Codex, Antigravity CLI, GitHub Copilot CLI, opencode, or any command that reads stdin —
  on your own machine, under your own account
- A run starts on an @mention in a comment, on an assignment, or on a schedule
- Tools that reach outside the tracker: Notion, Telegram, Threads, Instagram, Jina, and Firecrawl
- Built-in chat with per-agent conversation history, with an external agent too: the runner
  answers from your machine, streaming the reply and the tools it uses, and resumes the same
  coding agent session on every message of the conversation

**Platform**

- REST API with an OpenAPI reference and API keys
- MCP server, so an external assistant can read and change issues through the same API
- Pull requests from GitHub, GitLab, Gitea, Forgejo, and Bitbucket: "Fixes KEY-42" links the pull
  request to the issue and moves it when the pull request opens and merges
- Outgoing webhooks: subscribe to events, signed payloads, and retries with a delivery log
- Sign in with an email or a username and a password, a passkey, or Google
- Notifications by email (SMTP or Resend) and Telegram, with per-member preferences
- Interface in English, Ukrainian, Russian, Simplified Chinese, and Arabic
- Instance administration: storage limits, mail transport, and instance-wide settings

## Getting started

### Deploy on Railway — recommended

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/its-a-plan?referralCode=lQ5O6i&utm_medium=integration&utm_source=button&utm_campaign=itsaplan)

The whole stack in one click, no server to run. You supply two hostnames and Railway
generates every secret. A domain of your own is required — see
[the guide](docs/railway.md) for why, and for the steps after the deploy.

### Run it on your own server

Requirements: Docker and a domain behind a TLS-terminating reverse proxy.

```bash
git clone https://github.com/croffasia/itsaplan.git
cd itsaplan
cp .env.example .env      # set API_URL, APP_URL, and the secrets
docker compose up -d --build
```

One command brings up the whole stack: Postgres, MinIO, api, worker, bot, and web. The
first account registered becomes the instance admin.

- [Deploy on Railway](docs/railway.md) — one-click hosted deploy from the template
- [Self-hosting](docs/self-hosting.md) — the full production setup, secrets, and updates
- [Deploy on Coolify](docs/coolify.md) — the same stack on a Coolify instance
- [Local development](docs/development.md) — running the apps on the host, and the tests
- [Coding agent setup](docs/runner.md) — the config for each CLI that `@itsaplan/runner` runs

## Built with

| Layer     | Technology                                               |
| --------- | -------------------------------------------------------- |
| Runtime   | [Bun](https://bun.sh) + [Turborepo](https://turbo.build) |
| Backend   | [Elysia](https://elysiajs.com/)                          |
| Frontend  | [Next.js](https://nextjs.org/) App Router, SSR           |
| UI        | [shadcn/ui](https://ui.shadcn.com/) + Tailwind v4        |
| Auth      | [better-auth](https://better-auth.com/)                  |
| Database  | [Drizzle](https://orm.drizzle.team/) + PostgreSQL        |
| Storage   | S3-compatible object store (MinIO)                       |
| AI agents | [Mastra](https://github.com/mastra-ai/mastra)            |

```
apps/api             Elysia HTTP API, mounts better-auth at /api/auth/*
apps/web             Next.js app, server-side rendered
apps/worker          webhooks, notifications, agent runs
apps/bot             Telegram bot
packages/db          Drizzle client, schema, migrations
packages/auth        better-auth server instance
packages/crypto      AES-256-GCM encryption for secrets at rest
packages/mailer      SMTP and Resend transport
packages/agent-tools tool integrations for the agent runtime
packages/runner      CLI that runs an external agent's tasks on your own machine
```

The web app never imports the packages directly, it talks to the API over HTTP.

## More from us

**[Vibe Code Kit](https://vibecodekit.dev)** — a Claude Code plugin with 20+ expert skills
that turn AI slop into senior-level code. It teaches your AI agent professional development
and design practices, so you ship production-ready code on the first try. Works with Claude
Code, Codex, Antigravity, and Cursor.

It's a Plan is built with it — the code you are reading is the proof.

## Contributing

Issues and pull requests are welcome — bug fixes, features, docs, all of it. Start with
[CONTRIBUTING.md](CONTRIBUTING.md). It covers the setup, the conventions, and how a change
gets merged. Be kind; we follow a [Code of Conduct](CODE_OF_CONDUCT.md).

Not ready to contribute code? [Star the repo](https://github.com/croffasia/itsaplan) and share
it — it is the simplest way to help the project grow.

## Security

Found a vulnerability? Report it privately through
[GitHub Security Advisories](https://github.com/croffasia/itsaplan/security/advisories/new),
not a public issue, so we can fix it first. Details in [SECURITY.md](SECURITY.md).

## License

Copyright © 2026 Andrii Poluosmak.

[AGPL-3.0](LICENSE), except `packages/runner`, which is
[Apache-2.0](packages/runner/LICENSE).
