# @itsaplan/runner

[It's a Plan](https://itsaplan.dev) is a self-hosted, open-source issue tracker. An AI
agent in it is a project member: it has a role, permissions, and its own issues.

This package runs such agents on your own machine — one, or several at once.

- Polls your instance for the agent's queued runs. Runs each one with a coding agent CLI.
  Reports the result.
- Has presets for Claude Code, Codex, opencode, Antigravity CLI, GitHub Copilot CLI,
  Pi, and Oh My Pi (`omp`). Each preset sets the unattended flags and the session resume.
- Runs your own `command` instead, if you prefer. The command takes the task on stdin.
- Answers the agent's chat. Sends the text and the tool calls while the CLI prints them.
- Receives the tasks on a port instead of polling, for an agent whose Connection is
  Endpoint. See [Receiving tasks on a port](#receiving-tasks-on-a-port).

## Quick start

**1. Get the agent's key.** In your project, go to Settings, AI agents. Create an agent
of kind External. The key appears one time only, at creation.

**2. Enable MCP** for the project, in Settings, MCP Server. MCP is off by default. The
agent reads the issue and writes its result through it.

**3. Give the coding agent the address of that server.** Claude Code, Oh My Pi, and Pi
(through `pi-mcp-adapter`) read `.mcp.json` from the folder they run in. For the other
CLIs, see
[Coding agent setup](https://github.com/croffasia/itsaplan/blob/main/docs/runner.md).

```json
{
  "mcpServers": {
    "itsaplan": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": { "Authorization": "Bearer ${ITSAPLAN_API_KEY}" }
    }
  }
}
```

The runner sets `ITSAPLAN_API_KEY` for the command that it starts. The key thus stays in
one file.

**4. Write `itsaplan-runner.json`** in the same folder:

```json
{
  "url": "http://localhost:3000",
  "apiKey": "the key you just copied",
  "agent": "claude"
}
```

**5. Start it:**

```bash
npx -y @itsaplan/runner
```

The project shows the agent as online in a few seconds. Delegate an issue to the agent,
or mention it in a comment. The task then starts in your terminal.

## Which coding agent

`agent` names a CLI that the runner knows. The runner then builds the command itself: the
flags for an unattended run, and the session resume. Every preset keeps a chat session.

| Agent         | Runs               |
| ------------- | ------------------ |
| `claude`      | Claude Code        |
| `codex`       | Codex CLI          |
| `opencode`    | opencode           |
| `antigravity` | Antigravity CLI    |
| `copilot`     | GitHub Copilot CLI |
| `pi`          | Pi                 |
| `omp`         | Oh My Pi           |

Each preset needs the CLI's own MCP config.
[Coding agent setup](https://github.com/croffasia/itsaplan/blob/main/docs/runner.md) holds
that file, and the notes for each CLI.

`--agent` on the command line has priority over the file, except over an `agents` entry
that names its own. The runner appends the arguments after `--` to the ones from the
preset:

```bash
npx -y @itsaplan/runner --agent claude -- --model opus
```

Write the same arguments in the file if a service manager starts the runner:

```json
{
  "url": "http://localhost:3000",
  "apiKey": "the key you copied on creation",
  "agent": "claude",
  "cwd": "/Users/me/work/my-repo",
  "args": ["--model", "opus"]
}
```

Your arguments come after the preset's own. A repeated flag thus replaces its value.

`command` replaces the preset with your own shell command. The command receives the task
on stdin. The runner keeps no session for it, because it does not know how to resume one.

## Several agents on one runner

One key is one agent. A runner set up the way you want it can serve several of them at
once: it polls for each key on its own, and every agent uses the coding agent, the working
directory and the arguments the file already gives.

```json
{
  "url": "http://localhost:3000",
  "agent": "claude",
  "cwd": "/Users/me/work/my-repo",
  "apiKeys": ["the first agent's key", "the second agent's key"]
}
```

Nothing else changes: the runner gives each command its own `ITSAPLAN_API_KEY`, so the one
MCP config in that folder works for all of them.

Use `agents` instead of `apiKeys` where an agent needs something of its own. A field an
entry sets replaces the shared one, and it inherits every field it leaves out, except its
`apiKey`, which every entry sets itself. `name` is what the runner's log lines call that
agent; without it they number the agents `#1`, `#2` in the order of the file.

```json
{
  "url": "http://localhost:3000",
  "agent": "claude",
  "cwd": "/Users/me/work/my-repo",
  "agents": [
    { "apiKey": "the first agent's key", "name": "planner" },
    {
      "apiKey": "the second agent's key",
      "cwd": "/Users/me/work/other-repo",
      "args": ["--model", "opus"]
    }
  ]
}
```

`concurrency` counts per agent and per feed, so a runner with three agents at
`concurrency: 2` can have six queued runs in flight and six chat answers alongside them,
each one a coding agent CLI of its own. The environment variables and the command-line
options describe every agent at once; an entry has priority over them.

An agent whose key the instance refuses stops on its own, and the others keep working.

## Receiving tasks on a port

By default the runner polls the instance for tasks. With `listen`, the instance sends each
task to the runner when the task is created. The runner then does not poll.

Use `listen` for a runner on a server that the instance can reach. On a laptop behind a
router, use polling. Polling needs no setup, and the chat is equally fast with it: a chat
claim waits on the server until a message comes.

**1.** In the agent's settings, open Connection and select Endpoint. Enter the public
HTTPS address of the runner's port (see [Reaching the port](#reaching-the-port)), and
save. Copy the signing secret.

**2.** Add `listen` and `signingSecret` to `itsaplan-runner.json`:

```json
{
  "url": "https://plan.example.com",
  "apiKey": "the agent's key",
  "agent": "claude",
  "listen": 4000,
  "signingSecret": "whsec_…"
}
```

**3.** Start the runner. It logs `listening on port 4000`. In the agent's settings, click
Send test. The result must be `200`.

The runner answers each task immediately. Then it runs the task as it runs a polled task,
with the same command, heartbeats and result. The rules for a request:

- The runner accepts only a `POST` request signed with the secret of one of its agents.
- It refuses a request whose signature time is more than five minutes from its clock.
- If the instance sends a task again while the task runs, the runner does not start it a
  second time.

Several agents can use one port. The runner identifies the agent by the secret, so each
agent needs its own `signingSecret`. Put the agents in `agents`:

```json
{
  "url": "https://plan.example.com",
  "agent": "claude",
  "listen": 4000,
  "agents": [
    { "apiKey": "the first agent's key", "signingSecret": "whsec_first…" },
    { "apiKey": "the second agent's key", "signingSecret": "whsec_second…" }
  ]
}
```

In the same file, the runner polls for each agent that has no `listen`.

### Reaching the port

The runner serves plain HTTP. In production, the instance requires HTTPS. Put a tunnel or a
reverse proxy in front of the port:

- **Reverse proxy** on a server with a domain. Caddy gets the certificate automatically:

  ```
  runner.example.com {
    reverse_proxy localhost:4000
  }
  ```

- **Cloudflare Tunnel.** `cloudflared tunnel --url http://localhost:4000` prints a
  `trycloudflare.com` address. The address changes each time the tunnel starts, and then
  you must change the agent's URL too. A named tunnel on your own domain keeps the same
  address.
- **ngrok.** `ngrok http 4000`. A static domain in your ngrok account keeps the same
  address.
- **Tailscale Funnel.** `tailscale funnel 4000` publishes the port at the machine's
  `ts.net` address.

On a private network without a tunnel, add the runner's host to `SSRF_ALLOWED_HOSTS` on
the instance. That host must also use HTTPS. When `NODE_ENV` on the instance is not
`production` or `test`, the instance also accepts `http://` and private addresses, for
example `http://localhost:4000`.

## Settings

The runner reads `./itsaplan-runner.json`. For a different file, give the path as an
argument or in `ITSAPLAN_RUNNER_CONFIG`:

```bash
npx -y @itsaplan/runner /path/to/config.json
```

The environment variables have priority over the file. The command-line options have
priority over both. An `agents` entry has priority over all three, for the fields it sets.

| Field            | Environment variable        | Default            | What it does                                                       |
| ---------------- | --------------------------- | ------------------ | ------------------------------------------------------------------ |
| `url`            | `ITSAPLAN_URL`              | required           | Your Itsaplan instance                                             |
| `apiKey`         | `ITSAPLAN_API_KEY`          | required           | The external agent's key. Replaced by `apiKeys` or `agents`        |
| `apiKeys`        |                             | —                  | Several keys, all with these settings. Not with `agents`           |
| `agents`         |                             | —                  | Several agents, each with its own key and settings. Not with `apiKeys` |
| `agent`          | `ITSAPLAN_AGENT`            | —                  | The coding agent to run                                            |
| `args`           |                             | `[]`               | Arguments added after the preset's                                 |
| `command`        | `ITSAPLAN_COMMAND`          | —                  | Your own command, instead of `agent`                               |
| `cwd`            | `ITSAPLAN_CWD`              | where you start it | Working directory for the command                                  |
| `env`            |                             | `{}`               | Extra variables for the command                                    |
| `concurrency`    | `ITSAPLAN_CONCURRENCY`      | `1`                | Tasks at once, per agent. Queued runs and chat answers count apart |
| `pollIntervalMs` | `ITSAPLAN_POLL_INTERVAL_MS` | `3000`             | Wait after an empty queue. Minimum 1000                            |
| `timeoutMs`      | `ITSAPLAN_TIMEOUT_MS`       | `1800000`          | Time before the runner stops a task                                |
| `outputFormat`   | `ITSAPLAN_OUTPUT_FORMAT`    | the preset's       | How the runner reads run and chat output                                 |
| `listen`         | `ITSAPLAN_LISTEN`           | —                  | Port that receives the tasks. The runner does not poll for the agent |
| `signingSecret`  | `ITSAPLAN_SIGNING_SECRET`   | —                  | The agent's signing secret. Required with `listen`                 |

Set `agent` or `command`. With the environment you need no file at all:

```bash
export ITSAPLAN_API_KEY=…
npx -y @itsaplan/runner --agent claude
```

## What the coding agent receives

### The task text

The server writes the task text. The text states what occurred, what to do, and to post
the result as a comment on the issue. Your own `command` receives the text on **stdin**. A
preset gives it to its CLI in the way that CLI accepts it: on stdin for `claude` and
`codex`, as an argument for `antigravity`, `copilot`, `opencode`, `pi` and `omp`.

The agent reads all other data through the MCP server at `$ITSAPLAN_URL/mcp`. The agent
sends `$ITSAPLAN_API_KEY` as a bearer token, and acts as its own user with its role.

### The environment

Every run holds these variables:

| Variable                 | What it holds                                                               |
| ------------------------ | --------------------------------------------------------------------------- |
| `ITSAPLAN_URL`           | the instance that sent the task                                             |
| `ITSAPLAN_API_KEY`       | the agent's key, for the API and the MCP server                             |
| `ITSAPLAN_TRIGGER`       | `mention`, `delegation`, `field`, `schedule`, `manual`, `status`, or `chat` |
| `ITSAPLAN_SYSTEM_PROMPT` | the context of the run, for a command that takes a system prompt            |
| `ITSAPLAN_TIMEOUT_MS` | the effective task timeout in milliseconds, including per-agent overrides |

Custom commands can read `ITSAPLAN_TIMEOUT_MS` to configure their own execution timeout.
The runner supplies the resolved `timeoutMs`, overriding any inherited value or value in
`env`. Its timer starts when the command is spawned, so startup and waiting inside the
command count toward the same limit.

A queued run adds three more:

| Variable            | What it holds                                                   |
| ------------------- | --------------------------------------------------------------- |
| `ITSAPLAN_RUN_ID`   | the run's id                                                    |
| `ITSAPLAN_ISSUE`    | the issue key, for example `MKT-42`. Empty if there is no issue |
| `ITSAPLAN_ISSUE_ID` | the numeric id of the issue. Empty if there is no issue         |

A chat message adds three others in their place, and `ITSAPLAN_TRIGGER` is `chat`:

| Variable              | What it holds                                                     |
| --------------------- | ----------------------------------------------------------------- |
| `ITSAPLAN_THREAD_ID`  | the conversation's id                                             |
| `ITSAPLAN_MESSAGE_ID` | the id of the message to answer                                   |
| `ITSAPLAN_SESSION_ID` | the coding agent's session to resume. Empty for the first message |

The task text of a chat message includes the conversation, unless a session holds it. See
Sessions below.

### The result

Exit code `0` is a success. Any other code is a failure. The end of stderr then becomes
the error. In both cases the run's output is the answer: all of stdout with `outputFormat`
`text`, and with an event stream format the text the agent wrote after its last tool call
(see Chat below for the formats).

## Chat

The runner streams the answer to the chat while the command runs. It reports the tool
calls with the answer. `outputFormat` tells the runner how to read the output:

- `text` — all the output is the answer.
- `claude-stream-json`, `codex-jsonl`, `opencode-json`, `antigravity-stream-json`,
  `copilot-json`, `pi-json` — the event stream of that CLI. `pi` and `omp` both use
  `pi-json`.

A preset sets `outputFormat` for you. Set it yourself only with your own `command`. If the
output does not agree with the format, the runner sends the output as plain text.

### Sessions

Each conversation resumes one session of the coding agent, which keeps its full context.
Without a session the server sends the last 20 messages of the conversation as plain text.

- The chat header shows the session id. Run `claude --resume <id>` in the runner's working
  directory to open the same session in your terminal.
- Your own `command` keeps no session. Each chat message then includes the conversation.
- A session stays on the machine that started it. If you delete its files or move the
  runner, the answers fail. Start a new chat then.

## Requirements

- **Node 20 or later.**
- **An It's a Plan instance 0.10.0 or later.** The chat needs 0.11.0. An older instance
  gives the runner only the queued runs. `listen` needs 1.6.0.
- **An external agent in your project.** The runner authenticates with its API key.
- **The coding agent, installed and signed in on the same machine.** The runner starts the
  CLI as you, but it cannot sign in for you.

macOS and Linux need nothing else. The runner starts a preset directly, so its arguments
need no quotes. Your own `command` goes to `sh -c`, so write it as POSIX shell.

Windows needs WSL2, because `cmd.exe` and PowerShell have no `sh`:

```powershell
wsl --install     # installs Ubuntu, then reboot
```

Do everything else in WSL: Node, the coding agent, the config file, and the runner.

- Keep the working directory in the WSL file system (`~/work/repo`), not under
  `/mnt/c/...`. Access between the two file systems is slow.
- An instance on the Windows host is available at `http://localhost:3000`.

## License

Copyright © 2026 Andrii Poluosmak.

[Apache-2.0](LICENSE).

### Issue run transcripts

A server that advertises `traceEvents` on a run claim accepts its streamed messages
and tool calls at `/agent-runs/:runId/events`. The runner reports numbered batches
for the claimed attempt before reporting its result. Retries of a batch use the
same offsets. A server without this capability still receives the final result.

The `codex-jsonl` format records the session UUID from `thread.started`, shell
commands, MCP calls and file changes. Plan shows an **Open in Codex** link for that
attempt. The session must be available in the viewer's local Codex app or a
connected host; the link does not publish or copy the Codex session. The events
recorded in Plan are readable there independently of the local session.

Each attempt records up to 2,000 events or 1 MB. Plan marks a truncated transcript;
the final run result is reported separately. Plain-text commands provide messages
and output, while tool details require a supported structured output format.
