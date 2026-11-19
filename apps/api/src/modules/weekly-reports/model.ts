import { t } from 'elysia';

const id = t.Integer({ minimum: 1, maximum: 2_147_483_647 });

export const weeklyReportSettings = t.Object({
  levelOneTypeId: id,
  levelTwoTypeId: id,
  levelThreeTypeId: id,
  levelTwoWeightId: id,
  levelThreeWeightId: id,
  completionRateId: id,
  levelTwoReasonId: id,
  levelThreeReasonId: id,
  timeZone: t.String({ minLength: 1, maxLength: 64 }),
});

export type WeeklyReportSettings = typeof weeklyReportSettings.static;

export const WeeklyReportSettingsResponse = t.Object({
  settings: t.Nullable(weeklyReportSettings),
});

const progressRow = { id, title: t.String(), progress: t.Nullable(t.Number()) };

export const WarningKind = t.Union([
  t.Literal('noChildren'),
  t.Literal('weightTotal'),
  t.Literal('invalidWeight'),
  t.Literal('invalidRate'),
  t.Literal('missingReason'),
  t.Literal('unavailableChild'),
]);

export const SavedReport = t.Object({ status: t.Literal('saved'), documentId: id });

export const WeeklyReportResponse = t.Union([
  t.Object({ status: t.Literal('setup') }),
  SavedReport,
  t.Object({
    status: t.Literal('preview'),
    weekStart: t.String(),
    token: t.String(),
    groups: t.Array(
      t.Object({
        ...progressRow,
        nodes: t.Array(t.Object({ ...progressRow, reasons: t.Array(t.String()) })),
      }),
    ),
    warnings: t.Array(t.Object({ id, title: t.String(), kind: WarningKind })),
  }),
]);

export const confirmWeeklyReport = t.Object({
  token: t.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}:[0-9a-f]{64}$' }),
});
