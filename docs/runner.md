# Coding agent setup

[`@itsaplan/runner`](https://www.npmjs.com/package/@itsaplan/runner) runs an external agent
on your own machine. It has a preset for each of five coding agent CLIs. A preset builds
the command itself: the output format, the session resume, and, only when you ask for
it, the flag that skips the CLI's approvals.

Each preset needs two files in the working directory:

- the CLI's own config, which points it at the MCP server of your instance,
- `itsaplan-runner.json`, which points the runner at your instance.

This page holds both files for each preset, and the notes that apply to that CLI. The
runner's own settings are in its
[README](https://github.com/croffasia/itsaplan/blob/main/packages/runner/README.md).

Enable MCP for the project first, in Settings, MCP Server. It is off by default.

## Threat model

The task a run carries is text from the tracker: the comment that mentioned the agent,
the comments above it in the thread, an issue body, a schedule's prompt. Anyone who can
write a comment in the project writes part of what the coding agent reads, and the
coding agent runs on your machine, as you, with your files and your tools. The instance
marks that text as data in the prompt and tells the agent to read it as such, but a
model can still be talked into a command by the text it was asked to act on.

The CLI's approval gate is what stands between such text and your shell. No preset turns
it off: a tool call the CLI would ask a person about is denied, the run goes on with what
it could do, and the transcript in the run's output shows what was denied. Where the CLI
takes a narrower grant — `--allowedTools` for Claude Code, `--allow-tool` for Copilot
CLI, a sandbox for Codex — pass it in `args`.

`skipApprovals` opens the gate. Set it to `true` in `itsaplan-runner.json`, set
`ITSAPLAN_SKIP_APPROVALS=1`, or start the runner with `--skip-approvals`. The preset then
adds the CLI's own flag for it: `--permission-mode auto` for Claude Code,
`--dangerously-skip-permissions` for Antigravity CLI, `--allow-all-tools` for GitHub
Copilot CLI. Codex and opencode have no flag in the preset: `codex exec` already runs
inside its sandbox and asks nothing, and opencode takes its permissions from its own
config. Turn it on only where the machine is expendable:

- Run the runner in a container, a VM or a machine of its own, with a working directory
  that holds only the repository the agent works on. Do not run it on a workstation that
  holds your keys, your browser sessions or other projects.
- Give the command only the environment it needs. The runner starts the CLI with its own
  environment plus `env` from the config, so a shell with cloud credentials, tokens or
  SSH agents exported hands them all to the agent. Start the runner from a clean
  environment.
- The agent's API key is the agent's identity in the instance: it reaches everything the
  agent's role allows, in every project the agent is a member of. Give the agent the
  narrowest role that does its work, and one key per runner, so a key that leaks is
  revoked on its own.
- Keep MCP servers other than the instance's out of the run, unless the agent's task
  needs them. Every server is a tool the text can lead the agent to call.

## Claude Code

Claude Code reads `.mcp.json` from the working directory:

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
  "agent": "claude",
  "cwd": "/Users/me/work/my-repo"
}
```

- Claude Code uses this server in addition to the servers that the machine already has.
  Your own MCP servers, skills and memory stay available in the run. For a file in a
  different location, set `"args": ["--mcp-config", "/path/to/mcp.json"]`.
- Under `-p` Claude Code denies a tool call it would ask a person about, and the run goes
  on. `--allowedTools` in `args` grants the tools the task needs, MCP tool calls included.
  With `skipApprovals` the preset passes `--permission-mode auto`, and a classifier
  examines each action instead. A `--permission-mode` in `args` replaces it.
- The preset also passes `--output-format stream-json --include-partial-messages`. This
  stream gives the chat answer word by word, and includes the tool calls.
  `--append-system-prompt` gives Claude Code the context of the run.

## Codex

Codex reads its MCP servers from `~/.codex/config.toml`. `bearer_token_env_var` takes the
key from the environment that the runner sets:

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
  "agent": "codex",
  "cwd": "/path/to/working-dir",
  "args": ["--skip-git-repo-check"]
}
```

- Codex has no system-prompt flag. The preset puts the context of the run before the task.
  The preset sends both on stdin.
- The preset passes `-c sandbox_mode="workspace-write"`. Codex then writes only in the
  working directory. The preset uses a config override and not `--sandbox`, because
  `codex exec resume` does not accept that flag. `codex exec resume` runs each message
  after the first one. Each argument that you add must thus be applicable to `codex exec`
  and to `codex exec resume`.
- Add `--skip-git-repo-check` only if the working directory is not a git repository.

## Antigravity CLI

Antigravity CLI reads its MCP servers from `~/.gemini/config/mcp_config.json`, one file
per machine. Its headers take no variables, so you write the key in the file. A remote
server is named by `serverUrl`, not by `url` or `httpUrl`:

```json
{
  "mcpServers": {
    "itsaplan": {
      "serverUrl": "http://localhost:3000/mcp",
      "headers": { "Authorization": "Bearer the-agent-key" }
    }
  }
}
```

`itsaplan-runner.json`:

```json
{
  "url": "http://localhost:3000",
  "apiKey": "the key you copied on creation",
  "agent": "antigravity",
  "cwd": "/path/to/working-dir"
}
```

- The binary is `agy`. Sign in once by running it interactively.
- Antigravity CLI has no system-prompt flag, and it does not read stdin. The preset thus
  sends the context of the run and the task in one `-p` argument.
- A tool call Antigravity CLI would ask about is denied, and the run still exits `0`.
  With `skipApprovals` the preset passes `--dangerously-skip-permissions`, and every tool
  call runs.
- The preset passes `--output-format stream-json` and `--print-timeout 24h`. The stream
  gives the chat answer as it is written, includes the tool calls, and names the
  conversation that the session resume uses. The raised timeout leaves `timeoutMs` to end
  a long task.
- One MCP config per machine means one key. `apiKeys` and `agents` still run several
  agents, but they all reach the instance as the agent whose key is in that file.

## GitHub Copilot CLI

GitHub Copilot CLI reads `.mcp.json` from the working directory, but only once you have
trusted that directory interactively. `--additional-mcp-config` loads the same file
without that step, which is what the runner config below passes. Its headers accept no
variables. You thus write the key in the file:

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
  "agent": "copilot",
  "cwd": "/path/to/working-dir",
  "args": ["--additional-mcp-config", "@.mcp.json"]
}
```

- Copilot CLI has no system-prompt flag, and it does not read stdin. The preset thus sends
  the context of the run and the task in one `-p` argument.
- The preset passes `--no-ask-user`, which turns off the tool that would wait for a
  person's answer. A tool call Copilot CLI would ask about is denied, and the run
  continues and exits `0`; `--allow-tool` in `args` grants the ones the task needs. With
  `skipApprovals` the preset passes `--allow-all-tools`. Copilot CLI still denies a path
  outside the working directory either way. Add `--add-dir` or `--allow-all-paths` to
  `args` for a task that needs one.
- The preset passes `--output-format json`. This stream gives the chat answer as it is
  written, and includes the tool calls. Its last line names the session, which
  `--session-id` resumes.

## opencode

opencode reads `opencode.json` from the working directory. It expands `{env:VAR}`. The key
thus stays out of the file:

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
  "agent": "opencode",
  "cwd": "/path/to/working-dir"
}
```

- `opencode run` takes the prompt as an argument and does not read stdin. The preset thus
  sends the context of the run and the task in one argument.
- Set `model` as `provider/model`. opencode supports many providers. Without this key, a
  run uses the model of the last interactive session. Run `opencode auth login` to make a
  provider available.
