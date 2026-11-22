import { randomBytes } from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { trustedOrigins } from '@repo/auth';
import { encryptSecret } from '@repo/crypto';
import {
  db,
  project,
  slackLinkRequest,
  team,
  userSlackAccount,
  workspaceSlackSetting,
  writeSecret,
  SLACK_APP_SECRET_KEY,
  getInstanceSlackConfig,
  isSlackAppUsable,
  readWorkspaceSlackConfig,
  slackAppForProject,
  type InstanceSlackConfig,
  type SlackApp,
  type WorkspaceSlackConfig,
} from '@repo/db';
import { HttpError, iso, pgErrorCode } from '#shared/lib';
import { projectRef } from '#modules/teams/ref';

// Slack notifications. The instance app is set up in god mode, and a workspace may send
// through an app of its own instead; the stored shapes and the reader that picks the app
// are in @repo/db, shared with the worker. What is here is the write side and the account
// connection. A member connects their Slack account with Sign in with Slack through the
// app that serves the project they start from. A Slack user id belongs to one Slack
// workspace, so a member keeps one connection per Slack workspace.

// Long enough to approve the request in Slack, short enough that a leaked link is useless.
const LINK_TTL_MINUTES = 15;

// Where Slack sends the member back. Every app lists this address among its redirect URLs.
function slackRedirectUrl(): string {
  return `${trustedOrigins[0]}/slack/connect`;
}

// An app as returned to the client: the secrets replaced by flags telling whether a value
// is stored.
export interface SlackAppDto {
  hasBotToken: boolean;
  clientId: string;
  hasClientSecret: boolean;
  // The Slack workspace the bot token belongs to; empty until a token is saved.
  slackTeamName: string;
  redirectUrl: string;
}

export interface InstanceSlackDto extends SlackAppDto {
  enabled: boolean;
}

export interface WorkspaceSlackDto extends SlackAppDto {
  enabled: boolean;
  own: boolean;
  // The Slack workspace of the instance app while it is set up and on, otherwise null.
  instanceSlackTeamName: string | null;
}

// A secret left out or sent empty keeps its stored value (a masked field nobody edited).
export interface SlackAppPatch {
  botToken?: string;
  clientId?: string;
  clientSecret?: string;
}

function appDto(app: SlackApp): SlackAppDto {
  return {
    hasBotToken: app.botToken.length > 0,
    clientId: app.clientId,
    hasClientSecret: app.clientSecret.length > 0,
    slackTeamName: app.slackTeamName,
    redirectUrl: slackRedirectUrl(),
  };
}

// Asks Slack whom a new bot token belongs to, so a wrong one is refused at save time
// rather than by deliveries that fail one by one. A user token (xoxp-) passes auth.test
// too but would send as that person, so the answer has to name a bot.
async function resolveBotToken(
  botToken: string,
): Promise<{ slackTeamId: string; slackTeamName: string }> {
  let body: { ok?: boolean; bot_id?: string; team_id?: string; team?: string } | null;
  try {
    const res = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: { authorization: `Bearer ${botToken}` },
      signal: AbortSignal.timeout(15_000),
    });
    body = res.ok ? ((await res.json()) as typeof body) : null;
  } catch {
    body = null;
  }
  if (!body) throw new HttpError(400, 'Could not reach Slack to check the bot token. Try again');
  if (!body.ok || !body.bot_id || !body.team_id) {
    throw new HttpError(
      400,
      'Slack does not accept this bot token. Copy the Bot User OAuth Token again',
    );
  }
  return { slackTeamId: body.team_id, slackTeamName: body.team ?? '' };
}

async function applyAppPatch(current: SlackApp, patch: SlackAppPatch): Promise<SlackApp> {
  const botToken = patch.botToken?.trim() || current.botToken;
  const next: SlackApp = {
    botToken,
    clientId: patch.clientId !== undefined ? patch.clientId.trim() : current.clientId,
    clientSecret: patch.clientSecret?.trim() || current.clientSecret,
    slackTeamId: current.slackTeamId,
    slackTeamName: current.slackTeamName,
  };
  return botToken === current.botToken ? next : { ...next, ...(await resolveBotToken(botToken)) };
}

// An app in use without one of its parts would offer a connection that leads nowhere.
function assertComplete(app: SlackApp): void {
  if (!isSlackAppUsable(app)) {
    throw new HttpError(400, 'Add the bot token, client ID and client secret first');
  }
}

export async function getInstanceSlackSettings(): Promise<InstanceSlackDto> {
  const config = await getInstanceSlackConfig();
  return { enabled: config.enabled, ...appDto(config) };
}

export async function setInstanceSlackSettings(
  patch: SlackAppPatch & { enabled?: boolean },
): Promise<InstanceSlackDto> {
  const current = await getInstanceSlackConfig();
  const next: InstanceSlackConfig = {
    enabled: patch.enabled ?? current.enabled,
    ...(await applyAppPatch(current, patch)),
  };
  if (next.enabled) assertComplete(next);
  const dto = { enabled: next.enabled, ...appDto(next) };
  await writeSecret(SLACK_APP_SECRET_KEY, next, dto);
  return dto;
}

async function instanceSlackTeamName(): Promise<string | null> {
  const config = await getInstanceSlackConfig();
  return config.enabled && isSlackAppUsable(config) ? config.slackTeamName : null;
}

export async function getWorkspaceSlackSettings(workspaceId: number): Promise<WorkspaceSlackDto> {
  const config = await readWorkspaceSlackConfig(workspaceId);
  return {
    enabled: config.enabled,
    own: config.own,
    ...appDto(config),
    instanceSlackTeamName: await instanceSlackTeamName(),
  };
}

export async function setWorkspaceSlackSettings(
  workspaceId: number,
  patch: SlackAppPatch & { enabled: boolean; own: boolean },
): Promise<WorkspaceSlackDto> {
  const current = await readWorkspaceSlackConfig(workspaceId);
  const next: WorkspaceSlackConfig = {
    enabled: patch.enabled,
    own: patch.own,
    ...(await applyAppPatch(current, patch)),
  };
  if (next.enabled && next.own) assertComplete(next);
  const redacted = { enabled: next.enabled, own: next.own, ...appDto(next) };
  const row = { ...encryptSecret(JSON.stringify(next)), redacted };
  await db
    .insert(workspaceSlackSetting)
    .values({ workspaceId, ...row })
    .onConflictDoUpdate({
      target: workspaceSlackSetting.workspaceId,
      set: { ...row, updatedAt: sql`now()` },
    });
  return { ...redacted, instanceSlackTeamName: await instanceSlackTeamName() };
}

// ── Account connections ───────────────────────────────────────────────────────

export interface SlackAccountDto {
  // The Slack workspace the project's notifications go to; null while Slack is off for it.
  slackTeamName: string | null;
  link: { name: string | null; linkedAt: string } | null;
}

export async function getSlackAccount(userId: string, projectId: number): Promise<SlackAccountDto> {
  const app = await slackAppForProject(projectId);
  if (!app) return { slackTeamName: null, link: null };
  const [row] = await db
    .select({ name: userSlackAccount.name, linkedAt: userSlackAccount.linkedAt })
    .from(userSlackAccount)
    .where(
      and(eq(userSlackAccount.userId, userId), eq(userSlackAccount.slackTeamId, app.slackTeamId)),
    );
  return {
    slackTeamName: app.slackTeamName,
    link: row ? { name: row.name, linkedAt: iso(row.linkedAt) } : null,
  };
}

// Starts a connection and returns the Sign in with Slack address. A connection already in
// place stays until Slack confirms the new one.
export async function startSlackLink(userId: string, projectId: number): Promise<string> {
  const app = await slackAppForProject(projectId);
  if (!app) throw new HttpError(400, "Slack is not set up for this project's workspace");
  const code = randomBytes(16).toString('base64url');
  const expiresAt = new Date(Date.now() + LINK_TTL_MINUTES * 60_000);
  await db
    .insert(slackLinkRequest)
    .values({ code, userId, projectId, expiresAt })
    .onConflictDoUpdate({ target: slackLinkRequest.userId, set: { code, projectId, expiresAt } });
  const params = new URLSearchParams({
    response_type: 'code',
    scope: 'openid profile',
    client_id: app.clientId,
    state: code,
    nonce: code,
    redirect_uri: slackRedirectUrl(),
    team: app.slackTeamId,
  });
  return `https://slack.com/openid/connect/authorize?${params}`;
}

interface IdTokenClaims {
  aud?: string;
  nonce?: string;
  name?: string;
  'https://slack.com/user_id'?: string;
  'https://slack.com/team_id'?: string;
}

// The id token comes straight from Slack's token endpoint over TLS, in exchange for the
// client secret, so its signature needs no check (OpenID Connect Core 3.1.3.7).
function readIdToken(idToken: string): IdTokenClaims {
  try {
    return JSON.parse(Buffer.from(idToken.split('.')[1] ?? '', 'base64url').toString('utf8'));
  } catch {
    return {};
  }
}

async function exchangeCode(app: SlackApp, code: string): Promise<IdTokenClaims> {
  let body: { ok?: boolean; id_token?: string } | null;
  try {
    const res = await fetch('https://slack.com/api/openid.connect.token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: app.clientId,
        client_secret: app.clientSecret,
        code,
        redirect_uri: slackRedirectUrl(),
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(15_000),
    });
    body = res.ok ? ((await res.json()) as typeof body) : null;
  } catch {
    body = null;
  }
  if (!body) throw new HttpError(400, 'Could not reach Slack. Try again');
  if (!body.ok || !body.id_token)
    throw new HttpError(400, 'Slack did not confirm the connection. Try again');
  return readIdToken(body.id_token);
}

// Completes a connection with what Slack sent back, for the user who started it. Returns
// the ref of the project it was started from, so the member lands back there.
export async function completeSlackLink(
  userId: string,
  code: string,
  state: string,
): Promise<string> {
  // Used once, and only by the account that started it: a link from someone else's
  // browser cannot attach their Slack account to this one.
  const [request] = await db
    .delete(slackLinkRequest)
    .where(and(eq(slackLinkRequest.code, state), eq(slackLinkRequest.userId, userId)))
    .returning();
  if (!request)
    throw new HttpError(
      404,
      "This Slack connection was started from another account. Connect again from the project's notification settings",
    );
  if (request.expiresAt.getTime() < Date.now()) {
    throw new HttpError(
      400,
      "This Slack connection has expired. Connect again from the project's notification settings",
    );
  }
  const app = await slackAppForProject(request.projectId);
  if (!app) throw new HttpError(400, "Slack is not set up for this project's workspace");

  const claims = await exchangeCode(app, code);
  const slackUserId = claims['https://slack.com/user_id'];
  if (claims.aud !== app.clientId || claims.nonce !== state || !slackUserId) {
    throw new HttpError(400, 'Slack did not confirm the connection. Try again');
  }
  // The bot can write only to people of its own Slack workspace.
  if (claims['https://slack.com/team_id'] !== app.slackTeamId) {
    throw new HttpError(
      400,
      `Sign in to the ${app.slackTeamName} Slack workspace, then connect again`,
    );
  }

  const values = { slackUserId, name: claims.name ?? null, slackTeamName: app.slackTeamName };
  try {
    await db.transaction(async (tx) => {
      // Slack has just confirmed this person signs in as that Slack account, so a
      // connection of it to another account moves here.
      await tx
        .delete(userSlackAccount)
        .where(
          and(
            eq(userSlackAccount.slackTeamId, app.slackTeamId),
            eq(userSlackAccount.slackUserId, slackUserId),
          ),
        );
      await tx
        .insert(userSlackAccount)
        .values({ userId, slackTeamId: app.slackTeamId, ...values })
        .onConflictDoUpdate({
          target: [userSlackAccount.userId, userSlackAccount.slackTeamId],
          set: { ...values, linkedAt: sql`now()` },
        });
    });
  } catch (err) {
    // Two accounts connecting the same Slack account at the same moment.
    if (pgErrorCode(err) === '23505') {
      throw new HttpError(409, 'This Slack account is already connected to another user');
    }
    throw err;
  }

  const [row] = await db
    .select({ key: project.key, teamId: team.id, slug: team.slug })
    .from(project)
    .innerJoin(team, eq(team.id, project.teamId))
    .where(eq(project.id, request.projectId));
  return projectRef({ id: row!.teamId, slug: row!.slug }, row!.key);
}

// Removes the connection to the Slack workspace the project's notifications go to.
export async function unlinkSlack(userId: string, projectId: number): Promise<void> {
  const app = await slackAppForProject(projectId);
  if (!app) return;
  await db
    .delete(userSlackAccount)
    .where(
      and(eq(userSlackAccount.userId, userId), eq(userSlackAccount.slackTeamId, app.slackTeamId)),
    );
}

// The Slack user ids of several users in one Slack workspace, for the notification
// enqueue path. Users with no connection there are absent from the map.
export async function getSlackUserIds(
  userIds: string[],
  slackTeamId: string,
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const rows = await db
    .select({ userId: userSlackAccount.userId, slackUserId: userSlackAccount.slackUserId })
    .from(userSlackAccount)
    .where(
      and(inArray(userSlackAccount.userId, userIds), eq(userSlackAccount.slackTeamId, slackTeamId)),
    );
  return new Map(rows.map((r) => [r.userId, r.slackUserId]));
}
