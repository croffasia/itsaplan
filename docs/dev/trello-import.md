# The Trello import source

How the Trello source plugs into the pipeline in [plane-import.md](plane-import.md). The user
guide is [importing-from-trello.md](../importing-from-trello.md).

## Shape

- `apps/worker/src/trello-mapping.ts` — pure mapping: lists, labels, cards with checklists and
  links, comments, uploads, paging.
- `apps/worker/src/trello-adapter.ts` — `TrelloReader`, the requests and rate limit.
- `apps/worker/src/import-sources.ts` — the `trello` entry: credential `{ apiKey, token }`,
  config `{ trelloBoardId }`, no Rewrite prefix.
- `apps/api/src/modules/import-export/trello.ts` — connection check, lists preview, job fields.

## Requests

All to the fixed `https://api.trello.com/1`, with
`Authorization: OAuth oauth_consumer_key="<key>", oauth_token="<token>"`. The header form is
used everywhere because attachment downloads accept no other, and it keeps the token out of
URLs. The api refuses a key or token with a quote, backslash or whitespace.

| Reader method | Request |
|---|---|
| `listStates` | `GET /boards/{id}/lists?filter=all` |
| `listLabels` | `GET /boards/{id}/labels?limit=1000` |
| `listCycles`, `listIssueRelations` | none; always empty |
| `listIssues` | `GET /boards/{id}/cards/all?limit=1000&before=…` with checklists and attachments |
| `getIssue` | `GET /cards/{id}` with checklists and attachments, cached per reader |
| `listIssueComments` | `GET /cards/{id}/actions?filter=commentCard&limit=1000`, paged by `before` |
| member emails | `GET /boards/{id}/members?fields=…,email`, once per reader |
| `resolveAttachmentDownload` | `GET /cards/{card}/attachments/{id}` for a fresh URL, then the download on `api.trello.com` |

Trello has no page cursor. A page holding exactly `limit` items is followed by a request
with `before=<oldest id on the page>`; ids are Mongo ObjectIds, so the oldest is the smallest
string. A shorter page is the last. This is the one source where completion is read from the
page size.

Trello's attachment URL is on `trello.com`, which refuses the header; the same path on
`api.trello.com` serves the file, so the host is switched. The header is sent to
`api.trello.com` only, never to where a redirect points.

## Rate limits

Trello allows 100 requests per 10 seconds per token. A 429 becomes `SourceRateLimitedError`,
waiting `Retry-After` seconds or 10 seconds.

## Mapping

- A card's creation date is the timestamp in the first 8 hex digits of its id.
- Assignee: the first card member whose email Trello returns. Trello returns the email only
  for the token's own member.
- List categories come from the name (`trelloListCategory`), repeated in the api for the
  preview.

## Sources

- Authorization header: https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization/
- Header required for downloads: https://community.developer.atlassian.com/t/update-authenticated-access-to-s3/43681
- Download host: https://community.n8n.io/t/download-trello-attachment/30401
