import {
  db,
  aiAgent,
  scimGroup,
  scimGroupMapping,
  scimGroupMember,
  scimUser,
  team,
  teamMember,
  user,
  workspaceManager,
} from '@repo/db';
import { and, eq, exists, inArray, isNotNull, notExists, or, sql } from 'drizzle-orm';
import { generateUsername } from '@repo/auth';
import { iso } from '#shared/lib';
import { dropWorkspaceMemberships } from '#modules/teams/service';
import { ScimError, type ScimFilter, type ScimGroupRecord, type ScimUserRecord } from './resource';
import { isScimEmailAllowed } from './email-policy';
import { mappedProjectIds, reconcileProjects } from './reconcile';

// Data access for the SCIM endpoints. Every call acts for the one workspace the
// bearer token opened. An account is one `user` row across the instance, and the
// identity provider decides who has the workspace, not who has an account: what it
// says about a person — its own id for them and whether they are active — is kept
// per workspace in `scim_user`. Deactivating or deleting someone takes them out of
// the workspace's teams; their name, address and sign-in stay as they are.
//
// A create for an address that has no account inserts the `user` row directly rather
// than going through better-auth's sign-up — the same way an agent's bot user is
// written. That deliberately skips the instance registration gate, which is what
// makes a closed instance plus SSO a working combination.
//
// An AI agent's bot user is an account too, but it belongs to the project that
// created it, not to the identity provider: `notAnAgent` keeps every one of them out
// of /Users, so a sync cannot take an agent out of its team.

// What each resource can be filtered on. Advertised by ServiceProviderConfig and
// enforced by parseFilter, so the three never drift apart.
export const USER_FILTER_ATTRIBUTES = ['userName', 'externalId', 'emails.value'];
export const GROUP_FILTER_ATTRIBUTES = ['displayName', 'externalId'];

// True for every account that is not an AI agent's bot user. The same test the god
// user directory uses for its `human` filter.
const notAnAgent = notExists(
  db
    .select({ n: sql`1` })
    .from(aiAgent)
    .where(eq(aiAgent.userId, user.id)),
);

// The join of an account to what this workspace's provider says about it. Every user
// query here left-joins it: a person in the workspace's teams the provider never
// wrote has no row.
function linkOf(workspaceId: number) {
  return and(eq(scimUser.userId, user.id), eq(scimUser.workspaceId, workspaceId));
}

// The accounts a workspace's provider sees: the ones it wrote, and the people in the
// workspace's teams.
function inWorkspace(workspaceId: number) {
  return and(
    notAnAgent,
    or(
      isNotNull(scimUser.userId),
      exists(
        db
          .select({ n: sql`1` })
          .from(teamMember)
          .innerJoin(team, eq(team.id, teamMember.teamId))
          .where(and(eq(teamMember.userId, user.id), eq(team.workspaceId, workspaceId))),
      ),
    ),
  );
}

// The address is the identity a SCIM sync and an OIDC/password sign-up share, but
// the two paths do not agree on case: better-auth stores whatever case a sign-up or
// an OIDC profile carried, while a SCIM `userName` typically arrives lowercased from
// a directory. Matching case-sensitively would miss an account that predates the
// sync and provision a duplicate instead of linking it.
function emailEq(email: string) {
  return eq(sql`lower(${user.email})`, email.trim().toLowerCase());
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  active: boolean | null;
  externalId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function toUserRecord(row: UserRow): ScimUserRecord {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    // Null for a person the provider never wrote, who is active.
    active: row.active !== false,
    externalId: row.externalId,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

const userColumns = {
  id: user.id,
  email: user.email,
  name: user.name,
  active: scimUser.active,
  externalId: scimUser.externalId,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
};

// ── Users ─────────────────────────────────────────────────────────────────────

function userWhere(workspaceId: number, filter: ScimFilter | null) {
  if (!filter) return inWorkspace(workspaceId);
  if (filter.attribute === 'externalid') {
    return and(inWorkspace(workspaceId), eq(scimUser.externalId, filter.value));
  }
  return and(inWorkspace(workspaceId), emailEq(filter.value));
}

export async function listScimUsers(
  workspaceId: number,
  options: { filter: ScimFilter | null; startIndex: number; count: number },
): Promise<{ records: ScimUserRecord[]; total: number }> {
  const where = userWhere(workspaceId, options.filter);
  const [rows, totals] = await Promise.all([
    db
      .select(userColumns)
      .from(user)
      .leftJoin(scimUser, linkOf(workspaceId))
      .where(where)
      .orderBy(user.createdAt)
      .limit(options.count)
      .offset(options.startIndex - 1),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(user)
      .leftJoin(scimUser, linkOf(workspaceId))
      .where(where),
  ]);
  return { records: rows.map(toUserRecord), total: totals[0]?.count ?? 0 };
}

export async function getScimUser(workspaceId: number, id: string): Promise<ScimUserRecord | null> {
  const rows = await db
    .select(userColumns)
    .from(user)
    .leftJoin(scimUser, linkOf(workspaceId))
    .where(and(eq(user.id, id), inWorkspace(workspaceId)));
  return rows[0] ? toUserRecord(rows[0]) : null;
}

// The role is what grants god mode, and nothing about the instance owner's standing is
// the identity provider's to change.
function assertNotGod(role: string | null, action: string): void {
  if (role === 'god')
    throw new ScimError(409, `An instance owner cannot be ${action} through SCIM`);
}

// The workspace owner runs its SCIM provisioning and receives what a deprovisioned
// person owned alone, so the workspace's own provider cannot take it from them.
async function assertNotWorkspaceOwner(workspaceId: number, userId: string): Promise<void> {
  const [owner] = await db
    .select({ userId: workspaceManager.userId })
    .from(workspaceManager)
    .where(
      and(
        eq(workspaceManager.workspaceId, workspaceId),
        eq(workspaceManager.userId, userId),
        eq(workspaceManager.role, 'owner'),
      ),
    );
  if (owner) {
    throw new ScimError(409, 'The workspace owner cannot be deprovisioned through SCIM');
  }
}

export async function createScimUser(
  workspaceId: number,
  input: { email: string; name: string; active: boolean; externalId: string | null },
): Promise<ScimUserRecord> {
  const email = input.email.trim().toLowerCase();
  if (!(await isScimEmailAllowed(workspaceId, email))) {
    throw new ScimError(
      400,
      `The address '${input.email}' is not in a domain of this workspace`,
      'invalidValue',
    );
  }
  const [existing] = await db
    .select({ id: user.id, role: user.role, externalId: scimUser.externalId })
    .from(user)
    .leftJoin(scimUser, linkOf(workspaceId))
    .where(and(emailEq(email), notAnAgent));
  if (existing) {
    assertNotGod(existing.role, 'provisioned');
    // A second create for an address this provider already linked is a retry, not a
    // new person — Okta repeats a create after a timeout — and must not silently
    // overwrite what the first one wrote with whatever the retry happens to carry.
    if (existing.externalId) {
      throw new ScimError(
        409,
        `A user with userName '${input.email}' already exists`,
        'uniqueness',
      );
    }
    if (!input.active) await assertNotWorkspaceOwner(workspaceId, existing.id);
  }

  // An address with an account is that person: the provider links it rather than
  // creating a second one, and leaves its name and username as the person set them.
  const userId = await db.transaction(async (tx) => {
    let id = existing?.id;
    if (!id) {
      const [created] = await tx
        .insert(user)
        .values({
          id: crypto.randomUUID(),
          email,
          name: input.name,
          emailVerified: true,
          role: 'user',
          // The @mention handle, derived from the address the same way a sign-up
          // derives it. The identity provider does not supply one.
          username: await generateUsername(email),
        })
        .returning({ id: user.id });
      id = created!.id;
    }
    await tx
      .insert(scimUser)
      .values({ workspaceId, userId: id, externalId: input.externalId, active: input.active })
      .onConflictDoUpdate({
        target: [scimUser.workspaceId, scimUser.userId],
        set: { externalId: input.externalId, active: input.active },
      });
    return id;
  });
  if (input.active) await reconcileProjects(await groupProjectIds(workspaceId, userId));
  else await dropWorkspaceMemberships(workspaceId, userId);
  return (await getScimUser(workspaceId, userId))!;
}

// Writes what the provider says about a person: its id for them and whether they
// have the workspace. Their name and address are their own, so a PUT or PATCH that
// carries them leaves them as they are.
export async function updateScimUser(
  workspaceId: number,
  id: string,
  patch: { active?: boolean; externalId?: string | null },
): Promise<ScimUserRecord | null> {
  const [target] = await db
    .select({ role: user.role, active: scimUser.active })
    .from(user)
    .leftJoin(scimUser, linkOf(workspaceId))
    .where(and(eq(user.id, id), inWorkspace(workspaceId)));
  if (!target) return null;
  assertNotGod(target.role, 'updated');
  const wasActive = target.active !== false;
  const active = patch.active ?? wasActive;
  if (wasActive && !active) await assertNotWorkspaceOwner(workspaceId, id);

  await db
    .insert(scimUser)
    .values({ workspaceId, userId: id, externalId: patch.externalId ?? null, active })
    .onConflictDoUpdate({
      target: [scimUser.workspaceId, scimUser.userId],
      set: { active, ...(patch.externalId !== undefined ? { externalId: patch.externalId } : {}) },
    });
  if (wasActive && !active) await dropWorkspaceMemberships(workspaceId, id);
  // Back in the workspace: the groups they are still in grant their projects again.
  if (!wasActive && active) await reconcileProjects(await groupProjectIds(workspaceId, id));
  return getScimUser(workspaceId, id);
}

// The projects the workspace's groups grant this person.
async function groupProjectIds(workspaceId: number, userId: string): Promise<number[]> {
  const rows = await db
    .select({ projectId: scimGroupMapping.projectId })
    .from(scimGroupMapping)
    .innerJoin(scimGroupMember, eq(scimGroupMember.groupId, scimGroupMapping.groupId))
    .innerJoin(scimGroup, eq(scimGroup.id, scimGroupMapping.groupId))
    .where(and(eq(scimGroup.workspaceId, workspaceId), eq(scimGroupMember.userId, userId)));
  return rows.map((row) => row.projectId);
}

// Some identity providers embed group membership on the user instead of, or as well
// as, pushing separate Group resources — this is what makes a sync grant project
// access without the operator ever configuring a Group push. A named group that
// does not exist yet is created, the way a group pushed through POST /Groups would
// be; the user is added to each one, and every project already mapped to one of
// them is reconciled so membership takes effect immediately.
//
// Additive only: a name missing from a later sync is not removed here. Which
// provider is authoritative for a group is a per-workspace choice — a provider that
// also pushes Group resources removes a member through PATCH /Groups, and one that
// only ever embeds `groups` on the user never lists a name it wants revoked, so
// there is nothing to compare against without one of the two mechanisms winning
// over the other by accident.
export async function syncEmbeddedGroups(
  workspaceId: number,
  userId: string,
  displayNames: string[],
): Promise<void> {
  if (displayNames.length === 0) return;
  const groupIds: string[] = [];
  for (const displayName of displayNames) {
    const created = await db
      .insert(scimGroup)
      .values({ workspaceId, displayName })
      .onConflictDoNothing({ target: [scimGroup.workspaceId, scimGroup.displayName] })
      .returning({ id: scimGroup.id });
    if (created[0]) {
      groupIds.push(created[0].id);
      continue;
    }
    const existing = await db
      .select({ id: scimGroup.id })
      .from(scimGroup)
      .where(and(eq(scimGroup.workspaceId, workspaceId), eq(scimGroup.displayName, displayName)));
    groupIds.push(existing[0]!.id);
  }
  await db
    .insert(scimGroupMember)
    .values(groupIds.map((groupId) => ({ groupId, userId })))
    .onConflictDoNothing();
  const projectIds = (await Promise.all(groupIds.map(mappedProjectIds))).flat();
  await reconcileProjects(projectIds);
}

// Unlinks a person from the provider and takes them out of the workspace: its teams,
// its projects and its groups. The account stays.
export async function deleteScimUser(workspaceId: number, id: string): Promise<void> {
  const [target] = await db
    .select({ role: user.role })
    .from(user)
    .leftJoin(scimUser, linkOf(workspaceId))
    .where(and(eq(user.id, id), inWorkspace(workspaceId)));
  // An agent's bot user and an account outside the workspace are not part of its
  // SCIM user surface at all, so they answer the same way an unknown id does.
  if (!target) throw new ScimError(404, `User '${id}' not found`);
  assertNotGod(target.role, 'deleted');
  await assertNotWorkspaceOwner(workspaceId, id);

  await dropWorkspaceMemberships(workspaceId, id);
  await db.transaction(async (tx) => {
    await tx
      .delete(scimGroupMember)
      .where(
        and(
          eq(scimGroupMember.userId, id),
          inArray(
            scimGroupMember.groupId,
            tx
              .select({ id: scimGroup.id })
              .from(scimGroup)
              .where(eq(scimGroup.workspaceId, workspaceId)),
          ),
        ),
      );
    await tx
      .delete(scimUser)
      .where(and(eq(scimUser.workspaceId, workspaceId), eq(scimUser.userId, id)));
  });
}

// ── Groups ────────────────────────────────────────────────────────────────────

function groupWhere(workspaceId: number, filter: ScimFilter | null) {
  const inWorkspace = eq(scimGroup.workspaceId, workspaceId);
  if (!filter) return inWorkspace;
  if (filter.attribute === 'externalid') {
    return and(inWorkspace, eq(scimGroup.externalId, filter.value));
  }
  return and(inWorkspace, eq(scimGroup.displayName, filter.value));
}

// Refuses a member id that names no account the workspace's provider sees.
async function assertKnownMembers(workspaceId: number, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const known = await db
    .select({ id: user.id })
    .from(user)
    .leftJoin(scimUser, linkOf(workspaceId))
    .where(and(inArray(user.id, ids), inWorkspace(workspaceId)));
  const knownIds = new Set(known.map((row) => row.id));
  const missing = ids.filter((id) => !knownIds.has(id));
  if (missing.length > 0) {
    throw new ScimError(400, `Unknown member id(s): ${missing.join(', ')}`, 'invalidValue');
  }
}

async function loadMembers(
  groupIds: string[],
): Promise<Map<string, { userId: string; name: string }[]>> {
  const out = new Map<string, { userId: string; name: string }[]>();
  if (groupIds.length === 0) return out;
  const rows = await db
    .select({ groupId: scimGroupMember.groupId, userId: user.id, name: user.name })
    .from(scimGroupMember)
    .innerJoin(user, eq(user.id, scimGroupMember.userId))
    .where(inArray(scimGroupMember.groupId, groupIds))
    .orderBy(user.name);
  for (const row of rows) {
    const list = out.get(row.groupId) ?? [];
    list.push({ userId: row.userId, name: row.name });
    out.set(row.groupId, list);
  }
  return out;
}

async function toGroupRecords(
  rows: {
    id: string;
    displayName: string;
    externalId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }[],
): Promise<ScimGroupRecord[]> {
  const members = await loadMembers(rows.map((r) => r.id));
  return rows.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    externalId: row.externalId,
    members: members.get(row.id) ?? [],
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  }));
}

export async function listScimGroups(
  workspaceId: number,
  options: { filter: ScimFilter | null; startIndex: number; count: number },
): Promise<{ records: ScimGroupRecord[]; total: number }> {
  const where = groupWhere(workspaceId, options.filter);
  const [rows, totals] = await Promise.all([
    db
      .select()
      .from(scimGroup)
      .where(where)
      .orderBy(scimGroup.createdAt)
      .limit(options.count)
      .offset(options.startIndex - 1),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(scimGroup)
      .where(where),
  ]);
  return { records: await toGroupRecords(rows), total: totals[0]?.count ?? 0 };
}

export async function getScimGroup(
  workspaceId: number,
  id: string,
): Promise<ScimGroupRecord | null> {
  const rows = await db
    .select()
    .from(scimGroup)
    .where(and(eq(scimGroup.id, id), eq(scimGroup.workspaceId, workspaceId)));
  if (!rows[0]) return null;
  return (await toGroupRecords(rows))[0]!;
}

export async function createScimGroup(
  workspaceId: number,
  input: { displayName: string; externalId: string | null; members: string[] },
): Promise<ScimGroupRecord> {
  const members = [...new Set(input.members)];
  await assertKnownMembers(workspaceId, members);
  const created = await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: scimGroup.id })
      .from(scimGroup)
      .where(groupWhere(workspaceId, { attribute: 'displayname', value: input.displayName }));
    if (existing.length > 0) {
      throw new ScimError(409, `A group named '${input.displayName}' already exists`, 'uniqueness');
    }
    const rows = await tx
      .insert(scimGroup)
      .values({ workspaceId, displayName: input.displayName, externalId: input.externalId })
      .returning();
    const group = rows[0]!;
    if (members.length > 0) {
      await tx
        .insert(scimGroupMember)
        .values(members.map((userId) => ({ groupId: group.id, userId })));
    }
    return group;
  });
  await reconcileProjects(await mappedProjectIds(created.id));
  return (await getScimGroup(workspaceId, created.id))!;
}

export async function updateScimGroup(
  workspaceId: number,
  id: string,
  patch: { displayName?: string; externalId?: string | null; members?: string[] },
): Promise<ScimGroupRecord | null> {
  const members = patch.members ? [...new Set(patch.members)] : undefined;
  if (members) {
    // A member the group already holds can have left the workspace's teams since it
    // was added; refusing it would block every later change to the group.
    const held = await db
      .select({ userId: scimGroupMember.userId })
      .from(scimGroupMember)
      .where(eq(scimGroupMember.groupId, id));
    const heldIds = new Set(held.map((row) => row.userId));
    await assertKnownMembers(
      workspaceId,
      members.filter((userId) => !heldIds.has(userId)),
    );
  }
  const updated = await db.transaction(async (tx) => {
    const found = await tx
      .select({ id: scimGroup.id })
      .from(scimGroup)
      .where(and(eq(scimGroup.id, id), eq(scimGroup.workspaceId, workspaceId)));
    if (!found[0]) return false;
    if (patch.displayName) {
      const clash = await tx
        .select({ id: scimGroup.id })
        .from(scimGroup)
        .where(groupWhere(workspaceId, { attribute: 'displayname', value: patch.displayName }));
      if (clash[0] && clash[0].id !== id) {
        throw new ScimError(
          409,
          `A group named '${patch.displayName}' already exists`,
          'uniqueness',
        );
      }
    }
    await tx
      .update(scimGroup)
      .set({
        ...(patch.displayName ? { displayName: patch.displayName } : {}),
        ...(patch.externalId !== undefined ? { externalId: patch.externalId } : {}),
        updatedAt: new Date(),
      })
      .where(eq(scimGroup.id, id));
    if (members) {
      await tx.delete(scimGroupMember).where(eq(scimGroupMember.groupId, id));
      if (members.length > 0) {
        await tx.insert(scimGroupMember).values(members.map((userId) => ({ groupId: id, userId })));
      }
    }
    return true;
  });
  if (!updated) return null;
  await reconcileProjects(await mappedProjectIds(id));
  return getScimGroup(workspaceId, id);
}

export async function deleteScimGroup(workspaceId: number, id: string): Promise<boolean> {
  // Read the mappings before the cascade removes them, so the projects the group
  // granted membership in are reconciled after it is gone.
  const projects = await mappedProjectIds(id);
  const deleted = await db
    .delete(scimGroup)
    .where(and(eq(scimGroup.id, id), eq(scimGroup.workspaceId, workspaceId)))
    .returning({ id: scimGroup.id });
  if (deleted.length === 0) return false;
  await reconcileProjects(projects);
  return true;
}
