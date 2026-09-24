# MCP tool results

Every MCP tool result contains an object in `structuredContent`, except a successful call
of an image tool (see below). The existing text block
contains the original REST response body, including an empty string for HTTP 204. Existing
clients can continue reading that text. The internal agent runtime keeps its existing result
format.

## Attachment urls and images

The body is the REST body with one change: the path of an issue or initiative attachment,
whether the api's `/attachments/<id>/raw` or the web's `/media/attachments/<id>/raw`, is
written as a url on the public api origin (`API_URL`). The url is computed on each call and
is never stored. The arguments of a call get the web path back, so a description an
assistant writes keeps `/media/...`. A string argument that is only a url is passed as it
is. Document assets need a session and keep their paths.

`view_attachment` (one attachment, by its url or id), `view_issue_images` and
`view_initiative_images` return images as `image` content blocks: PNG, JPEG, GIF and
WebP, up to 5 MB each, 8 images and 10 MB per call. A text block comes first and names
the images in order, `{ images: [{ id, filename, contentType }], others: [...] }`, where
`others` holds every attachment left out, with its url. These three tools advertise no
`outputSchema` and a successful call has no `structuredContent`: Claude Code gives the
model `structuredContent` in place of the text block when it is present, which loses the
names and the urls of the attachments left out, and earlier versions dropped the images as
well. A failed call has the error envelope below.

A successful call returns:

```json
{
  "ok": true,
  "status": 200,
  "data": [{ "id": 12, "key": "ENG", "name": "Engineering" }]
}
```

`data` contains the JSON response, including arrays and primitive values. A non-JSON response
retains its text. HTTP 204 and empty responses without a declared string response use `null`.
Elysia sends numbers and booleans as plain text; a declared response schema lets the adapter
decode those values. A response schema allowing strings keeps non-JSON text as a string,
including values such as `"42"` or `"false"`.

A failed call sets `isError: true` and returns:

```json
{
  "ok": false,
  "status": 429,
  "error": {
    "code": "HTTP_429",
    "message": "Too many requests",
    "retryable": true,
    "retryAfterSeconds": 30
  }
}
```

- `status` is the REST HTTP status. Missing team arguments use 400; unknown tools use 404.
- `code` preserves a domain error code when the API supplies one. Otherwise it is `HTTP_`
  followed by the status number. Clients can branch on this code without parsing the message.
- `message` preserves the API's error message. Non-JSON failures use the HTTP status text
  or `HTTP <status>`.
- `details`, when present, contains additional fields from a JSON error response, such as
  validation information or conflict limits.
- `retryable` is true only for GET, HEAD, or OPTIONS calls returning 408, 429, 500, 502, 503,
  or 504. The adapter performs no retries. Mutations return false because a lost response
  can follow a completed write. Read the current state and reconcile it before repeating
  a mutation.
- `retryAfterSeconds` contains a valid `Retry-After` delay, including an HTTP date converted
  to a nonnegative number of seconds, or `null`. Other HTTP headers are never included.

Each tool advertises an `outputSchema` for this envelope. Declared REST success schemas
describe `data` for their corresponding HTTP statuses. The schema also permits the error
envelope, so SDK clients can validate failed calls. Undeclared statuses and unresolved or
runtime-only schemas use a permissive data schema. JSON Schema formats and runtime metadata
are omitted; the API remains responsible for validating its responses.

This uses the existing SDK's support for
[structured content and output schemas](https://modelcontextprotocol.io/specification/2025-06-18/server/tools#structured-content).
It does not change protocol negotiation or the SDK version.
