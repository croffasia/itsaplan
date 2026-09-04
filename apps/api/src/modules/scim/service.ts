import { db, aiAgent, projectMember, scimGroup, scimGroupMember, user } from '@repo/db';
import { and, eq, inArray, notExists, sql } from 'drizzle-orm';
import { generateUsername } from '@repo/auth';
import { iso } from '#shared/lib';
import { deleteInstanceUser } from '#modules/god/service';
import { countOwners } from '#modules/members/service';
import { ScimError, type ScimFilter, type ScimGroupRecord, type ScimUserRecord } from './resource';
import { mappedProjectIds, reconcileProjects } from './reconcile';

// Data access for the SCIM endpoints. The identity provider is the authority on
// who exists, so a create here inserts the `user` row directly rather than going
// through better-auth's sign-up — the same way an agent's bot user is written. That
// deliberately skips the instance registration gate, which is what makes a closed
// instance plus SSO a working combination.
//
// An AI agent's bot user is an account too, but it belongs to the project that
// created it, not to the identity provider: `notAnAgent` keeps every one of them out
// of /Users, so a sync cannot rename an agent or deactivate it (which would make the
// api refuse the agent's own API key and stop it without a trace).

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

// The address is the identity a SCIM sync and an OIDC/password sign-up share, but
// the two paths do not agree on case: better-auth stores whatever case a sign-up or
// an OIDC profile carried, while a SCIM `userName` typically arrives lowercased from
// a directory. Matching case-sensitively would miss an account that predates the
// sync and provision a duplicate instead of claiming it.
function emailEq(email: string) {
  return eq(sql`lower(${user.email})`, email.trim().toLowerCase());
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  active: boolean | null;
  scimExternalId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function toUserRecord(row: UserRow): ScimUserRecord {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    // Nullable for accounts that predate the column, which are active.
    active: row.active !== false,
    externalId: row.scimExternalId,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

const userColumns = {
  id: user.id,
  email: user.email,
  name: user.name,
  active: user.active,
  scimExternalId: user.scimExternalId,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
};

// ── Users ─────────────────────────────────────────────────────────────────────

function userWhere(filter: ScimFilter | null) {
  if (!filter) return notAnAgent;
  if (filter.attribute === 'externalid') {
    return and(notAnAgent, eq(user.scimExternalId, filter.value));
  }
  return and(notAnAgent, emailEq(filter.value));
}

export async function listScimUsers(options: {
  filter: ScimFilter | null;
  startIndex: number;
  count: number;
}): Promise<{ records: ScimUserRecord[]; total: number }> {
  const where = userWhere(options.filter);
  const [rows, totals] = await Promise.all([
    db
      .select(userColumns)
      .from(user)
      .where(where)
      .orderBy(user.createdAt)
      .limit(options.count)
      .offset(options.startIndex - 1),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(user)
      .where(where),
  ]);
  return { records: rows.map(toUserRecord), total: totals[0]?.count ?? 0 };
}

export async function getScimUser(id: string): Promise<ScimUserRecord | null> {
  const rows = await db
    .select(userColumns)
    .from(user)
    .where(and(eq(user.id, id), notAnAgent));
  return rows[0] ? toUserRecord(rows[0]) : null;
}

export async function createScimUser(input: {
  email: string;
  name: string;
  active: boolean;
  externalId: string | null;
}): Promise<ScimUserRecord> {
  const email = input.email.trim().toLowerCase();
  const existing = await db
    .select({ id: user.id, role: user.role, scimExternalId: user.scimExternalId })
    .from(user)
    .where(and(emailEq(email), notAnAgent));
  if (existing[0]) {
    // The role is what grants god mode, so linking this account into a sync would
    // let the identity provider rename, reassign or deactivate the instance owner
    // with no route back except SQL.
    if (existing[0].role === 'god') {
      throw new ScimError(409, 'An instance owner cannot be provisioned through SCIM');
    }
    // A second create for an address already linked to the provider is a retry,
    // not a new person — Okta repeats a create after a timeout — and must not
    // silently overwrite what the first one wrote, including the id the second
    // request left out, with whatever the retry happens to carry.
    if (existing[0].scimExternalId) {
      throw new ScimError(
        409,
        `A user with userName '${input.email}' already exists`,
        'uniqueness',
      );
    }
    // Otherwise this address belongs to an account that predates the sync —
    // created by a sign-up or an OIDC sign-in — so provisioning claims it instead
    // of creating a second one for the same person. Its name and username are left
    // as they are: both may already be the ones the person set for themselves, and
    // the identity provider is only the authority on whether the account should
    // exist and be active.
    const linked = await db
      .update(user)
      .set({ active: input.active, scimExternalId: input.externalId, updatedAt: new Date() })
      .where(eq(user.id, existing[0].id))
      .returning(userColumns);
    return toUserRecord(linked[0]!);
  }
  const rows = await db
    .insert(user)
    .values({
      id: crypto.randomUUID(),
      email,
      name: input.name,
      emailVerified: true,
      role: 'user',
      active: input.active,
      scimExternalId: input.externalId,
      // The @mention handle, derived from the address the same way a sign-up
      // derives it. The identity provider does not supply one.
      username: await generateUsername(email),
    })
    .returning(userColumns);
  return toUserRecord(rows[0]!);
}

export async function updateScimUser(
  id: string,
  patch: { email?: string; name?: string; active?: boolean; externalId?: string | null },
): Promise<ScimUserRecord | null> {
  const target = await db
    .select({ role: user.role })
    .from(user)
    .where(and(eq(user.id, id), notAnAgent));
  // Same reason as the create guard above: nothing about this account is
  // provider-owned, so PUT and PATCH — this function backs both — refuse it too.
  if (target[0]?.role === 'god') {
    throw new ScimError(409, 'An instance owner cannot be updated through SCIM');
  }
  const email = patch.email?.trim().toLowerCase();
  if (email) {
    const clash = await db
      .select({ id: user.id })
      .from(user)
      .where(and(emailEq(email), notAnAgent));
    if (clash[0] && clash[0].id !== id) {
      throw new ScimError(
        409,
        `A user with userName '${patch.email}' already exists`,
        'uniqueness',
      );
    }
  }
  const rows = await db
    .update(user)
    .set({
      ...(email ? { email } : {}),
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.active !== undefined ? { active: patch.active } : {}),
      ...(patch.externalId !== undefined ? { scimExternalId: patch.externalId } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(user.id, id), notAnAgent))
    .returning(userColumns);
  return rows[0] ? toUserRecord(rows[0]) : null;
}

// Some identity providers embed group membership on the user instead of, or as well
// as, pushing separate Group resources — this is what makes a sync grant project
// access without the operator ever configuring a Group push. A named group that
// does not exist yet is created, the way a group pushed through POST /Groups would
// be; the user is added to each one, and every project already mapped to one of
// them is reconciled so membership takes effect immediately.
//
// Additive only: a name missing from a later sync is not removed here. Which
// provider is authoritative for a group is a per-instance choice — a provider that
// also pushes Group resources removes a member through PATCH /Groups, and one that
// only ever embeds `groups` on the user never lists a name it wants revoked, so
// there is nothing to compare against without one of the two mechanisms winning
// over the other by accident.
export async function syncEmbeddedGroups(userId: string, displayNames: string[]): Promise<void> {
  if (displayNames.length === 0) return;
  const groupIds: string[] = [];
  for (const displayName of displayNames) {
    const created = await db
      .insert(scimGroup)
      .values({ displayName })
      .onConflictDoNothing({ target: scimGroup.displayName })
      .returning({ id: scimGroup.id });
    if (created[0]) {
      groupIds.push(created[0].id);
      continue;
    }
    const existing = await db
      .select({ id: scimGroup.id })
      .from(scimGroup)
      .where(eq(scimGroup.displayName, displayName));
    groupIds.push(existing[0]!.id);
  }
  await db
    .insert(scimGroupMember)
    .values(groupIds.map((groupId) => ({ groupId, userId })))
    .onConflictDoNothing();
  const projectIds = (await Promise.all(groupIds.map(mappedProjectIds))).flat();
  await reconcileProjects(projectIds);
}

// Removing the account for real, the way god mode does. Deprovisioning normally
// arrives as `active: false` instead; DELETE stays a real delete so it does not
// disagree with what the owner sees in god mode.
export async function deleteScimUser(id: string): Promise<void> {
  const rows = await db
    .select({ role: user.role, agentId: aiAgent.id })
    .from(user)
    .leftJoin(aiAgent, eq(aiAgent.userId, user.id))
    .where(eq(user.id, id));
  const row = rows[0];
  // An agent's bot user is not part of the SCIM user surface at all, so it answers
  // the same way an unknown id does.
  if (!row || row.agentId) throw new ScimError(404, `User '${id}' not found`);
  if (row.role === 'god') throw new ScimError(409, 'An instance owner cannot be deleted');

  if ((await soleOwnedProjects(id)).length > 0) {
    throw new ScimError(
      409,
      'This user is the only owner of a project. Deactivate them instead, or hand the ' +
        'project over to another owner first.',
    );
  }
  await deleteInstanceUser(id);
}

// The projects this user owns alone. Deleting them would leave those projects with
// nobody who can manage their members.
async function soleOwnedProjects(userId: string): Promise<number[]> {
  const owned = await db
    .select({ projectId: projectMember.projectId })
    .from(projectMember)
    .where(and(eq(projectMember.userId, userId), eq(projectMember.role, 'owner')));
  const sole: number[] = [];
  for (const row of owned) {
    if ((await countOwners(row.projectId)) <= 1) sole.push(row.projectId);
  }
  return sole;
}

// ── Groups ────────────────────────────────────────────────────────────────────

function groupFilterWhere(filter: ScimFilter | null) {
  if (!filter) return undefined;
  if (filter.attribute === 'externalid') return eq(scimGroup.externalId, filter.value);
  return eq(scimGroup.displayName, filter.value);
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

export async function listScimGroups(options: {
  filter: ScimFilter | null;
  startIndex: number;
  count: number;
}): Promise<{ records: ScimGroupRecord[]; total: number }> {
  const where = groupFilterWhere(options.filter);
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

export async function getScimGroup(id: string): Promise<ScimGroupRecord | null> {
  const rows = await db.select().from(scimGroup).where(eq(scimGroup.id, id));
  if (!rows[0]) return null;
  return (await toGroupRecords(rows))[0]!;
}

export async function createScimGroup(input: {
  displayName: string;
  externalId: string | null;
  members: string[];
}): Promise<ScimGroupRecord> {
  const created = await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: scimGroup.id })
      .from(scimGroup)
      .where(eq(scimGroup.displayName, input.displayName));
    if (existing.length > 0) {
      throw new ScimError(409, `A group named '${input.displayName}' already exists`, 'uniqueness');
    }
    const members = [...new Set(input.members)];
    if (members.length > 0) {
      const known = await tx.select({ id: user.id }).from(user).where(inArray(user.id, members));
      const knownIds = new Set(known.map((row) => row.id));
      const missing = members.filter((id) => !knownIds.has(id));
      if (missing.length > 0) {
        throw new ScimError(400, `Unknown member id(s): ${missing.join(', ')}`, 'invalidValue');
      }
    }
    const rows = await tx
      .insert(scimGroup)
      .values({ displayName: input.displayName, externalId: input.externalId })
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
  return (await getScimGroup(created.id))!;
}

export async function updateScimGroup(
  id: string,
  patch: { displayName?: string; externalId?: string | null; members?: string[] },
): Promise<ScimGroupRecord | null> {
  const updated = await db.transaction(async (tx) => {
    const found = await tx.select({ id: scimGroup.id }).from(scimGroup).where(eq(scimGroup.id, id));
    if (!found[0]) return false;
    if (patch.displayName) {
      const clash = await tx
        .select({ id: scimGroup.id })
        .from(scimGroup)
        .where(eq(scimGroup.displayName, patch.displayName));
      if (clash[0] && clash[0].id !== id) {
        throw new ScimError(
          409,
          `A group named '${patch.displayName}' already exists`,
          'uniqueness',
        );
      }
    }
    const members = patch.members ? [...new Set(patch.members)] : undefined;
    if (members && members.length > 0) {
      const known = await tx.select({ id: user.id }).from(user).where(inArray(user.id, members));
      const knownIds = new Set(known.map((row) => row.id));
      const missing = members.filter((userId) => !knownIds.has(userId));
      if (missing.length > 0) {
        throw new ScimError(400, `Unknown member id(s): ${missing.join(', ')}`, 'invalidValue');
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
  return getScimGroup(id);
}

export async function deleteScimGroup(id: string): Promise<boolean> {
  // Read the mappings before the cascade removes them, so the projects the group
  // granted membership in are reconciled after it is gone.
  const projects = await mappedProjectIds(id);
  const deleted = await db
    .delete(scimGroup)
    .where(eq(scimGroup.id, id))
    .returning({ id: scimGroup.id });
  if (deleted.length === 0) return false;
  await reconcileProjects(projects);
  return true;
}
