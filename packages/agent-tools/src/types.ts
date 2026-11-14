import type { z } from 'zod';

// An integration is an external service the app ships code for (Jina, Firecrawl,
// Telegram). It owns a credential (the shared secret its tools authenticate with)
// and exposes one or more tools. The split of the model:
//
//   - credentialSchema — the fields a human configures once per credential (the
//     secret, e.g. a Jina apiKey or a Telegram botToken, plus any non-secret
//     connection setting). A project can hold several credentials per integration.
//   - tools — each tool declares only what the model provides at call time
//     (inputSchema) and how to run it (execute); the credential is passed in.
//
// A configured tool binds one tool to one credential, so different tools of the same
// integration can use different credentials (e.g. two Jina keys). An integration with an
// empty credentialSchema needs no account with an external service (PDF), and its
// configured tools are bound to no credential.

// A field of an integration's credential form. `type` "secret" marks a value stored
// encrypted and masked in the redacted view; other types are stored in plaintext.
export type ConfigFieldType = 'string' | 'secret' | 'url' | 'number' | 'boolean';

export interface ConfigField {
  key: string;
  label: string;
  type: ConfigFieldType;
  required: boolean;
  placeholder?: string;
  // Markdown, shown behind a "?" by the field's label.
  help?: string;
}

// A resolved credential: the decrypted field values keyed by field key.
export type ToolConfig = Record<string, string | number | boolean>;

// Parsed JSON body from a Graph-family API call (Instagram, Threads). Field shapes
// vary per endpoint, so only the envelope fields the shared client inspects are
// typed; endpoint-specific fields are read by the individual tools off the index
// signature.
export interface GraphApiResponse {
  id?: string;
  error?: { message?: string; error_user_msg?: string };
  [key: string]: unknown;
}

export interface CustomToolEntry {
  key: string;
  label: string;
  // Shown in the catalog and given to the model as the tool description.
  description: string;
  // The OAuth scopes/permissions the credential's access token must carry for this
  // tool to work, e.g. ["threads_basic", "threads_content_publish"]. Shown in the tool
  // catalog UI so a human knows what the token needs. Omit for tools with no scope
  // requirement (e.g. an API-key integration).
  scopes?: string[];
  // The section the tool is listed under in its integration's catalog. Tools without
  // one are listed first, under no heading.
  group?: string;
  // What the model passes at call time.
  inputSchema: z.ZodTypeAny;
  // Runs the tool with the integration's decrypted credential and the model input.
  execute: (credential: ToolConfig, input: Record<string, unknown>) => Promise<unknown>;
}

// What the service said about a credential. "rejected" is a clear refusal of the secret.
// "unavailable" is a check that got no clear answer: an outage, a timeout, a bot wall.
// "unknown" is a credential that cannot be checked from here: the service has no such
// request, or its address is one the SSRF guard keeps the api from.
export type CredentialCheck = 'valid' | 'rejected' | 'unavailable' | 'unknown';

// A brand mark drawn in a 24×24 box: one SVG path and the color it is filled with. A
// mark left without a color takes the text color, which keeps a black mark visible in
// the dark theme.
export interface IntegrationIcon {
  path: string;
  color?: string;
}

export interface Integration {
  key: string;
  label: string;
  // The interface shows the label's first letters when it is left out.
  icon?: IntegrationIcon;
  // The service's homepage, linked from the interface.
  website?: string;
  credentialSchema: ConfigField[];
  // Its tools also run with no credential, on the service's keyless tier.
  credentialOptional?: boolean;
  tools: CustomToolEntry[];
  // Asks the service whether it accepts the credential, with one request that spends
  // nothing. Left out when the service offers no such request.
  verify?: (credential: ToolConfig, signal: AbortSignal) => Promise<CredentialCheck>;
}

// The serializable form of a tool, returned in an integration descriptor.
export interface ToolDescriptor {
  key: string;
  label: string;
  description: string;
  // The scopes/permissions the token needs for this tool (see CustomToolEntry.scopes).
  scopes?: string[];
  group?: string;
}

// The serializable form of an integration, returned by the API catalog endpoint so a
// frontend can render the credential form and the tool list.
export interface IntegrationDescriptor {
  key: string;
  label: string;
  icon?: IntegrationIcon;
  website?: string;
  credentialSchema: ConfigField[];
  credentialOptional?: boolean;
  tools: ToolDescriptor[];
}
