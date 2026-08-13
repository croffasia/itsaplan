import { t } from 'elysia';

const fieldType = t.Union([
  t.Literal('text'),
  t.Literal('markdown'),
  t.Literal('url'),
  t.Literal('number'),
  t.Literal('boolean'),
  t.Literal('date'),
  t.Literal('datetime'),
  t.Literal('datetime_range'),
  t.Literal('select'),
  t.Literal('multi_select'),
]);

export const fieldParams = t.Object({ projectKey: t.String(), fieldId: t.Numeric() });

export const listFieldsQuery = t.Object({ issueTypeId: t.Optional(t.Numeric()) });

// A field option DTO (CustomFieldOptionRow from the service).
const CustomFieldOptionResponse = t.Object({
  id: t.Number(),
  value: t.String(),
  color: t.String(),
  position: t.Number(),
});

// A custom field DTO (CustomFieldRow from the service).
export const CustomFieldResponse = t.Object({
  id: t.Number(),
  issueTypeId: t.Nullable(t.Number()),
  name: t.String(),
  fieldType,
  showInBody: t.Boolean(),
  position: t.Number(),
  options: t.Array(CustomFieldOptionResponse),
});

export const CustomFieldListResponse = t.Array(CustomFieldResponse);

export const createCustomFieldBody = t.Object({
  issueTypeId: t.Optional(t.Nullable(t.Integer())),
  name: t.String({ minLength: 1 }),
  fieldType,
  showInBody: t.Optional(t.Boolean()),
  options: t.Optional(t.Array(t.String({ minLength: 1 }))),
});

// Only the two fields an existing field lets you change; its type and options are fixed.
export const updateCustomFieldBody = t.Object({
  name: t.Optional(t.String({ minLength: 1 })),
  showInBody: t.Optional(t.Boolean()),
});
