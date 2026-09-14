# Hermes dashboard chat

Vexol connects to the Hermes API Server through the Vexol API. Browsers never
connect to Hermes and never receive a Hermes URL or key.

The first enabled dashboard agent is Bob:

- Vexol slug: `bob`
- Hermes profile: `default`
- route prefix: `/p/default`
- server-side key: `HERMES_BOB_API_KEY`

The existing Bob Dashboard MCP remains a separate read-only integration. Hermes
uses that MCP to read Vexol data. Dashboard chat uses the reverse connection to
send user messages to Hermes.

## Hermes setup

Configure Hermes outside this repository:

1. Enable the API Server for the default profile.
2. Set a strong `API_SERVER_KEY` in the default profile environment.
3. Enable multi-profile gateway routing when profiles share one listener.
4. Restart the Hermes gateway.
5. Verify these authenticated default-profile routes:
   - `GET /p/default/v1/capabilities`
   - `POST /p/default/api/sessions`
   - `POST /p/default/api/sessions/<id>/chat/stream`
6. Confirm the capabilities response advertises `session_resources`,
   `session_chat_streaming`, and the matching session endpoints.

Do not enable browser CORS for this integration. Keep Hermes bound to localhost
or a private network.

## Vexol setup

Set these server-only variables:

```dotenv
HERMES_API_BASE_URL=http://host.docker.internal:8642
HERMES_BOB_PROJECT_KEY=VEX
HERMES_BOB_API_KEY=<default profile API_SERVER_KEY>
```

The allowed Vexol project must contain one external AI agent named with the
username `bob-agent` or `bob`. The Chats page lists that agent only after the
project binding is valid. Its status is based on the authenticated Hermes
capabilities check.

Each New chat action creates a new Hermes session. Vexol stores the immutable
agent/session binding, a project- and user-scoped transcript, and idempotent run
state. Archiving removes a conversation from the Vexol inbox and retains Hermes
history.

## Docker networking

The deployment compose files map `host.docker.internal` to the Docker host. Use
that hostname when Hermes runs on the same machine outside Docker. Use a private
service hostname when Hermes runs on a private Docker or overlay network.

Scout, Analyst, and Instagram are not enabled in the dashboard allowlist yet.
Add and test each profile with its own environment variable and Hermes
`API_SERVER_KEY`. Never reuse Bob's key for another profile.
