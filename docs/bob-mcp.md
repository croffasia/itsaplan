# Bob read-only MCP

The API exposes a stateless Streamable HTTP MCP endpoint for the fixed service actor
`bob-agent`:

```text
POST http://localhost:3000/mcp/v1/bob
```

Production uses the configured `API_URL` origin and must use HTTPS. The repository does not
store a production hostname.

## Configuration

Set these server-side variables on the API service:

```dotenv
VEXOL_BOB_MCP_TOKEN=***
VEXOL_BOB_MCP_PROJECT_KEY=VEX
VEXOL_LEADS_DATABASE_URL=***
VEXOL_LEADS_PROJECT_KEY=VEX
```

Create an external project agent with username `bob-agent`. Assign it a project role with only
the required read permissions: `work_items.read`, `dashboards.read`, and `leads.read`. Enable MCP
for that project. The endpoint resolves this agent's `project_member` row on every request. It
does not use a browser session or a personal dashboard login.

The bearer token must contain at least 32 characters and is read only by the API process. It has no public environment prefix and is
not included in the web image. Rotate it by replacing `VEXOL_BOB_MCP_TOKEN` and restarting the
API service. Do not store the token in a command history or a checked-in file.

## Tools

- `get_dashboard_summary`
- `list_projects`
- `get_project`
- `list_lead_campaigns`
- `list_leads`
- `get_lead_detail`
- `list_agent_runs`

All tools are read-only. Page size is limited to 50. Tool responses are limited to 256 KiB and
requests time out after 10 seconds. The API permits a burst of 20 requests and refills at 60
requests per minute for `bob-agent`. A multi-replica deployment needs a shared edge rate limit
in addition to the per-process limiter.

## Audit records

Every request writes an `mcp_audit_log` row with the actor, tool or protocol method, timestamp,
request ID, configured project, optional resource ID, result, duration, returned record count,
and a fixed error code. Authorization headers, tokens, request bodies, responses, stack traces,
and personal data are not stored. If the database audit write fails, the API emits only a
sanitized operational event.

## Hermes connection

Current Hermes Agent versions support an interactive hidden bearer prompt:

```bash
hermes mcp add vexol --url "https://<API_ORIGIN>/mcp/v1/bob" --auth header
```

Answer yes when Hermes asks whether authentication is required, then enter the token at its hidden
`API key / Bearer token` prompt. Hermes stores it in `~/.hermes/.env` and places an environment
reference in `~/.hermes/config.yaml`. Do not put the token directly in the shell command. Run
`hermes mcp test vexol` to repeat discovery. Start a new Hermes session after adding or changing the
server; existing Telegram gateway processes must be restarted or reloaded.

A safe smoke-test question is: `List the configured Vexol project and summarize its open task,
lead campaign, review, and recent agent-run counts. Do not change anything.`

## Troubleshooting

- `401 Unauthorized`: the bearer token is missing or does not match the API environment.
- `403 Service unavailable`: the configured project, MCP toggle, `bob-agent`, membership, or
  required read permission is missing.
- `429 Too many requests`: wait for the service bucket to refill.
- `504 Request timed out`: check database health and proxy timeouts.
- Leads failures: verify the dedicated leads connection uses a read-only database role and that
  `VEXOL_LEADS_PROJECT_KEY` matches the configured project.

The reverse proxy must preserve `Authorization`, `Content-Type`, `Accept`, `X-Request-Id`, and
`X-Forwarded-Proto`; terminate TLS; permit POST requests with JSON responses; cap request bodies;
and set an upstream timeout above 10 seconds.
