# @repo/agent-tools

Custom tools for AI agents: external services (Jina, Firecrawl, Telegram) an agent
can call at runtime. Each service is an _integration_ that owns a credential and
exposes one or more _tools_.

## Model

- **Integration**: an external service. Holds a `credentialSchema` (the fields a
  human fills once per credential, such as an API key) and a list of tools.
- **Tool**: one callable action. Declares an `inputSchema` (what the model passes at
  call time) and an `execute` that runs it with the decrypted credential.

A team can store several credentials per integration, and a configured tool binds
one tool to one credential. That way two Jina keys can back two copies of the same
tool.

## Add a tool to an existing integration

You only touch that integration's folder.

1. Create `src/tools/<integration>/<action>.ts`:

   ```ts
   import { z } from "zod";
   import { pinnedFetch } from "@repo/net";
   import type { CustomToolEntry } from "../../types";
   import { jsonOrThrow } from "../../http";

   export const telegramFoo: CustomToolEntry = {
     key: "telegram_foo",          // unique across ALL integrations
     label: "Telegram Foo",
     description: "What the tool does. Passed to the model verbatim.",
     inputSchema: z.object({
       text: z.string().min(1).describe("Field docs help the model."),
     }),
     execute: async (credential, input) => {
       const res = await pinnedFetch("https://api.telegram.org/...", { ... });
       return await jsonOrThrow(res, "Telegram foo");
     },
   };
   ```

2. Add it to the `tools` array in `src/tools/<integration>/index.ts`.

That's it. The registry indexes it, the API catalog exposes it, and the runtime
resolves it.

## Add a new integration

1. Create `src/tools/<name>/`:
   - one file per tool (`CustomToolEntry`, as above);
   - `index.ts` exporting the `Integration`:

     ```ts
     import type { Integration } from '../../types';
     import { myToolA } from './a';

     export const myService: Integration = {
       key: 'my_service',
       label: 'My Service',
       credentialSchema: [{ key: 'apiKey', label: 'API key', type: 'secret', required: true }],
       tools: [myToolA],
     };
     ```

2. Register it in `src/registry.ts`. This is the one manual step: import the
   integration and add it to the `INTEGRATIONS` array.

Everything downstream reads from that array: the tool index, the
`integrationDescriptors()` catalog for the UI, and `coerceConfig`/`redactConfig`. No
other file needs editing.

## Rules

- **A tool `key` is unique across all integrations.** The tool index is a flat map by
  key; a duplicate throws when `registry.ts` loads.
- **Mark secrets `type: "secret"`** in `credentialSchema`. Non-secret fields are
  stored in plaintext and shown unredacted in the list UI.
- **Throw a clear `Error` on failure.** The runtime catches it and returns
  `{ error: message }` to the model instead of aborting the run, so that message is
  the model's only signal. Use `jsonOrThrow` from `http.ts` for fetch calls.
- **`execute` receives the decrypted credential**, keyed by `credentialSchema` field
  key. Read config values off it; the model never sees the secret.

## Config field types

`string`, `secret`, `url`, `number`, `boolean`. `coerceConfig` validates and coerces
submitted values against the schema; a missing required field returns a 400.

A `url` field is the address a tool sends its secret to, so it is checked against the
`@repo/net` rules when stored: https only, no private or local host unless
`SSRF_ALLOWED_HOSTS` names it, no userinfo, query string or fragment. The stored value
is the origin plus path with no trailing slash, so a path prefix such as `/v1` or a
Gitea under a sub-path is kept.

Every outbound call in this package goes through `pinnedFetch` from `@repo/net` rather
than global `fetch`. It vets the URL, connects to the address that check resolved, and
returns a 3xx instead of following it, so a credential is never sent to a host the
check did not clear. That matters most for a `url` field, whose value is operator
input; `tools/gitea/client.ts` is the example.
