# MCP tool results

Every MCP tool result contains an object in `structuredContent`. The existing text block
contains the original REST response body, including an empty string for HTTP 204. Existing
clients can continue reading that text. The internal agent runtime keeps its existing result
format.

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
