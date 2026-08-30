import { scimApi } from '#tests/helpers/app';
import { addUser, type Actor } from '#modules/god/__tests__/helpers';

// Turns SCIM provisioning on and hands back a client that authenticates with the
// generated token, the way an identity provider does.

export interface ScimSetup {
  god: Actor;
  token: string;
  scim: ReturnType<typeof scimApi>;
}

export async function setupScim(): Promise<ScimSetup> {
  const god = await addUser({ name: 'Root', email: 'root@example.com' });
  const created = await god.api.god['scim-settings'].token.post();
  const token = created.data!.token;
  await god.api.god['scim-settings'].put({ enabled: true });
  return { god, token, scim: scimApi(token) };
}

// `emails` follows `userName` by default, so overriding just `userName` in a test
// still produces a distinct, matching address — the api reads the account's email
// from `emails` first. Pass `emails` explicitly to test the two attributes
// disagreeing.
export function scimUserBody(overrides: Record<string, unknown> = {}) {
  const userName = (overrides.userName as string | undefined) ?? 'ada@example.com';
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    userName,
    name: { givenName: 'Ada', familyName: 'Lovelace' },
    emails: [{ value: userName, primary: true, type: 'work' }],
    active: true,
    ...overrides,
  };
}

export function patchOps(operations: Record<string, unknown>[]) {
  return {
    schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
    Operations: operations,
  };
}
