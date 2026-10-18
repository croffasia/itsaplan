import { t } from 'elysia';
import { isoDate } from '#shared/schemas';

export const stateType = t.Union([
  t.Literal('backlog'),
  t.Literal('unstarted'),
  t.Literal('started'),
  t.Literal('completed'),
  t.Literal('canceled'),
]);

export const AiAssistSettingsResponse = t.Object({
  credentialId: t.Nullable(t.Integer()),
  model: t.Nullable(t.String()),
});

export const aiAssistSettingsBody = t.Object({
  credentialId: t.Nullable(t.Integer({ description: 'An LLM credential of the team, or null.' })),
  model: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
});

export const boardPromptBody = t.Object({
  prompt: t.String({ minLength: 1, maxLength: 2000 }),
});

const draftColumn = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
  stateType,
});

const draftIssue = t.Object({
  title: t.String({ minLength: 1, maxLength: 500 }),
  description: t.String({ maxLength: 5000 }),
  column: t.String({ maxLength: 100, description: 'Name of a draft column or an existing one.' }),
  dueDate: t.Nullable(isoDate("Due date 'YYYY-MM-DD', or null.")),
});

export const BoardDraft = t.Object({
  columns: t.Array(draftColumn, { maxItems: 12 }),
  issues: t.Array(draftIssue, { maxItems: 50 }),
});

export const AiAssistStatusResponse = t.Object({ enabled: t.Boolean() });

export const BoardApplyResponse = t.Object({
  columns: t.Integer(),
  issues: t.Integer(),
});

export const ChecklistDraft = t.Object({
  title: t.String({ minLength: 1, maxLength: 200 }),
  items: t.Array(t.String({ minLength: 1, maxLength: 500 }), { minItems: 1, maxItems: 30 }),
});
