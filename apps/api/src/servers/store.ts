import { crmCustomer, db, server, serverSession, user } from '@repo/db';
import { decryptSecret, encryptSecret, type EncryptedSecret } from '@repo/crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { iso, num } from '../shared/lib';

export const SERVER_AUTH_TYPES = ['password', 'key'] as const;
export type ServerAuthType = (typeof SERVER_AUTH_TYPES)[number];

export interface ServerRow {
  id: number;
  label: string;
  host: string;
  port: number;
  username: string;
  authType: ServerAuthType;
  customerId: number | null;
  customerName: string | null;
  tags: string[];
  notes: string;
  active: boolean;
  // Whether a host key has been pinned yet. The fingerprint itself is shown so an
  // operator can compare it with what the provider published.
  hostKeyFingerprint: string | null;
  lastConnectedAt: string | null;
  addedByName: string | null;
  createdAt: string;
}

// The credential is deliberately absent from every column list: it is read only by
// the terminal handler, through getServerCredential.
const columns = {
  id: server.id,
  label: server.label,
  host: server.host,
  port: server.port,
  username: server.username,
  authType: server.authType,
  customerId: server.customerId,
  customerName: crmCustomer.name,
  tags: server.tags,
  notes: server.notes,
  active: server.active,
  hostKeyFingerprint: server.hostKeyFingerprint,
  lastConnectedAt: server.lastConnectedAt,
  addedByName: user.name,
  createdAt: server.createdAt,
};

type SelectedRow = {
  id: number;
  label: string;
  host: string;
  port: number;
  username: string;
  authType: string;
  customerId: number | null;
  customerName: string | null;
  tags: string[];
  notes: string;
  active: boolean;
  hostKeyFingerprint: string | null;
  lastConnectedAt: Date | null;
  addedByName: string | null;
  createdAt: Date;
};

function present(row: SelectedRow): ServerRow {
  return {
    id: row.id,
    label: row.label,
    host: row.host,
    port: row.port,
    username: row.username,
    authType: row.authType as ServerAuthType,
    customerId: row.customerId,
    customerName: row.customerName,
    tags: row.tags,
    notes: row.notes,
    active: row.active,
    hostKeyFingerprint: row.hostKeyFingerprint,
    lastConnectedAt: row.lastConnectedAt ? iso(row.lastConnectedAt) : null,
    addedByName: row.addedByName,
    createdAt: iso(row.createdAt),
  };
}

function baseQuery() {
  return db
    .select(columns)
    .from(server)
    .leftJoin(crmCustomer, eq(crmCustomer.id, server.customerId))
    .leftJoin(user, eq(user.id, server.addedByUserId));
}

export interface LinkableCustomer {
  id: number;
  name: string;
}

// Just enough of the CRM to attach a machine to a customer: the numeric id the
// foreign key needs, and a name to show. Nothing else about a customer is exposed
// to someone who only holds `servers` access.
export async function listLinkableCustomers(projectId: number): Promise<LinkableCustomer[]> {
  return db
    .select({ id: crmCustomer.id, name: crmCustomer.name })
    .from(crmCustomer)
    .where(eq(crmCustomer.projectId, projectId))
    .orderBy(crmCustomer.name);
}

export async function listServers(projectId: number): Promise<ServerRow[]> {
  const rows = await baseQuery()
    .where(eq(server.projectId, projectId))
    .orderBy(desc(server.active), server.label);
  return rows.map(present);
}

export async function getServer(serverId: number): Promise<ServerRow | null> {
  const rows = await baseQuery().where(eq(server.id, serverId));
  return rows[0] ? present(rows[0]) : null;
}

export async function getServerProjectId(serverId: number): Promise<number | null> {
  const rows = await db
    .select({ projectId: server.projectId })
    .from(server)
    .where(eq(server.id, serverId));
  return rows[0]?.projectId ?? null;
}

export interface NewServer {
  projectId: number;
  addedByUserId: string | null;
  customerId?: number | null;
  label: string;
  host: string;
  port: number;
  username: string;
  authType: ServerAuthType;
  secret: string;
  passphrase?: string | null;
  tags?: string[];
  notes?: string;
}

export async function createServer(input: NewServer): Promise<ServerRow> {
  const [row] = await db
    .insert(server)
    .values({
      projectId: input.projectId,
      addedByUserId: input.addedByUserId,
      customerId: input.customerId ?? null,
      label: input.label,
      host: input.host,
      port: input.port,
      username: input.username,
      authType: input.authType,
      credential: encryptSecret(input.secret) as unknown as Record<string, unknown>,
      passphrase: input.passphrase
        ? (encryptSecret(input.passphrase) as unknown as Record<string, unknown>)
        : null,
      tags: input.tags ?? [],
      notes: input.notes ?? '',
    })
    .returning({ id: server.id });
  const created = await getServer(row.id);
  if (!created) throw new Error('Server disappeared right after insert');
  return created;
}

export interface ServerPatch {
  customerId?: number | null;
  label?: string;
  host?: string;
  port?: number;
  username?: string;
  authType?: ServerAuthType;
  secret?: string;
  passphrase?: string | null;
  tags?: string[];
  notes?: string;
  active?: boolean;
}

export async function updateServer(
  serverId: number,
  patch: ServerPatch,
): Promise<ServerRow | null> {
  const { secret, passphrase, ...rest } = patch;
  // Changing where a server points invalidates the pinned host key: the old
  // fingerprint belongs to the old target, so it is cleared and pinned again.
  const retarget =
    rest.host !== undefined || rest.port !== undefined ? { hostKeyFingerprint: null } : {};
  await db
    .update(server)
    .set({
      ...rest,
      ...retarget,
      ...(secret
        ? { credential: encryptSecret(secret) as unknown as Record<string, unknown> }
        : {}),
      ...(passphrase !== undefined
        ? {
            passphrase: passphrase
              ? (encryptSecret(passphrase) as unknown as Record<string, unknown>)
              : null,
          }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(server.id, serverId));
  return getServer(serverId);
}

export async function deleteServer(serverId: number): Promise<void> {
  await db.delete(server).where(eq(server.id, serverId));
}

export interface ServerCredential {
  host: string;
  port: number;
  username: string;
  authType: ServerAuthType;
  secret: string;
  passphrase: string | null;
  hostKeyFingerprint: string | null;
  active: boolean;
}

// Reads and decrypts what is needed to open a connection. Only the terminal
// handler calls this, and the result never reaches a response body.
export async function getServerCredential(serverId: number): Promise<ServerCredential | null> {
  const rows = await db.select().from(server).where(eq(server.id, serverId));
  const row = rows[0];
  if (!row) return null;
  return {
    host: row.host,
    port: row.port,
    username: row.username,
    authType: row.authType as ServerAuthType,
    secret: decryptSecret(row.credential as unknown as EncryptedSecret),
    passphrase: row.passphrase ? decryptSecret(row.passphrase as unknown as EncryptedSecret) : null,
    hostKeyFingerprint: row.hostKeyFingerprint,
    active: row.active,
  };
}

// Forgets the pinned key so the next connection pins whatever the host presents.
// Used after a deliberate rebuild or key rotation, when the change is expected.
export async function clearHostKey(serverId: number): Promise<void> {
  await db
    .update(server)
    .set({ hostKeyFingerprint: null, updatedAt: new Date() })
    .where(eq(server.id, serverId));
}

export async function pinHostKey(serverId: number, fingerprint: string): Promise<void> {
  await db
    .update(server)
    .set({ hostKeyFingerprint: fingerprint, updatedAt: new Date() })
    .where(eq(server.id, serverId));
}

export async function markConnected(serverId: number): Promise<void> {
  await db
    .update(server)
    .set({ lastConnectedAt: new Date(), updatedAt: new Date() })
    .where(eq(server.id, serverId));
}

export async function openSession(input: {
  projectId: number;
  serverId: number;
  userId: string | null;
}): Promise<number> {
  const [row] = await db
    .insert(serverSession)
    .values({ projectId: input.projectId, serverId: input.serverId, userId: input.userId })
    .returning({ id: serverSession.id });
  return row.id;
}

export async function closeSession(
  sessionId: number,
  input: {
    status: 'closed' | 'failed';
    errorCode?: string | null;
    bytesIn: number;
    bytesOut: number;
  },
): Promise<void> {
  await db
    .update(serverSession)
    .set({
      status: input.status,
      errorCode: input.errorCode ?? null,
      bytesIn: input.bytesIn,
      bytesOut: input.bytesOut,
      endedAt: new Date(),
    })
    .where(eq(serverSession.id, sessionId));
}

export interface ServerSessionRow {
  id: number;
  serverId: number;
  serverLabel: string;
  userName: string | null;
  status: string;
  errorCode: string | null;
  bytesIn: number;
  bytesOut: number;
  startedAt: string;
  endedAt: string | null;
}

export async function listServerSessions(
  projectId: number,
  limit: number,
): Promise<ServerSessionRow[]> {
  const rows = await db
    .select({
      id: serverSession.id,
      serverId: serverSession.serverId,
      serverLabel: server.label,
      userName: user.name,
      status: serverSession.status,
      errorCode: serverSession.errorCode,
      bytesIn: serverSession.bytesIn,
      bytesOut: serverSession.bytesOut,
      startedAt: serverSession.startedAt,
      endedAt: serverSession.endedAt,
    })
    .from(serverSession)
    .innerJoin(server, eq(server.id, serverSession.serverId))
    .leftJoin(user, eq(user.id, serverSession.userId))
    .where(eq(serverSession.projectId, projectId))
    .orderBy(desc(serverSession.startedAt))
    .limit(limit);
  return rows.map((row) => ({
    id: row.id,
    serverId: row.serverId,
    serverLabel: row.serverLabel,
    userName: row.userName,
    status: row.status,
    errorCode: row.errorCode,
    bytesIn: num(row.bytesIn),
    bytesOut: num(row.bytesOut),
    startedAt: iso(row.startedAt),
    endedAt: row.endedAt ? iso(row.endedAt) : null,
  }));
}

export interface ServerOverview {
  total: number;
  active: number;
  customers: number;
  sessionsToday: number;
  unpinned: number;
}

export async function getServerOverview(projectId: number): Promise<ServerOverview> {
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const [counts, sessions] = await Promise.all([
    db
      .select({
        total: sql<string>`count(*)`,
        active: sql<string>`count(*) filter (where ${server.active})`,
        customers: sql<string>`count(distinct ${server.customerId})`,
        unpinned: sql<string>`count(*) filter (where ${server.hostKeyFingerprint} is null)`,
      })
      .from(server)
      .where(eq(server.projectId, projectId)),
    db
      .select({ count: sql<string>`count(*)` })
      .from(serverSession)
      .where(
        and(
          eq(serverSession.projectId, projectId),
          sql`${serverSession.startedAt} >= ${startOfToday.toISOString()}::timestamptz`,
        ),
      ),
  ]);
  return {
    total: num(counts[0]?.total ?? 0),
    active: num(counts[0]?.active ?? 0),
    customers: num(counts[0]?.customers ?? 0),
    sessionsToday: num(sessions[0]?.count ?? 0),
    unpinned: num(counts[0]?.unpinned ?? 0),
  };
}
