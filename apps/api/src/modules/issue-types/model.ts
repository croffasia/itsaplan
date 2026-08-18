import { t } from 'elysia';

export const issueTypeParams = t.Object({ projectKey: t.String(), typeId: t.Numeric() });

export const IssueTypeResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  name: t.String(),
  icon: t.String(),
  color: t.String(),
  isDefault: t.Boolean(),
  position: t.Number(),
});

export const createIssueTypeBody = t.Object({
  name: t.String({ minLength: 1 }),
  icon: t.Optional(t.String()),
  color: t.Optional(t.String()),
  isDefault: t.Optional(t.Boolean()),
});

// The icon is fixed at creation, so it is not part of the patch.
export const updateIssueTypeBody = t.Object({
  name: t.Optional(t.String({ minLength: 1 })),
  color: t.Optional(t.String()),
  isDefault: t.Optional(t.Boolean()),
});
