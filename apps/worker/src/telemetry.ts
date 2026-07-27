import { existsSync } from 'node:fs';
import { db, getOrCreateSetting, getSetting, setSetting } from '@repo/db';
import { sql } from 'drizzle-orm';
import { equalJitterBackoffMs } from './backoff';
import { buildPulse, type InstanceCounts } from './telemetry-payload';
import {
  minuteOfDay,
  randomSendMinute,
  shouldSend,
  utcDay,
  MINUTES_PER_DAY,
} from './telemetry-schedule';
import pkg from '../../../package.json';

// Sends one anonymous snapshot of this instance a day. TELEMETRY.md documents what
// goes out and how to turn it off (TELEMETRY_DISABLED=1 / DO_NOT_TRACK=1).

const ENDPOINT = 'https://telemetry.itsaplan.dev/v1/telemetry';
const TIMEOUT_MS = 10_000;

// Retried with a growing delay for this many attempts, then once an hour.
const MAX_ATTEMPTS = 5;
const RETRY_AFTER_MAX_MS = 60 * 60_000;

// ~1min at the worker's 2s poll interval, matching the minute the slot is expressed in.
export const TELEMETRY_CHECK_EVERY_TICKS = 30;

const INSTANCE_ID_KEY = 'telemetry.instance_id';
const LAST_SENT_KEY = 'telemetry.last_sent_day';
const SEND_MINUTE_KEY = 'telemetry.send_minute';

interface State {
  instanceId: string;
  sendMinute: number;
  lastSentDay: string | null;
}

// Read once per process, then kept in memory. Replicas each hold their own copy and
// each send; the collector keys rows on (instance_id, day), so that costs N requests
// a day, not N rows.
let state: State | null = null;

// In memory only: a restart costs one extra attempt.
let failures = 0;
let retryAfterMs = 0;

// Any value but '' and '0' opts out; compose passes an unset variable through as ''.
function optedOut(value: string | undefined): boolean {
  return value !== undefined && value !== '' && value !== '0';
}

function telemetryEnabled(): boolean {
  return !optedOut(process.env.TELEMETRY_DISABLED) && !optedOut(process.env.DO_NOT_TRACK);
}

async function instanceId(): Promise<string> {
  const stored = await getSetting<string>(INSTANCE_ID_KEY);
  if (typeof stored === 'string' && stored.length > 0) return stored;
  // Insert-if-absent: replicas racing on the first start settle on one id.
  const id = await getOrCreateSetting(INSTANCE_ID_KEY, crypto.randomUUID());
  // Printed once ever, so an operator who never reads the docs still finds out.
  console.log(
    '[telemetry] this instance now sends one anonymous snapshot a day. ' +
      'It carries no names, no content and no exact counts — see TELEMETRY.md. ' +
      'Turn it off with TELEMETRY_DISABLED=1 or DO_NOT_TRACK=1.',
  );
  return id;
}

async function sendMinute(): Promise<number> {
  const stored = await getSetting<number>(SEND_MINUTE_KEY);
  if (typeof stored === 'number' && stored >= 0 && stored < MINUTES_PER_DAY) return stored;
  return await getOrCreateSetting(SEND_MINUTE_KEY, randomSendMinute());
}

async function loadState(): Promise<State> {
  return {
    instanceId: await instanceId(),
    sendMinute: await sendMinute(),
    lastSentDay: (await getSetting<string>(LAST_SENT_KEY)) ?? null,
  };
}

// ::int because postgres-js returns bigint as a string, which would bucket as NaN.
async function readCounts(): Promise<InstanceCounts> {
  const rows = await db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM "user") AS "users",
      (SELECT count(DISTINCT user_id)::int FROM "session"
        WHERE created_at > now() - interval '30 days') AS "activeUsers30d",
      (SELECT count(*)::int FROM project) AS "projects",
      (SELECT count(*)::int FROM issue) AS "issues",
      (SELECT count(*)::int FROM issue
        WHERE created_at > now() - interval '30 days') AS "issuesCreated30d",
      (SELECT count(*)::int FROM ai_agent) AS "agents",
      (SELECT count(*)::int FROM agent_run
        WHERE created_at > now() - interval '30 days') AS "agentRuns30d",
      (SELECT count(*)::int FROM agent_run
        WHERE created_at > now() - interval '30 days'
          AND status = 'failed') AS "agentRunsFailed30d",
      (SELECT count(*)::int FROM webhook_delivery
        WHERE created_at > now() - interval '30 days') AS "webhookDeliveries30d",
      (SELECT count(*)::int FROM webhook_delivery
        WHERE created_at > now() - interval '30 days'
          AND status = 'failed') AS "webhookDeliveriesFailed30d",
      EXISTS(SELECT 1 FROM initiative) AS "hasInitiatives",
      EXISTS(SELECT 1 FROM note_board) AS "hasNoteBoards",
      EXISTS(SELECT 1 FROM project_dashboard) AS "hasDashboards",
      EXISTS(SELECT 1 FROM project_view) AS "hasCustomViews",
      EXISTS(SELECT 1 FROM custom_field) AS "hasCustomFields",
      EXISTS(SELECT 1 FROM label_group) AS "hasLabelGroups",
      EXISTS(SELECT 1 FROM project_action) AS "hasProjectActions",
      EXISTS(SELECT 1 FROM issue_attachment) AS "hasAttachments",
      EXISTS(SELECT 1 FROM agent_schedule) AS "hasAgentSchedules",
      EXISTS(SELECT 1 FROM webhook) AS "hasWebhooks",
      EXISTS(SELECT 1 FROM apikey) AS "hasApiKeys",
      EXISTS(SELECT 1 FROM project WHERE mcp_enabled) AS "hasMcpProject",
      -- The app_secret row appears on any save, so read the plaintext mirror of the
      -- config: same conditions as hasEmailProvider, isGoogleUsable, isInstanceBotUsable.
      EXISTS(SELECT 1 FROM app_secret WHERE key = 'auth.email'
        AND (((redacted->'smtp'->>'enabled')::boolean AND redacted->'smtp'->>'host' <> '')
          OR ((redacted->'resend'->>'enabled')::boolean
            AND (redacted->'resend'->>'hasApiKey')::boolean))) AS "hasEmail",
      EXISTS(SELECT 1 FROM app_secret WHERE key = 'auth.google'
        AND (redacted->>'enabled')::boolean
        AND redacted->>'clientId' <> ''
        AND (redacted->>'hasClientSecret')::boolean) AS "hasGoogleOauth",
      EXISTS(SELECT 1 FROM app_secret WHERE key = 'telegram.bot'
        AND (redacted->>'enabled')::boolean
        AND (redacted->>'hasBotToken')::boolean) AS "hasTelegramBot",
      EXISTS(SELECT 1 FROM integration_credential) AS "hasProjectIntegrations"
  `);
  return (rows as unknown as InstanceCounts[])[0];
}

async function postgresMajor(): Promise<number | null> {
  const rows = await db.execute(
    sql`SELECT (current_setting('server_version_num')::int / 10000) AS "major"`,
  );
  const major = (rows as unknown as { major: number }[])[0]?.major;
  return typeof major === 'number' ? major : null;
}

// The first migration timestamp is the install date: nothing has to be recorded for
// it, and unlike the first pulse it holds for an instance that ran with telemetry off.
async function installedDay(): Promise<string | null> {
  try {
    const rows = await db.execute(sql`
      SELECT to_char(to_timestamp(min(created_at) / 1000) AT TIME ZONE 'UTC', 'YYYY-MM-DD')
        AS "day"
      FROM drizzle.__drizzle_migrations
    `);
    return (rows as unknown as { day: string | null }[])[0]?.day ?? null;
  } catch (error) {
    console.error('[telemetry] install date unreadable:', error);
    return null;
  }
}

// The stored day is advanced only after the collector accepted the body, so a failed
// send is retried rather than lost for the day.
export async function processTelemetry(): Promise<void> {
  if (!telemetryEnabled()) return;

  const now = new Date();
  if (now.getTime() < retryAfterMs) return;

  state ??= await loadState();

  const day = utcDay(now);
  const due = shouldSend({
    day,
    lastSentDay: state.lastSentDay,
    minuteOfDay: minuteOfDay(now),
    sendMinute: state.sendMinute,
  });
  if (!due) return;

  const pulse = buildPulse({
    instanceId: state.instanceId,
    day,
    installedDay: await installedDay(),
    version: pkg.version,
    bunVersion: Bun.version,
    docker: existsSync('/.dockerenv'),
    platform: `${process.platform}/${process.arch}`,
    postgresMajor: await postgresMajor(),
    counts: await readCounts(),
  });

  const body = JSON.stringify(pulse);
  if (process.env.TELEMETRY_DEBUG === '1') {
    console.log('[telemetry] sending:', body);
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`collector returned ${response.status}`);
    }
  } catch (error) {
    failures++;
    retryAfterMs =
      now.getTime() +
      (failures >= MAX_ATTEMPTS ? RETRY_AFTER_MAX_MS : equalJitterBackoffMs(failures));
    throw error;
  }

  failures = 0;
  retryAfterMs = 0;
  state.lastSentDay = day;
  await setSetting(LAST_SENT_KEY, day);
}
