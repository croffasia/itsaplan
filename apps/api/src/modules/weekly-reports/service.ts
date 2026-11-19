import { createHash } from 'node:crypto';
import {
  customField,
  db,
  issue,
  issueFieldValue,
  issueType,
  projectColumn,
  type DbExecutor,
} from '@repo/db';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { getDocument, insertDocument } from '#modules/documents/service';
import { MAX_DOCUMENT_MARKDOWN_LENGTH } from '#modules/documents/model';
import { isValidTimezone } from '#modules/user-preferences/service';
import { HttpError } from '#shared/lib';
import { getProjectSetting, setProjectSetting } from '#shared/project-settings';
import type { WeeklyReportSettings } from './model';
import { calculateProgress, reportDates, reportMarkdown, type ReportIssue } from './progress';

export const WEEKLY_REPORT_SETTING_KEY = 'weekly_report';
const WEEKLY_REPORT_LOCK_NAMESPACE = 1_873_270_361;

function bindingTypes(settings: WeeklyReportSettings) {
  return [settings.levelOneTypeId, settings.levelTwoTypeId, settings.levelThreeTypeId];
}

function fieldBindings(settings: WeeklyReportSettings) {
  const { levelTwoTypeId, levelThreeTypeId } = settings;
  return [
    { id: settings.levelTwoWeightId, issueTypeId: levelTwoTypeId, fieldType: 'number' },
    { id: settings.levelThreeWeightId, issueTypeId: levelThreeTypeId, fieldType: 'number' },
    { id: settings.completionRateId, issueTypeId: levelThreeTypeId, fieldType: 'number' },
    { id: settings.levelTwoReasonId, issueTypeId: levelTwoTypeId, fieldType: 'text' },
    { id: settings.levelThreeReasonId, issueTypeId: levelThreeTypeId, fieldType: 'text' },
  ];
}

async function validBindings(
  executor: DbExecutor,
  projectId: number,
  settings: WeeklyReportSettings,
) {
  const typeIds = bindingTypes(settings);
  if (
    new Set(typeIds).size !== typeIds.length ||
    settings.levelThreeWeightId === settings.completionRateId ||
    /^[+-]/.test(settings.timeZone) ||
    !isValidTimezone(settings.timeZone)
  ) {
    return false;
  }
  const bindings = fieldBindings(settings);
  const [types, fields] = await Promise.all([
    executor
      .select({ id: issueType.id })
      .from(issueType)
      .where(and(eq(issueType.projectId, projectId), inArray(issueType.id, typeIds))),
    executor
      .select({
        id: customField.id,
        issueTypeId: customField.issueTypeId,
        fieldType: customField.fieldType,
      })
      .from(customField)
      .where(
        and(
          eq(customField.projectId, projectId),
          inArray(
            customField.id,
            bindings.map(({ id }) => id),
          ),
        ),
      ),
  ]);
  return (
    types.length === typeIds.length &&
    bindings.every((binding) =>
      fields.some(
        (field) =>
          field.id === binding.id &&
          field.fieldType === binding.fieldType &&
          (field.issueTypeId === null || field.issueTypeId === binding.issueTypeId),
      ),
    )
  );
}

export function readWeeklyReportSettings(projectId: number, executor: DbExecutor = db) {
  return getProjectSetting<WeeklyReportSettings>(projectId, WEEKLY_REPORT_SETTING_KEY, executor);
}

export async function writeWeeklyReportSettings(projectId: number, settings: WeeklyReportSettings) {
  if (!(await validBindings(db, projectId, settings))) {
    throw new HttpError(
      400,
      'Choose distinct issue types, compatible fields and a valid time zone',
    );
  }
  await setProjectSetting(projectId, WEEKLY_REPORT_SETTING_KEY, settings);
  return settings;
}

async function reportIssues(
  executor: DbExecutor,
  projectId: number,
  settings: WeeklyReportSettings,
) {
  const rows = await executor
    .select({
      id: issue.id,
      title: issue.title,
      parentId: issue.parentId,
      typeId: issue.typeId,
      state: projectColumn.stateType,
      dueDate: issue.dueDate,
      field: {
        id: issueFieldValue.fieldId,
        number: issueFieldValue.valueNumber,
        text: issueFieldValue.valueText,
      },
    })
    .from(issue)
    .innerJoin(projectColumn, eq(projectColumn.id, issue.columnId))
    .leftJoin(
      issueFieldValue,
      and(
        eq(issueFieldValue.issueId, issue.id),
        inArray(
          issueFieldValue.fieldId,
          fieldBindings(settings).map(({ id }) => id),
        ),
      ),
    )
    .where(and(eq(issue.projectId, projectId), inArray(issue.typeId, bindingTypes(settings))))
    .orderBy(issue.id, issueFieldValue.fieldId);
  const issues = new Map<number, ReportIssue>();
  for (const { field, ...row } of rows) {
    let item = issues.get(row.id);
    if (!item) {
      item = { ...row, fields: new Map() };
      issues.set(row.id, item);
    }
    if (field) item.fields.set(field.id, field);
  }
  return [...issues.values()];
}

async function existingReport(
  executor: DbExecutor,
  projectId: number,
  weekStart: string,
  userId: string,
) {
  const [row] = await executor.execute<{ document_id: number }>(sql`
    select document_id from project_weekly_report
    where project_id = ${projectId} and week_start = ${weekStart}::date
  `);
  if (!row) return null;
  if (!(await getDocument(projectId, row.document_id, userId, executor))) {
    throw new HttpError(404, 'Weekly report document is unavailable');
  }
  return { status: 'saved' as const, documentId: row.document_id };
}

async function preview(
  executor: DbExecutor,
  projectId: number,
  settings: WeeklyReportSettings,
  { today, weekStart }: ReturnType<typeof reportDates>,
) {
  const report = calculateProgress(
    await reportIssues(executor, projectId, settings),
    settings,
    today,
  );
  const hash = createHash('sha256').update(JSON.stringify(report)).digest('hex');
  const token = `${weekStart}:${hash}`;
  return { status: 'preview' as const, weekStart, token, ...report };
}

export async function readWeeklyReport(
  projectId: number,
  userId: string,
  assertTaskAccess: () => Promise<void>,
  now = new Date(),
) {
  const settings = await readWeeklyReportSettings(projectId);
  if (!settings) return { status: 'setup' as const };
  const dates = reportDates(now, settings.timeZone);
  const saved = await existingReport(db, projectId, dates.weekStart, userId);
  if (saved) return saved;
  await assertTaskAccess();
  if (!(await validBindings(db, projectId, settings))) return { status: 'setup' as const };
  return preview(db, projectId, settings, dates);
}

export async function saveWeeklyReport(
  projectId: number,
  userId: string,
  token: string,
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(${WEEKLY_REPORT_LOCK_NAMESPACE}, ${projectId})`,
    );
    const settings = await readWeeklyReportSettings(projectId, tx);
    if (!settings) throw new HttpError(409, 'Configure the weekly report first');
    const dates = reportDates(now, settings.timeZone);
    if (!token.startsWith(`${dates.weekStart}:`)) {
      throw new HttpError(409, 'The report week changed. Refresh the preview');
    }
    const saved = await existingReport(tx, projectId, dates.weekStart, userId);
    if (saved) return saved;
    if (!(await validBindings(tx, projectId, settings))) {
      throw new HttpError(409, 'Update the weekly report settings first');
    }
    const report = await preview(tx, projectId, settings, dates);
    if (report.token !== token) throw new HttpError(409, 'The report changed. Refresh the preview');
    const content = reportMarkdown(report.groups);
    if (content.length > MAX_DOCUMENT_MARKDOWN_LENGTH) {
      throw new HttpError(400, 'The weekly report is too long for a document');
    }
    const document = await insertDocument(tx, {
      projectId,
      userId,
      title: `Weekly report · ${dates.weekStart}`,
      content,
      isLocked: true,
    });
    await tx.execute(sql`
      insert into project_weekly_report (project_id, week_start, document_id)
      values (${projectId}, ${dates.weekStart}::date, ${document.id})
    `);
    return { status: 'saved' as const, documentId: document.id };
  });
}
