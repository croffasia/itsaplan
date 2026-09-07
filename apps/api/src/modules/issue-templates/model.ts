import { t } from 'elysia';

export const templateParams = t.Object({ projectKey: t.String(), templateId: t.Numeric() });

// An issue template DTO (IssueTemplateRow from the service).
export const IssueTemplateResponse = t.Object({
  id: t.Number(),
  name: t.String(),
  description: t.String(),
  titleTemplate: t.String(),
  descriptionTemplate: t.String(),
  typeId: t.Nullable(t.Number()),
  columnId: t.Nullable(t.Number()),
  priority: t.Nullable(t.String()),
  assigneeUserId: t.Nullable(t.String()),
  labelIds: t.Array(t.Number()),
});

export const IssueTemplateListResponse = t.Array(IssueTemplateResponse);

// Every property but the name is optional: one left out presets nothing, and the
// create dialog keeps its own default for it.
export const createIssueTemplateBody = t.Object({
  name: t.String({ minLength: 1 }),
  description: t.Optional(t.String()),
  titleTemplate: t.Optional(t.String()),
  descriptionTemplate: t.Optional(t.String()),
  typeId: t.Optional(t.Nullable(t.Integer())),
  columnId: t.Optional(t.Nullable(t.Integer())),
  priority: t.Optional(t.Nullable(t.String())),
  assigneeUserId: t.Optional(t.Nullable(t.String())),
  labelIds: t.Optional(t.Array(t.Integer())),
});

export const updateIssueTemplateBody = t.Partial(createIssueTemplateBody);
