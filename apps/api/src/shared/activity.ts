import { t } from 'elysia';

// The response mirror of ActivityPayload in @repo/db, used by the three feeds that
// return a change-log entry: the issue feed, the initiative feed and the
// project-wide activity feed.
const ActivitySide = t.Object({
  value: t.Nullable(t.String()),
  // The row behind the text, when the side names one. A user id is a string.
  id: t.Optional(t.Nullable(t.Union([t.Number(), t.String()]))),
  // 'status' carries the state type the column had at the moment of the move.
  stateType: t.Optional(t.Nullable(t.String())),
  // 'git_pr' carries the repository and the number behind "owner/repo#42".
  repo: t.Optional(t.String()),
  number: t.Optional(t.Number()),
  // 'worklog' carries the day its time was spent on, per side.
  date: t.Optional(t.Nullable(t.String())),
});

export const ActivityPayloadResponse = t.Object({
  subject: t.Optional(ActivitySide),
  from: t.Optional(ActivitySide),
  to: t.Optional(ActivitySide),
});
