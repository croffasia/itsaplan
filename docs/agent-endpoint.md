# Agent endpoint

An external agent gets its tasks in one of two ways:

- A runner on your machine asks the instance for the tasks. See [Coding agent setup](runner.md).
- The instance sends the tasks to an endpoint that you run: an AWS Lambda function URL, an
  Azure Function, a Cloudflare Worker, or any other HTTPS server.

This page describes the endpoint.

The endpoint gets the same tasks as a runner: delegations, mentions, field and status
triggers, schedules, manual runs, and chat messages. Each task has the same prompt and
system prompt. The endpoint sends the result through the same routes as a runner.

## Set it up

1. Create an external agent. Copy its API key.
2. In the agent's Connection section, select Endpoint. Enter the URL and save.
3. Copy the signing secret below the URL.
4. Click Send test. The section shows the status code of the answer and the start of its
   body.

The URL must use HTTPS and resolve to a public address. To use a private host, add it to
`SSRF_ALLOWED_HOSTS` on the instance. That host must also use HTTPS.

When `NODE_ENV` on the instance is not `production` or `test`, the instance also accepts
`http://` and private addresses, for example `http://localhost:4000`. Use this to test a
local server before you deploy the function.

While the agent has a URL, the runner claim routes (`POST /agent-runs/claim`,
`POST /agent-chats/claim`) answer 409. To connect a runner again, clear the URL.

## Requests

The instance sends each task as one `POST` request with a JSON body and these headers:

| Header                 | Value                                    |
| ---------------------- | ---------------------------------------- |
| `Content-Type`         | `application/json`                       |
| `X-Itsaplan-Event`     | `agent.run`, `agent.chat` or `ping`      |
| `X-Itsaplan-Signature` | `t=<unix seconds>,v1=<hex HMAC-SHA256>`  |

The body of an `agent.run` request:

```json
{
  "event": "agent.run",
  "agent": { "id": 12, "username": "cloud-bot" },
  "apiUrl": "https://api.example.com",
  "run": {
    "id": 345,
    "trigger": "status",
    "prompt": "The task, framed with what started it",
    "systemPrompt": "The project, the people, and the agent's instructions",
    "attempts": 1,
    "issueId": 678,
    "issueIdentifier": "MKT-42"
  }
}
```

`apiUrl` is the `API_URL` of the instance, or `null` if `API_URL` is not set. An
`agent.chat` request has `message` instead of `run`:

```json
{
  "id": 901,
  "threadId": "chat:12:...",
  "prompt": "The person's message, after the earlier turns",
  "systemPrompt": "The projects, the person, and the agent's instructions",
  "attempts": 1,
  "sessionId": null
}
```

A `ping` request has only `event`, `agent` and `apiUrl`. Send test sends a `ping`.

### Verify the signature

The signature is an HMAC-SHA256 of `<t>.<raw body>`. The key is the signing secret.
Calculate it on the raw body, before you parse the JSON:

```js
import { createHmac, timingSafeEqual } from 'node:crypto';

function verify(secret, header, rawBody) {
  const { t, v1 } = Object.fromEntries(header.split(',').map((part) => part.split('=')));
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  const given = Buffer.from(v1 ?? '');
  const wanted = Buffer.from(expected);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}
```

Project webhooks use the same signature, with the secret of the webhook.

### Answer

The status code of the answer tells the instance what to do with the task:

- **2xx.** The endpoint accepted the task. The instance leases the task for
  `AGENT_RUN_LEASE_SECONDS` (chat: `AGENT_CHAT_LEASE_SECONDS`), 300 seconds by default.
  A heartbeat extends the lease. The result closes the task. If the lease ends before the
  result, the instance sends the task again. It sends a task at most
  `AGENT_RUN_MAX_ATTEMPTS` times (chat: `AGENT_CHAT_MAX_ATTEMPTS`), 3 by default.
- **Other status code, or a connection error.** The instance sends a run again after a
  delay. The first delay is up to 30 seconds. Each next delay is longer, up to 30 minutes.
  After the last attempt, the run fails. A chat message fails immediately, because a
  person waits for the answer.
- **No answer in `AGENT_INVOCATION_TIMEOUT_MS`** (15 seconds by default). The instance
  treats the task as accepted and keeps it leased. Thus an endpoint that does the work
  before it answers does not get the same task again while the lease lasts.

The instance does not use the body of the answer. Only Send test shows it. The result of
a task comes only through the routes below.

### Send the result

Call the API at `apiUrl`. Put the agent's API key in the `x-api-key` header:

| Route                                    | Body                                                     |
| ---------------------------------------- | -------------------------------------------------------- |
| `POST /agent-runs/:runId/heartbeat`      | none                                                     |
| `POST /agent-runs/:runId/result`         | `{ "status": "success" \| "failed", "output", "error" }` |
| `POST /agent-chats/:messageId/events`    | `{ "events": [AG-UI events], "sessionId" }`              |
| `POST /agent-chats/:messageId/heartbeat` | none                                                     |
| `POST /agent-chats/:messageId/result`    | `{ "status": "success" \| "failed", "error" }`           |

A chat answer is a sequence of AG-UI events. Send a `TEXT_MESSAGE_CONTENT` event with a
`delta` for each part of the text. Send the tool call events for each tool that the agent
uses. When the person stops the answer, the events, heartbeat and result routes of that
answer return `{ "canceled": true }`. Then stop the work on that answer.

The agent reads and changes issues with the same key, through the REST API or the MCP
server at `<apiUrl>/mcp`.

## With the runner

With `listen`, `@itsaplan/runner` is the endpoint. It receives the tasks on a port and
runs them with a coding agent CLI, the same as when it polls. See
[Receiving tasks on a port](https://github.com/croffasia/itsaplan/blob/main/packages/runner/README.md#receiving-tasks-on-a-port).

## Example: AWS Lambda

A Node.js handler for a Lambda function URL. Set `ITSAPLAN_API_KEY` and
`ITSAPLAN_SIGNING_SECRET` in the environment of the function:

```js
import { createHmac, timingSafeEqual } from 'node:crypto';

const api = (base, path, body = {}) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'x-api-key': process.env.ITSAPLAN_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

export const handler = async (event) => {
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body;
  const signature = event.headers['x-itsaplan-signature'] ?? '';
  if (!verify(process.env.ITSAPLAN_SIGNING_SECRET, signature, raw)) {
    return { statusCode: 401, body: 'bad signature' };
  }
  const payload = JSON.parse(raw);
  if (payload.event === 'agent.run') {
    const output = await doTheWork(payload.run); // your agent: a model call, a pull request
    await api(payload.apiUrl, `/agent-runs/${payload.run.id}/result`, {
      status: 'success',
      output,
    });
  }
  return { statusCode: 200, body: 'ok' };
};
```

`verify` is the function from [Verify the signature](#verify-the-signature). A function URL
keeps the request open until the handler returns. Thus this handler answers after the
work. The instance stops the wait after 15 seconds and keeps the task leased. For work
longer than the lease, do one of these:

- Send heartbeats.
- Invoke a second function asynchronously with the task, and answer immediately.
