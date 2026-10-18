# The Jira import source

How the Jira Cloud source plugs into the pipeline in [plane-import.md](plane-import.md). The
user guide is [importing-from-jira.md](../importing-from-jira.md).

## Shape

- `apps/worker/src/jira-mapping.ts` — pure mapping: ADF to Markdown, statuses, priorities,
  sprints, links, comments, attachments.
- `apps/worker/src/jira-adapter.ts` — `JiraReader`, the requests, paging and rate limit.
- `apps/worker/src/download-redirects.ts` — the redirect walk for attachment downloads,
  shared with Trello.
- `apps/worker/src/import-sources.ts` — the `jira` entry: credential
  `{ baseUrl, email, apiToken }`, config `{ jiraProjectKey }`, which is also the Rewrite prefix.
- `apps/api/src/modules/import-export/jira.ts` — connection check, statuses preview, job fields.

## Requests

Basic auth with `email:apiToken`, to `baseUrl` only. `baseUrl` must be an
`https://<site>.atlassian.net` origin, checked by the api and again by the reader.

| Reader method | Request |
|---|---|
| sprint field | `GET /rest/api/3/field`, the field whose schema is `com.pyxis.greenhopper.jira:gh-sprint`, once per reader |
| `listStates` | `GET /rest/api/3/project/{key}/statuses`, each status once |
| `listLabels` | `GET /rest/api/3/search/jql` over the project with `fields=labels`; Jira has no per-project label list |
| `listCycles` | the same search with the sprint field; sprints without dates are dropped |
| `listIssues` | `GET /rest/api/3/search/jql`, `project = "KEY" ORDER BY created ASC`, 100 per page |
| `getIssue` | `GET /rest/api/3/issue/{id}?fields=…`, cached per reader |
| `listIssueRelations` | the issue's `issuelinks`, outward side only |
| `listIssueComments` | `GET /rest/api/3/issue/{id}/comment`, paged by `startAt` until `total` |
| `listIssueAttachments` | the issue's `attachment` field |
| `resolveAttachmentDownload` | `GET /rest/api/3/attachment/content/{id}`, redirects followed by `resolveRedirects` |

`/search/jql` pages by `nextPageToken`. The walk stops on `isLast: true` or a missing token:
community reports describe `isLast` not being set reliably. The legacy `/rest/api/3/search`
was removed from Jira Cloud in 2025.

The `Authorization` header goes only to the site's host; the media host a download redirects
to gets no credential.

## Rate limits

A 429 becomes `SourceRateLimitedError`, waiting `Retry-After` seconds (one minute when absent,
at most one hour).

## Mapping

- Jira timestamps (`2024-01-05T10:00:00.000+0100`) get a colon in the offset to be ISO 8601.
- `sequenceId` is the number after the last `-` of the key.
- Sprint names are made distinct (`Sprint (2)`) because the store reuses a cycle by name.
- ADF: paragraphs, headings, lists, task lists, code blocks, quotes and panels, rules,
  tables, marks (strong, em, code, strike, link), mentions, emoji, cards, status and date.
  Media nodes are dropped from the text; the files arrive as attachments.

## Sources

- Jira Cloud REST v3 issue search: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/
- Removal of `/rest/api/3/search`: https://confluence.atlassian.com/jirakb/run-jql-search-query-using-jira-cloud-rest-api-1289424308.html
- `isLast` reports: https://community.atlassian.com/forums/Jira-questions/REST-The-new-rest-api-3-search-jql-endpoint-is-a-complete/qaq-p/3101716
