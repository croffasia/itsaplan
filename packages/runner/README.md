# @itsaplan/runner

[It's a Plan](https://itsaplan.dev) is self-hosted, open-source project management and
issue tracking where AI agents work like teammates: they have a role, permissions, and
issues assigned to them.

This package runs the tasks of one such agent on your own machine. It takes one queued
task at a time, passes it to a command you choose, and sends the result back. The
command is yours: Claude Code, Codex, a shell script, anything that reads stdin.

## Quick start

**1. Get the agent's key.** In your project: Settings, AI agents, create one of kind
External. The key is shown once, at creation.

**2. Write `itsaplan-runner.json`** in the folder you want the agent to work in:

```json
{
  "url": "http://localhost:3000",
  "apiKey": "the key you just copied",
  "command": "claude -p"
}
```

**3. Start it:**

```bash
npx -y @itsaplan/runner
```

The agent goes online in the project within a few seconds. Delegate an issue to it or
mention it in a comment, and the task lands in your terminal.

`Ctrl-C` stops the runner once the tasks in flight are done. Anything still queued
waits for the next runner.

## Settings

The runner reads `./itsaplan-runner.json`, or the path you give it as an argument or in
`ITSAPLAN_RUNNER_CONFIG`:

```bash
npx -y @itsaplan/runner /path/to/config.json
```

Environment variables win over the file:

| Field            | Environment variable        | Default            | What it does                        |
| ---------------- | --------------------------- | ------------------ | ----------------------------------- |
| `url`            | `ITSAPLAN_URL`              | required           | Your Itsaplan instance              |
| `apiKey`         | `ITSAPLAN_API_KEY`          | required           | The external agent's key            |
| `command`        | `ITSAPLAN_COMMAND`          | required           | The command that handles one task   |
| `cwd`            | `ITSAPLAN_CWD`              | where you start it | Working directory for the command   |
| `env`            |                             | `{}`               | Extra variables for the command     |
| `concurrency`    | `ITSAPLAN_CONCURRENCY`      | `1`                | How many tasks may run at once      |
| `pollIntervalMs` | `ITSAPLAN_POLL_INTERVAL_MS` | `3000`             | Wait after an empty queue, at least 1000 |
| `timeoutMs`      | `ITSAPLAN_TIMEOUT_MS`       | `1800000`          | When a task is killed as stuck      |

Which is how the key stays out of any file:

```bash
export ITSAPLAN_API_KEY=…
npx -y @itsaplan/runner
```

## What your command receives

The task text arrives on **stdin**. The rest of the run arrives in the environment:

| Variable                 | What it holds                                          |
| ------------------------ | ------------------------------------------------------ |
| `ITSAPLAN_URL`           | the instance the task came from                        |
| `ITSAPLAN_API_KEY`       | the agent's key, for the API and the MCP server        |
| `ITSAPLAN_RUN_ID`        | the run's id                                           |
| `ITSAPLAN_TRIGGER`       | `mention`, `delegation`, `schedule`, or `manual`       |
| `ITSAPLAN_SYSTEM_PROMPT` | context about the run, for commands that take a system prompt |
| `ITSAPLAN_ISSUE`         | the issue key, e.g. `MKT-42` (empty when there is none) |
| `ITSAPLAN_ISSUE_ID`      | the issue's numeric id                                 |

The task on stdin is written by the server: what happened, what to do, and to post the
result as a comment on the issue. The agent reads everything else through the MCP
server at `$ITSAPLAN_URL/mcp`, with `$ITSAPLAN_API_KEY` as a bearer token, acting as
its own user under its role. Enable MCP in the project settings.

Exit code `0` is a success, anything else a failure with the tail of stderr as the
error. Stdout becomes the run's output either way.

## Claude Code

`mcp.json`, next to the runner config:

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

`itsaplan-runner.json`:

```json
{
  "url": "http://localhost:3000",
  "apiKey": "the key you copied on creation",
  "command": "claude -p --mcp-config ./mcp.json --append-system-prompt \"$ITSAPLAN_SYSTEM_PROMPT\" --permission-mode auto --output-format text",
  "cwd": "/Users/me/work/my-repo"
}
```

- `--mcp-config` adds this instance's server on top of what the machine already has,
  so your own MCP servers, skills, and memory stay in the run. Drop it if the server is
  already in the repository's `.mcp.json` or was added with `claude mcp add`.
- `--permission-mode auto` covers permissions: nobody is there to answer a prompt, so a
  classifier reviews each action instead, MCP tool calls included.

## Codex

Codex reads its MCP servers from `~/.codex/config.toml`, and `bearer_token_env_var`
takes the key from the environment the runner already sets:

```toml
[mcp_servers.itsaplan]
url = "http://localhost:3000/mcp"
bearer_token_env_var = "ITSAPLAN_API_KEY"
```

`itsaplan-runner.json`:

```json
{
  "url": "http://localhost:3000",
  "apiKey": "the key you copied on creation",
  "command": "printf '%s\\n\\n%s' \"$ITSAPLAN_SYSTEM_PROMPT\" \"$(cat)\" | codex exec --sandbox workspace-write --skip-git-repo-check -",
  "cwd": "/path/to/working-dir"
}
```

- Codex has no system-prompt flag, so `printf` puts the system prompt in front of the
  task, and the trailing `-` tells Codex to read all of it from stdin.
- `--sandbox workspace-write` bounds what it may change: writes stay inside the working
  directory.
- `--skip-git-repo-check` is only needed when that directory is not a git repository.

## Gemini CLI

`.gemini/settings.json` in the working directory. Gemini expands `$VARS` in it, so the
key comes from the environment, and `trust` skips the tool confirmation a headless run
cannot answer:

```json
{
  "mcpServers": {
    "itsaplan": {
      "httpUrl": "http://localhost:3000/mcp",
      "headers": { "Authorization": "Bearer $ITSAPLAN_API_KEY" },
      "trust": true
    }
  }
}
```

`itsaplan-runner.json`:

```json
{
  "url": "http://localhost:3000",
  "apiKey": "the key you copied on creation",
  "command": "printf '%s\\n\\n%s' \"$ITSAPLAN_SYSTEM_PROMPT\" \"$(cat)\" | gemini --approval-mode yolo",
  "cwd": "/path/to/working-dir"
}
```

- Gemini has no system-prompt flag either, and reads the piped prompt on stdin, so the
  command is shaped like the Codex one.
- `--approval-mode yolo` approves every tool call, which a headless run needs.
  `auto_edit` is the narrower option: file edits only.

## GitHub Copilot CLI

`.mcp.json` in the working directory. Copilot's headers take no variable
interpolation, so the key goes in as it stands:

```json
{
  "mcpServers": {
    "itsaplan": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": { "Authorization": "Bearer the-agent-key" },
      "tools": ["*"]
    }
  }
}
```

`itsaplan-runner.json`:

```json
{
  "url": "http://localhost:3000",
  "apiKey": "the key you copied on creation",
  "command": "copilot -p \"$(printf '%s\\n\\n%s' \"$ITSAPLAN_SYSTEM_PROMPT\" \"$(cat)\")\" --allow-all-tools --no-ask-user",
  "cwd": "/path/to/working-dir"
}
```

- Copilot takes neither a system-prompt flag nor a prompt on stdin, so both go in as
  one `-p` argument.
- `--allow-all-tools` and `--no-ask-user` keep it from waiting for an approval it
  cannot get.

## opencode

`opencode.json` in the working directory. opencode interpolates `{env:VAR}`, so the key
stays out of the file:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-5",
  "mcp": {
    "itsaplan": {
      "type": "remote",
      "url": "http://localhost:3000/mcp",
      "enabled": true,
      "headers": { "Authorization": "Bearer {env:ITSAPLAN_API_KEY}" }
    }
  }
}
```

`itsaplan-runner.json`:

```json
{
  "url": "http://localhost:3000",
  "apiKey": "the key you copied on creation",
  "command": "opencode run \"$(printf '%s\\n\\n%s' \"$ITSAPLAN_SYSTEM_PROMPT\" \"$(cat)\")\"",
  "cwd": "/path/to/working-dir"
}
```

- `opencode run` takes the prompt as an argument and never reads stdin, so the task is
  passed the same way as with Copilot.
- Pin `model` as `provider/model`. opencode is provider agnostic, and without that key
  a run falls back to whatever model was picked interactively last. `opencode auth
  login` is what makes a provider available in the first place.

## Requirements

Node 20 or newer, an It's a Plan instance on 0.10.0 or newer, and an **external** agent in
your project. Its API key is what the runner authenticates with.

The coding agent you point the runner at has to be installed and signed in on the same
machine — the runner starts it as you and cannot sign in for you.

On macOS and Linux there is nothing else to it. The runner hands every task to `sh -c`,
so the commands in this file are POSIX shell.

Windows needs WSL2, because `cmd.exe` and PowerShell have no `sh`:

```powershell
wsl --install     # installs Ubuntu, then reboot
```

Everything after that happens inside WSL: Node, the coding agent, the config file, and
`npx -y @itsaplan/runner`. Two things worth knowing there:

- Keep the working directory in the WSL file system (`~/work/repo`) rather than under
  `/mnt/c/...`. File access across that boundary is slow enough to notice on a repo.
- An instance running on the Windows host is reachable from WSL2 as
  `http://localhost:3000`.

## License

Copyright © 2026 VIBE DEV SPACE LLC.

[Apache-2.0](LICENSE).
