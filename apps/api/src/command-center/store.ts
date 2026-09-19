import {
  db,
  agentRun,
  aiAgent,
  braindumpEntry,
  commandCenterSnooze,
  competitorEvent,
  financeTransaction,
  issue,
  issueLink,
  mindFact,
  notification,
  projectColumn,
  server,
  serverSession,
} from '@repo/db';
import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import { getMemberContext } from '../members/store';
import { hasPermission, type PermissionResource } from '../shared/permissions';

// One thing that wants attention today, derived on every read from the rest of the
// dashboard. Nothing is stored: a signal disappears when the underlying work is
// done, which is what keeps this page honest.
export interface Signal {
  id: string;
  // How loud the card is. 'critical' has passed its moment, 'attention' is about to,
  // 'info' is worth knowing but costs nothing to leave.
  severity: 'critical' | 'attention' | 'info';
  title: string;
  detail: string;
  count: number;
  // Where the work actually happens, as a path under the project.
  href: string;
  // What a member has to be able to read for this signal to be shown at all.
  resource: PermissionResource;
  snoozedUntil: string | null;
}

export interface CommandCenter {
  generatedAt: string;
  signals: Signal[];
  // The one to start with, by severity and then by size. Null when nothing is left.
  focusId: string | null;
}

const STALE_MIND_DAYS = 90;

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

// The columns that mean an issue is still someone's problem.
const openColumn = sql`${projectColumn.stateType} NOT IN ('completed', 'canceled')`;

async function countIssues(projectId: number, extra: ReturnType<typeof sql>): Promise<number> {
  const rows = await db
    .select({ count: sql<string>`count(*)` })
    .from(issue)
    .innerJoin(projectColumn, eq(projectColumn.id, issue.columnId))
    .where(and(eq(issue.projectId, projectId), isNull(issue.archivedAt), openColumn, extra));
  return Number(rows[0]?.count ?? 0);
}

async function money(
  projectId: number,
  type: 'income' | 'expense',
): Promise<{ count: number; cents: number }> {
  const rows = await db
    .select({
      count: sql<string>`count(*)`,
      cents: sql<string>`coalesce(sum(${financeTransaction.amountCents}), 0)`,
    })
    .from(financeTransaction)
    .where(
      and(
        eq(financeTransaction.projectId, projectId),
        eq(financeTransaction.type, type),
        eq(financeTransaction.paymentStatus, 'open'),
        lt(financeTransaction.dueDate, sql`current_date`),
      ),
    );
  return { count: Number(rows[0]?.count ?? 0), cents: Number(rows[0]?.cents ?? 0) };
}

function euro(cents: number): string {
  return `€${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

async function countRows(query: Promise<{ count: string }[]>): Promise<number> {
  return Number((await query)[0]?.count ?? 0);
}

// Each block is only run when the member may read the section it comes from, so
// the page never leaks the existence of work behind a permission they lack.
export async function getCommandCenter(
  projectId: number,
  projectKey: string,
  userId: string,
): Promise<CommandCenter> {
  const context = await getMemberContext(projectId, userId);
  const may = (resource: PermissionResource) =>
    context !== null &&
    (context.role === 'owner' || hasPermission(context.permissions, resource, 'read'));

  const path = (suffix: string) => `/project/${encodeURIComponent(projectKey)}${suffix}`;
  const signals: Signal[] = [];
  const add = (signal: Omit<Signal, 'snoozedUntil'>) => {
    if (signal.count > 0) signals.push({ ...signal, snoozedUntil: null });
  };

  if (may('work_items')) {
    const [overdue, today, blocked] = await Promise.all([
      countIssues(projectId, sql`${issue.dueDate} < current_date`),
      countIssues(projectId, sql`${issue.dueDate} = current_date`),
      // Blocked: something that blocks this issue is itself still open.
      countIssues(
        projectId,
        sql`exists (
          select 1 from ${issueLink}
          join ${issue} as blocker on blocker.id = ${issueLink.sourceIssueId}
          join ${projectColumn} as blocker_column on blocker_column.id = blocker.column_id
          where ${issueLink.kind} = 'blocks'
            and ${issueLink.targetIssueId} = ${issue.id}
            and blocker.archived_at is null
            and blocker_column.state_type not in ('completed', 'canceled')
        )`,
      ),
    ]);

    add({
      id: 'work.overdue',
      severity: 'critical',
      title: 'Work items are past their date',
      detail: `${plural(overdue, 'item', 'items')} were due before today and are still open.`,
      count: overdue,
      href: path(''),
      resource: 'work_items',
    });
    add({
      id: 'work.due_today',
      severity: 'attention',
      title: 'Due today',
      detail: `${plural(today, 'item', 'items')} carry today's date.`,
      count: today,
      href: path(''),
      resource: 'work_items',
    });
    add({
      id: 'work.blocked',
      severity: 'attention',
      title: 'Blocked by something else',
      detail: `${plural(blocked, 'item is', 'items are')} waiting on work that has not finished.`,
      count: blocked,
      href: path(''),
      resource: 'work_items',
    });
  }

  if (may('finance')) {
    const [invoices, bills] = await Promise.all([
      money(projectId, 'income'),
      money(projectId, 'expense'),
    ]);
    add({
      id: 'finance.invoices_overdue',
      severity: 'critical',
      title: 'Invoices are overdue',
      detail: `${euro(invoices.cents)} across ${plural(invoices.count, 'invoice', 'invoices')} is past its due date.`,
      count: invoices.count,
      href: path('/finance'),
      resource: 'finance',
    });
    add({
      id: 'finance.bills_overdue',
      severity: 'attention',
      title: 'Bills are past due',
      detail: `${euro(bills.cents)} you owe has passed its date.`,
      count: bills.count,
      href: path('/finance'),
      resource: 'finance',
    });
  }

  if (may('ai_agents')) {
    const failed = await countRows(
      db
        .select({ count: sql<string>`count(*)` })
        .from(agentRun)
        .innerJoin(aiAgent, eq(aiAgent.id, agentRun.agentId))
        .where(
          and(
            eq(aiAgent.projectId, projectId),
            eq(agentRun.status, 'failed'),
            sql`${agentRun.createdAt} > now() - interval '7 days'`,
          ),
        ),
    );
    add({
      id: 'agents.failed',
      severity: 'critical',
      title: 'Agent runs failed',
      detail: `${plural(failed, 'run', 'runs')} failed in the last seven days.`,
      count: failed,
      href: path('/ai-team/agents'),
      resource: 'ai_agents',
    });
  }

  if (may('servers')) {
    const failed = await countRows(
      db
        .select({ count: sql<string>`count(*)` })
        .from(serverSession)
        .where(
          and(
            eq(serverSession.projectId, projectId),
            eq(serverSession.status, 'failed'),
            sql`${serverSession.startedAt} > now() - interval '24 hours'`,
          ),
        ),
    );
    add({
      id: 'servers.failed_sessions',
      severity: 'critical',
      title: 'A server refused a connection',
      detail: `${plural(failed, 'attempt', 'attempts')} to open a shell failed in the last day.`,
      count: failed,
      href: path('/servers'),
      resource: 'servers',
    });

    const unpinned = await countRows(
      db
        .select({ count: sql<string>`count(*)` })
        .from(server)
        .where(
          and(
            eq(server.projectId, projectId),
            eq(server.active, true),
            isNull(server.hostKeyFingerprint),
          ),
        ),
    );
    add({
      id: 'servers.unpinned',
      severity: 'info',
      title: 'Servers without a pinned host key',
      detail: `${plural(unpinned, 'machine has', 'machines have')} never been connected to from here.`,
      count: unpinned,
      href: path('/servers'),
      resource: 'servers',
    });
  }

  if (may('competitors')) {
    const unread = await countRows(
      db
        .select({ count: sql<string>`count(*)` })
        .from(competitorEvent)
        .where(and(eq(competitorEvent.projectId, projectId), isNull(competitorEvent.readAt))),
    );
    add({
      id: 'competitors.alerts',
      severity: 'info',
      title: 'Competitor alerts you have not read',
      detail: `${plural(unread, 'alert', 'alerts')} came in from the accounts you watch.`,
      count: unread,
      href: path('/competitors'),
      resource: 'competitors',
    });
  }

  if (may('braindump')) {
    const unfiled = await countRows(
      db
        .select({ count: sql<string>`count(*)` })
        .from(braindumpEntry)
        .where(and(eq(braindumpEntry.projectId, projectId), isNull(braindumpEntry.routedTo))),
    );
    add({
      id: 'braindump.unfiled',
      severity: 'attention',
      title: 'Braindumps still sitting there',
      detail: `${plural(unfiled, 'capture has', 'captures have')} not been filed anywhere yet.`,
      count: unfiled,
      href: path('/braindump'),
      resource: 'braindump',
    });
  }

  if (may('mind')) {
    const stale = await countRows(
      db
        .select({ count: sql<string>`count(*)` })
        .from(mindFact)
        .where(
          and(
            eq(mindFact.projectId, projectId),
            sql`${mindFact.updatedAt} < now() - interval '${sql.raw(String(STALE_MIND_DAYS))} days'`,
          ),
        ),
    );
    add({
      id: 'mind.stale',
      severity: 'info',
      title: 'Memory is going stale',
      detail: `${plural(stale, 'fact has', 'facts have')} not been touched in ${STALE_MIND_DAYS} days. Agents read these before acting.`,
      count: stale,
      href: path('/mind'),
      resource: 'mind',
    });
  }

  // The member's own unread mentions and assignments. Personal rather than
  // project-wide, so it needs no resource permission.
  const mentions = await countRows(
    db
      .select({ count: sql<string>`count(*)` })
      .from(notification)
      .where(
        and(
          eq(notification.projectId, projectId),
          eq(notification.userId, userId),
          isNull(notification.readAt),
        ),
      ),
  );
  add({
    id: 'inbox.unread',
    severity: 'attention',
    title: 'Waiting on you',
    detail: `${plural(mentions, 'notification', 'notifications')} in your inbox you have not opened.`,
    count: mentions,
    href: path('/inbox'),
    resource: 'work_items',
  });

  const snoozes = await db
    .select({ signalId: commandCenterSnooze.signalId, until: commandCenterSnooze.until })
    .from(commandCenterSnooze)
    .where(
      and(
        eq(commandCenterSnooze.projectId, projectId),
        eq(commandCenterSnooze.userId, userId),
        sql`${commandCenterSnooze.until} > now()`,
      ),
    );
  const snoozed = new Map(snoozes.map((row) => [row.signalId, row.until.toISOString()]));
  for (const signal of signals) signal.snoozedUntil = snoozed.get(signal.id) ?? null;

  const rank = { critical: 0, attention: 1, info: 2 };
  signals.sort((a, b) => rank[a.severity] - rank[b.severity] || b.count - a.count);

  return {
    generatedAt: new Date().toISOString(),
    signals,
    focusId: signals.find((signal) => signal.snoozedUntil === null)?.id ?? null,
  };
}

export async function snoozeSignal(
  projectId: number,
  userId: string,
  signalId: string,
  until: Date,
): Promise<void> {
  await db
    .insert(commandCenterSnooze)
    .values({ projectId, userId, signalId, until })
    .onConflictDoUpdate({
      target: [
        commandCenterSnooze.projectId,
        commandCenterSnooze.userId,
        commandCenterSnooze.signalId,
      ],
      set: { until },
    });
}

export async function clearSnooze(
  projectId: number,
  userId: string,
  signalId: string,
): Promise<void> {
  await db
    .delete(commandCenterSnooze)
    .where(
      and(
        eq(commandCenterSnooze.projectId, projectId),
        eq(commandCenterSnooze.userId, userId),
        eq(commandCenterSnooze.signalId, signalId),
      ),
    );
}
