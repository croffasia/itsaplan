import { eq } from 'drizzle-orm';
import { rotateScimToken, setScimSettings } from '@repo/auth';
import { createWorkspace, db, team } from '@repo/db';
import { scimApi } from '#tests/helpers/app';
import { addUser, type Actor } from '#modules/god/__tests__/helpers';

// Turns SCIM provisioning of the instance workspace on and hands back a client that
// authenticates with the generated token, the way an identity provider does. `god`
// owns the workspace, and `settings` is its SCIM section.

export interface ScimSetup {
  god: Actor;
  workspaceId: number;
  settings: ReturnType<typeof workspaceScim>;
  token: string;
  scim: ReturnType<typeof scimApi>;
}

function workspaceScim(owner: Actor, workspaceId: number) {
  return owner.api.workspaces({ workspaceId }).scim;
}

export async function setupScim(): Promise<ScimSetup> {
  const god = await addUser({ name: 'Root', email: 'root@example.com' });
  const [workspace] = (await god.api.workspaces.get()).data!;
  const workspaceId = workspace!.id;
  const settings = workspaceScim(god, workspaceId);
  const created = await settings.token.post();
  const token = created.data!.token;
  await settings.patch({ enabled: true });
  return { god, workspaceId, settings, token, scim: scimApi(token) };
}

// A second workspace owned by `owner`, with provisioning on, holding `teamIds`. Its
// provisioning is set up directly, since through the api only the instance owner may.
export async function setupOtherWorkspace(
  owner: Actor,
  teamIds: number[] = [],
): Promise<Omit<ScimSetup, 'god'>> {
  const workspaceId = await createWorkspace(db, 'Other', owner.id);
  for (const teamId of teamIds) {
    await db.update(team).set({ workspaceId }).where(eq(team.id, teamId));
  }
  const token = await rotateScimToken(workspaceId);
  await setScimSettings(workspaceId, { enabled: true });
  return {
    workspaceId,
    settings: workspaceScim(owner, workspaceId),
    token,
    scim: scimApi(token),
  };
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
