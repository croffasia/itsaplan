# The Procore import source

How the Procore source plugs into the pipeline in [plane-import.md](plane-import.md). The user
guide is [importing-from-procore.md](../importing-from-procore.md).

## Shape

- `apps/worker/src/procore-mapping.ts` — pure mapping: punch items, RFIs, RFI answers,
  attachments, states, paging.
- `apps/worker/src/procore-adapter.ts` — `ProcoreReader`: token, requests, rate limit.
- `apps/worker/src/import-sources.ts` — the `procore` entry: credential
  `{ clientId, clientSecret, companyId, sandbox? }`, config
  `{ procoreProjectId, procoreTool: 'punch_items' | 'rfis' }`, no Rewrite prefix.
- `apps/api/src/modules/import-export/procore.ts` — connection check, state preview, job fields.

One job imports one tool of one project. Both ids are numeric; the api refuses anything else.

## Hosts and authentication

The hosts are fixed, so no user-supplied URL is saved or fetched. Every request goes through
`pinnedFetch`.

| | Production | Sandbox |
|---|---|---|
| API | `https://api.procore.com` | `https://sandbox.procore.com` |
| Login | `https://login.procore.com` | `https://login-sandbox.procore.com` |

The credential is that of a Developer Managed Service Account, using the OAuth 2.0 client
credentials grant:

```
POST {login}/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&client_id=…&client_secret=…
```

The response carries `access_token` and `expires_in` (5400 seconds in Procore's example). The
reader keeps the token until one minute before it expires, and requests a new one after a
401 once. Every API request sends `Authorization: Bearer <token>` and
`Procore-Company-Id: <companyId>`.

## Requests

| Reader method | Tool | Request |
|---|---|---|
| `listIssues` | punch items | `GET /rest/v1.0/punch_items?project_id={id}&page=&per_page=100` |
| `listIssues` | RFIs | `GET /rest/v1.0/projects/{id}/rfis?page=&per_page=100` |
| `getIssue`, comments, attachments | punch items | `GET /rest/v1.0/punch_items/{item}?project_id={id}`, cached per reader |
| `getIssue`, comments, attachments | RFIs | `GET /rest/v1.0/projects/{id}/rfis/{rfi}`, cached per reader |
| `resolveAttachmentDownload` | both | the attachment's `url`, refetched from the item |
| `listStates` | both | none; a fixed list per tool |
| `listLabels`, `listCycles`, `listIssueRelations` | both | none; always empty |

The api connection check lists `GET /rest/v1.0/projects?company_id={companyId}` page by page
(100 per page, at most 50 pages). The preview reads one item of the tool, so a project or tool
the account cannot read fails there.

## Paging

`page` and `per_page` (100). The Page cursor is the next page number as a string. The next page
exists when `page × Per-Page < Total`, using the `Total` and `Per-Page` response headers. When
`Total` is absent, a full page means there may be another and a shorter one is the last.

## Rate limits

A 429 becomes `SourceRateLimitedError`. The wait is `Retry-After` seconds; without it,
`X-Rate-Limit-Reset` (read as seconds until the reset, or as a Unix time when the number is
above 10^9); without both, 60 seconds. The job does not count the wait as an attempt.

## Attachments

The download starts at the attachment URL, resolved against the API host when relative. The
bearer token and company header are sent only to a host that is `procore.com` or a subdomain of
it, on every redirect hop. Procore's redirect to file storage (a different domain) is followed
without them.

## Mapping

- Title: punch item `name`, RFI `subject`.
- Description: HTML is reduced to text. An RFI's description is followed by its question
  text, then the `Imported from Procore: …` footer.
- State id: the status lower-cased with spaces as `-` (`ready-for-review`). The same function
  is repeated in the api for the preview, because `stateOverrides` is keyed by it.
- Assignee: the first punch item assignment (then the punch item manager) or the first RFI
  assignee whose `login`, `email` or `email_address` contains `@`.
- Priority: names containing urgent/critical/emergency, high, medium/normal, low; others are
  dropped.
- Issue number: punch item `position`, RFI `number`, otherwise the id.
- Comments: RFI `responses`, oldest first; the author is matched by login email.

## Unverified

The Procore developer reference at developers.procore.com is rendered client-side and could not
be read when this source was written, and the app had no Procore account to call. These points
come from Procore's published guides and search summaries, or are assumptions, and need a check
against a sandbox company:

- The exact field names of the punch item and RFI payloads (`assignments`, `punch_item_manager`,
  `questions`, `responses`, `assignees`, `attachments[].url`, `priority`). The mapping reads
  every field except `id` defensively, so a missing field loses data without failing the job.
- Whether the list endpoints include answers and attachments; the reader reads them from the
  single-item endpoint.
- The status names of punch items and RFIs. Companies can configure them.
- The meaning of `X-Rate-Limit-Reset`.
- That `GET /rest/v1.0/punch_items` and `/rest/v1.0/projects/{id}/rfis` are the versions to use;
  Procore also publishes v1.1 and later variants of some resources.

## Sources

- Client credentials grant and `Procore-Company-Id`: https://developers.procore.com/documentation/oauth-client-credentials
- Developer Managed Service Accounts: https://developers.procore.com/documentation/developer-managed-service-accounts
- List punch items: https://developers.procore.com/reference/rest/v1/punch-items#list-punch-items
- List RFIs: `GET /rest/v1.0/projects/{project_id}/rfis` in https://developers.procore.com/reference/rest/rfis
