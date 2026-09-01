# Coding agent setup

[`@itsaplan/runner`](https://www.npmjs.com/package/@itsaplan/runner) runs an external agent
on your own machine. It has a preset for each of five coding agent CLIs. A preset builds
the command itself: the flags for an unattended run, and the session resume.

Each preset needs two files in the working directory:

- the CLI's own config, which points it at the MCP server of your instance,
- `itsaplan-runner.json`, which points the runner at your instance.

This page holds both files for each preset, and the notes that apply to that CLI. The
runner's own settings are in its
[README](https://github.com/croffasia/itsaplan/blob/main/packages/runner/README.md).

Enable MCP for the project first, in Settings, MCP Server. It is off by default.

## Claude Code

Claude Code reads `.mcp.json` from the working directory:

```json
{
  "mcpServers": {
    "itsaplan": {
      "type": "http",
      "url": "http://localhost:7002/mcp",
      "headers": { "Authorization": "Bearer ${ITSAPLAN_API_KEY}" }
    }
  }
}
```

`itsaplan-runner.json`:

```json
{
  "url": "http://localhost:7002",
  "apiKey": "the key you copied on creation",
  "agent": "claude",
  "cwd": "/Users/me/work/my-repo"
}
```

- Claude Code uses this server in addition to the servers that the machine already has.
  Your own MCP servers, skills and memory stay available in the run. For a file in a
  different location, set `"args": ["--mcp-config", "/path/to/mcp.json"]`.
- The preset passes `--permission-mode auto`. No person is available to approve an action.
  A classifier thus examines each action, MCP tool calls included. Repeat the flag in
  `args` to select a different mode.
- The preset also passes `--output-format stream-json --include-partial-messages`. This
  stream gives the chat answer word by word, and includes the tool calls.
  `--append-system-prompt` gives Claude Code the context of the run.

## Codex

Codex reads its MCP servers from `~/.codex/config.toml`. `bearer_token_env_var` takes the
key from the environment that the runner sets:

```toml
[mcp_servers.itsaplan]
url = "http://localhost:7002/mcp"
bearer_token_env_var = "ITSAPLAN_API_KEY"
```

`itsaplan-runner.json`:

```json
{
  "url": "http://localhost:7002",
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
      "serverUrl": "http://localhost:7002/mcp",
      "headers": { "Authorization": "Bearer the-agent-key" }
    }
  }
}
```

`itsaplan-runner.json`:

```json
{
  "url": "http://localhost:7002",
  "apiKey": "the key you copied on creation",
  "agent": "antigravity",
  "cwd": "/path/to/working-dir"
}
```

- The binary is `agy`. Sign in once by running it interactively.
- Antigravity CLI has no system-prompt flag, and it does not read stdin. The preset thus
  sends the context of the run and the task in one `-p` argument.
- The preset passes `--dangerously-skip-permissions`. Antigravity CLI then does not wait
  for an approval. Without the flag a denied tool call still exits `0`.
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
      "url": "http://localhost:7002/mcp",
      "headers": { "Authorization": "Bearer the-agent-key" },
      "tools": ["*"]
    }
  }
}
```

`itsaplan-runner.json`:

```json
{
  "url": "http://localhost:7002",
  "apiKey": "the key you copied on creation",
  "agent": "copilot",
  "cwd": "/path/to/working-dir",
  "args": ["--additional-mcp-config", "@.mcp.json"]
}
```

- Copilot CLI has no system-prompt flag, and it does not read stdin. The preset thus sends
  the context of the run and the task in one `-p` argument.
- The preset passes `--allow-all-tools` and `--no-ask-user`. Copilot CLI then does not
  wait for an approval. It still denies a path outside the working directory, and the run
  continues and exits `0`. Add `--add-dir` or `--allow-all-paths` to `args` for a task that
  needs one.
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
      "url": "http://localhost:7002/mcp",
      "enabled": true,
      "headers": { "Authorization": "Bearer {env:ITSAPLAN_API_KEY}" }
    }
  }
}
```

`itsaplan-runner.json`:

```json
{
  "url": "http://localhost:7002",
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
