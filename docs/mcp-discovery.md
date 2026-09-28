# Agent discovery over MCP

Connect Codex, Claude Code or another MCP client to `/mcp`. The default catalog contains workspace search, common reads, the image tools and three tool-discovery operations. Authentication and permissions are the same for every execution path.

## Find work

For a known identifier such as `PLAN-42`, call `get_issue_by_number` with `projectKey: "PLAN"` and `sequenceNumber: 42`. If several of your teams have a project with that key, pass its ref instead, for example `projectKey: "acme.PLAN"`.

For an unknown project, call `search_workspace`:

```json
{"q":"release readiness","kind":"all","pageSize":10}
```

Every search term must match the project or task. Exact keys and task identifiers rank first, followed by title and project-name matches, then description matches. Results contain project keys and refs, task ids and current states. Read the selected task with `get_issue`; read project configuration with `get_project` when a change needs column, type, label or member ids. `kind` accepts `projects`, `issues` or `all`. Optional `projectKey`, a key or a ref, and `teamId` narrow the search. Follow `page`, `pageSize` and `total` for more results. Personal project visibility preferences do not remove access. Membership, work-item permissions and team/project MCP switches do.

## Find and execute tools

Discover only the operation needed:

```json
{"query":"list documents","limit":3}
```

`discover_tools` returns matching names, descriptions, input/output schemas, annotations, permission requirements where declared, and `invokeWith`. Task and board terms also match issue and project operations. An exact tool name retrieves that operation first. `nextOffset` is available when further matches exist.

Use `call_read_tool` for reads:

```json
{"name":"list_documents","arguments":{"projectKey":"PLAN"}}
```

Use `call_tool` for an authorized change, supplying the discovered arguments. It is advertised as potentially destructive and non-idempotent because those properties depend on the selected operation. `call_read_tool` refuses mutations before execution. Both preserve the route's validation, membership, permissions, MCP switches and team resolution. Discovery does not grant permission to execute a tool.

`view_attachment`, `view_issue_images` and `view_initiative_images` return images as image content, which `call_read_tool` and `call_tool` cannot return. They are listed in every catalog, `discover_tools` gives their own name as `invokeWith`, and both executors refuse them.

Existing named tool calls remain accepted. Clients that need every operation listed can connect to `/mcp?catalog=full`; `tools/list` then returns every tool, as well as the three discovery operations.

## Documents

Document reads, revisions and mutation responses return Markdown `content` by default. Pass `includeContentJson: true` to include editor JSON. This option applies to external MCP and internal agent tools. REST responses retain the editor representation required by the web app.

Sending `content` without `contentJson` clears the stored editor JSON. Metadata edits preserve it. Explicit `contentJson` continues to control the editor representation.

Reconnect an existing MCP client to refresh its cached catalog. This server uses ordinary MCP tools and does not require a provider-specific deferred-tool extension.
