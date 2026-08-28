import { SCIM_BASE_URL } from './resource';

// The discovery documents of RFC 7643 §6. A provisioning client reads these before
// its first sync to learn what the server supports, so they describe what is
// actually implemented — filtering is `eq` only, and nothing is sorted or bulked.

const MAX_FILTER_RESULTS = 200;

export const SERVICE_PROVIDER_CONFIG = {
  schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
  documentationUri: 'https://datatracker.ietf.org/doc/html/rfc7644',
  patch: { supported: true },
  bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
  filter: { supported: true, maxResults: MAX_FILTER_RESULTS },
  changePassword: { supported: false },
  sort: { supported: false },
  etag: { supported: false },
  authenticationSchemes: [
    {
      type: 'oauthbearertoken',
      name: 'OAuth Bearer Token',
      description: 'Authentication with the instance SCIM token, generated in god mode.',
      specUri: 'https://datatracker.ietf.org/doc/html/rfc6750',
      primary: true,
    },
  ],
  meta: {
    resourceType: 'ServiceProviderConfig',
    location: `${SCIM_BASE_URL}/ServiceProviderConfig`,
  },
};

export const RESOURCE_TYPES = [
  {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
    id: 'User',
    name: 'User',
    endpoint: '/Users',
    description: 'An account on this instance.',
    schema: 'urn:ietf:params:scim:schemas:core:2.0:User',
    schemaExtensions: [],
    meta: { resourceType: 'ResourceType', location: `${SCIM_BASE_URL}/ResourceTypes/User` },
  },
  {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
    id: 'Group',
    name: 'Group',
    endpoint: '/Groups',
    description: 'A group of accounts. What it grants is configured in god mode.',
    schema: 'urn:ietf:params:scim:schemas:core:2.0:Group',
    schemaExtensions: [],
    meta: { resourceType: 'ResourceType', location: `${SCIM_BASE_URL}/ResourceTypes/Group` },
  },
];

function attribute(options: {
  name: string;
  type?: string;
  multiValued?: boolean;
  required?: boolean;
  uniqueness?: string;
  mutability?: string;
  subAttributes?: unknown[];
}) {
  return {
    name: options.name,
    type: options.type ?? 'string',
    multiValued: options.multiValued ?? false,
    required: options.required ?? false,
    caseExact: false,
    mutability: options.mutability ?? 'readWrite',
    returned: 'default',
    uniqueness: options.uniqueness ?? 'none',
    ...(options.subAttributes ? { subAttributes: options.subAttributes } : {}),
  };
}

export const SCHEMAS = [
  {
    id: 'urn:ietf:params:scim:schemas:core:2.0:User',
    name: 'User',
    description: 'An account on this instance.',
    attributes: [
      attribute({ name: 'userName', required: true, uniqueness: 'server' }),
      attribute({
        name: 'name',
        type: 'complex',
        subAttributes: [
          attribute({ name: 'formatted' }),
          attribute({ name: 'givenName' }),
          attribute({ name: 'familyName' }),
        ],
      }),
      attribute({ name: 'displayName' }),
      attribute({
        name: 'emails',
        type: 'complex',
        multiValued: true,
        subAttributes: [
          attribute({ name: 'value' }),
          attribute({ name: 'type' }),
          attribute({ name: 'primary', type: 'boolean' }),
        ],
      }),
      attribute({ name: 'active', type: 'boolean' }),
    ],
    meta: {
      resourceType: 'Schema',
      location: `${SCIM_BASE_URL}/Schemas/urn:ietf:params:scim:schemas:core:2.0:User`,
    },
  },
  {
    id: 'urn:ietf:params:scim:schemas:core:2.0:Group',
    name: 'Group',
    description: 'A group of accounts. What it grants is configured in god mode.',
    attributes: [
      attribute({ name: 'displayName', required: true, uniqueness: 'server' }),
      attribute({
        name: 'members',
        type: 'complex',
        multiValued: true,
        subAttributes: [attribute({ name: 'value' }), attribute({ name: 'display' })],
      }),
    ],
    meta: {
      resourceType: 'Schema',
      location: `${SCIM_BASE_URL}/Schemas/urn:ietf:params:scim:schemas:core:2.0:Group`,
    },
  },
];
