# The Trello import source

How the Trello source plugs into the import pipeline described in
[plane-import.md](plane-import.md). The phases, resumability, de-duplication and rate-limit
handling are the same for every source; this file covers what is specific to Trello. The user
guide is [importing-from-trello.md](../importing-from-trello.md).

## Shape

- `apps/worker/src/trello-mapping.ts` — pure mapping from Trello's REST shapes to the canonical
  ones (lists, labels, custom fields, cards, checklists, comments, uploads), unit-tested
  directly.
- `apps/worker/src/trello-adapter.ts` — `TrelloReader`, the `SourceReader` for Trello: the
  requests, paging, the rate-limit check, and the upload download.
- `apps/worker/src/import-sources.ts` — the `trello` entry: credential `{ apiKey, token }`,
  config `{ boardId, archivedCards: 'archive' | 'skip', memberEmails? }`, and no Rewrite
  prefix.
- `apps/api/src/modules/import-export/trello.ts` — the key and token check (the boards they
  see), the board preview (open lists and members), and the Trello fields of
  `POST /import-jobs` (`source: 'trello'`).
- `apps/web/src/features/settings/components/import-export/SettingsImportExportTrello*.tsx` —
  the Trello tab; the mapping review is shared with Plane and Linear.

## Authorization

The user enters an API key of their own Power-Up, and `useTrelloAuthorize` opens Trello's
`/1/authorize` page for it in a popup with `scope=read`, `expiration=30days`,
`callback_method=postMessage` and `return_url` set to the web origin. Trello posts the token to
the opener, and the hook accepts a message only from `https://trello.com` and from that popup.
Trello sends it only when the web origin is in the key's allowed origins, so the form shows the
origin to add. No instance setting is involved: the key and the token reach the api only with
the test, the preview and the job, and the job stores them encrypted until it ends.

## What Trello adds to the pipeline

Trello is the first source with checklists and custom fields, so the pipeline has them for
every source:

- `SourceReader.listCustomFields()` is read in Discover with the states, labels and cycles.
  Create makes each field (`createLocalCustomFieldAndRecord`) before the issues and records it
  as `custom_field` in `import_record`. `CanonicalIssue.customFields` carries the values, which
  Create writes with `setIssueCustomFieldValue`.
- `SourceReader.listIssueChecklists(issue)` is read per issue in Create. Each checklist is
  written with its items in one transaction and recorded as `checklist`.
- `CanonicalIssue.watcherEmails` adds watchers, matched by email like the assignee.
- `CanonicalIssue.archivedAt` creates the issue archived.

Plane and Linear return no checklists, no custom fields, no watchers and no archive time.

## Requests

Every request goes to the fixed `https://api.trello.com/1` through `pinnedFetch`, with
`Authorization: OAuth oauth_consumer_key="<key>", oauth_token="<token>"`. The api accepts a key,
a token and a board id made of letters and digits only, so neither can break out of the quoted
header or the URL path. No user-supplied URL is fetched, except the upload URL Trello gives for
an attachment; see Uploads.

| Reader method          | Request                                                                       |
| ---------------------- | ----------------------------------------------------------------------------- |
| `listStates`           | `GET /boards/{id}/lists?filter=all`; the open lists become states             |
| `listLabels`           | `GET /boards/{id}/labels?limit=1000`                                          |
| `listCustomFields`     | `GET /boards/{id}/customFields`                                               |
| `listIssues`           | `GET /boards/{id}/cards?filter=open\|all`, with attachments and field values  |
| `getIssue`             | `GET /cards/{id}`, with attachments, checklists and field values              |
| `listIssueRelations`   | the card, then `GET /cards/{shortLink}?fields=idBoard` per linked card        |
| `listIssueComments`    | `GET /cards/{id}/actions?filter=commentCard&limit=1000`                       |
| `listIssueAttachments` | the card's attachments with `isUpload` set                                    |
| `listIssueChecklists`  | the card's checklists                                                         |

Trello returns at most 1000 cards or actions in one request and pages them by creation date:
the next page is read with `before` set to the oldest id of the page, until a page holds fewer
than 1000. `listIssues` reads every page in one call and returns them as one page, sorted by
list position and then card position, so Create makes the issues of each column in Trello's
order. A reader lives for one tick and reads the lists, the custom fields and each card once.

## Scope

`archivedCards: 'skip'` reads `filter=open` and also drops the cards of an archived list.
`'archive'` reads `filter=all`; a card that is archived, or that sits in an archived list, gets
`archivedAt` set to its `dateLastActivity`. Only open lists become states, so the card of an
archived list goes to the project's first column.

## People

Trello does not return a member's email, except the token owner's own with the `account`
scope. The review step lists the board's members, and the user matches each one with a project
member by hand or skips the matching. The api turns `memberMap` (Trello member id → user id)
into `config.memberEmails` (Trello member id → that member's email) and refuses a user who is
not a member of the project. The reader then sets `assigneeEmail` to the first matched member
of a card, `watcherEmails` to the other matched members, and a comment's `authorEmail` to its
matched author, so the worker matches people by email as it does for every source.

## Rate limits

Trello allows 100 requests per 10 seconds for each token and 300 for each key, and answers a
request over the limit with HTTP 429. Any 429 becomes `SourceRateLimitedError` with a 10-second
wait. The worker reschedules the job, and a rate limit never fails it.

## Text

- The description gets, in order: the card's Markdown, a `## Links` list of the link
  attachments, and `Imported from Trello: <short URL>` last.
- A Trello card has no key-style identifier, so the Rewrite phase does nothing for a Trello
  job. A link to another card stays a link to Trello.

## Relations

A link attachment whose URL is `https://trello.com/c/<shortLink>` points to another card.
`listIssueRelations` reads that card by its short link (Trello accepts a short link in place of
an id) and returns a `relates` relation when it is on the same board. A card that is deleted or
that the token cannot see, or whose short link is malformed (400, 401, 403, 404), is not
linked.

## Uploads

An upload's URL is on `trello.com` and needs the key and token.
`resolveDownloadRedirects` (`attachment-download.ts`, shared with Linear) follows the redirect
to signed storage itself and sends the `Authorization` header only while the host is
`trello.com` or `api.trello.com` over https. Trello reports the size and type of an upload; when
the type is empty it comes from the file name.

## Labels

Trello names its label colors (`green`, `green_dark`). The color is stored as the hex value of
its base color, and a label with no name is named after its color.

## Custom fields

| Trello type | itsaplan type | Value read from                            |
| ----------- | ------------- | ------------------------------------------ |
| `text`      | `text`        | `value.text`                               |
| `number`    | `number`      | `value.number`                             |
| `checkbox`  | `boolean`     | `value.checked === 'true'`                 |
| `date`      | `datetime`    | `value.date`                               |
| `list`      | `select`      | the text of the option `idValue` names     |

A field of another type is not imported.
