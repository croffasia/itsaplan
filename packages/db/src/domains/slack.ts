import { eq } from 'drizzle-orm';
import { decryptSecret } from '@repo/crypto';
import { db } from '../client';
import { project, team, workspaceSlackSetting } from '../schema/app';
import { readSecret } from '../secrets';

// The Slack app notifications go through: the instance's, in app_secret under
// 'slack.app', unless a workspace set one of its own in workspace_slack_setting. Read by
// the api (settings, account connection, enqueue) and by the worker (send). The api owns
// the writes, so a field added here has to be set there too.

export const SLACK_APP_SECRET_KEY = 'slack.app';

// One Slack app installed in one Slack workspace. The bot token sends; the client id and
// secret run Sign in with Slack, which connects a member's account. slackTeamId and
// slackTeamName are resolved from the token when it is saved.
export interface SlackApp {
  botToken: string; // secret
  clientId: string;
  clientSecret: string; // secret
  slackTeamId: string;
  slackTeamName: string;
}

export interface InstanceSlackConfig extends SlackApp {
  enabled: boolean;
}

// `own` sends through the app stored with the workspace instead of the instance's.
// `enabled` off sends nothing to Slack from the workspace's projects.
export interface WorkspaceSlackConfig extends SlackApp {
  enabled: boolean;
  own: boolean;
}

function emptyApp(): SlackApp {
  return { botToken: '', clientId: '', clientSecret: '', slackTeamId: '', slackTeamName: '' };
}

export async function getInstanceSlackConfig(): Promise<InstanceSlackConfig> {
  const stored = await readSecret<InstanceSlackConfig>(SLACK_APP_SECRET_KEY);
  // Merge over the default so a config written before a field was added stays valid.
  return { enabled: false, ...emptyApp(), ...stored };
}

// A workspace that saved nothing sends through the instance app.
function defaultWorkspaceSlackConfig(): WorkspaceSlackConfig {
  return { enabled: true, own: false, ...emptyApp() };
}

export async function readWorkspaceSlackConfig(workspaceId: number): Promise<WorkspaceSlackConfig> {
  const [row] = await db
    .select({
      ciphertext: workspaceSlackSetting.ciphertext,
      iv: workspaceSlackSetting.iv,
      authTag: workspaceSlackSetting.authTag,
    })
    .from(workspaceSlackSetting)
    .where(eq(workspaceSlackSetting.workspaceId, workspaceId));
  if (!row) return defaultWorkspaceSlackConfig();
  return {
    ...defaultWorkspaceSlackConfig(),
    ...(JSON.parse(decryptSecret(row)) as WorkspaceSlackConfig),
  };
}

// An app sends and connects accounts only once every part of it is set.
export function isSlackAppUsable(app: SlackApp): boolean {
  return (
    app.botToken.length > 0 &&
    app.clientId.length > 0 &&
    app.clientSecret.length > 0 &&
    app.slackTeamId.length > 0
  );
}

// The app that serves a workspace's projects, or null while Slack is off for them.
export async function slackAppForWorkspace(workspaceId: number): Promise<SlackApp | null> {
  const workspaceConfig = await readWorkspaceSlackConfig(workspaceId);
  if (!workspaceConfig.enabled) return null;
  if (workspaceConfig.own) return isSlackAppUsable(workspaceConfig) ? workspaceConfig : null;
  const instance = await getInstanceSlackConfig();
  return instance.enabled && isSlackAppUsable(instance) ? instance : null;
}

export async function slackAppForProject(projectId: number): Promise<SlackApp | null> {
  const [row] = await db
    .select({ workspaceId: team.workspaceId })
    .from(project)
    .innerJoin(team, eq(team.id, project.teamId))
    .where(eq(project.id, projectId));
  return row ? slackAppForWorkspace(row.workspaceId) : null;
}
