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
  t.Literal('member'),
]);

// Who a member field may hold: every candidate, the people only, or the agents only.
const memberScope = t.Union([t.Literal('all'), t.Literal('humans'), t.Literal('agents')]);

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
  memberScope: t.Nullable(memberScope),
  showInBody: t.Boolean(),
  position: t.Number(),
  options: t.Array(CustomFieldOptionResponse),
});

export const CustomFieldListResponse = t.Array(CustomFieldResponse);

export const createCustomFieldBody = t.Object({
  issueTypeId: t.Optional(t.Nullable(t.Integer())),
  name: t.String({ minLength: 1 }),
  fieldType,
  // Only read for a member field, where it defaults to 'all'.
  memberScope: t.Optional(memberScope),
  showInBody: t.Optional(t.Boolean()),
  options: t.Optional(t.Array(t.String({ minLength: 1 }))),
});

// One option on the way in: with an id it renames the option that carries it and
// keeps the issues that hold it; without one it is a new option. An option of the
// field left out of the array is deleted, along with the selections of it.
const updateFieldOption = t.Object({
  id: t.Optional(t.Integer()),
  value: t.String({ minLength: 1 }),
});

export const updateCustomFieldBody = t.Object({
  name: t.Optional(t.String({ minLength: 1 })),
  showInBody: t.Optional(t.Boolean()),
  // Changing the type clears the values issues hold in this field: they are stored
  // in the column of the type they were written under.
  fieldType: t.Optional(fieldType),
  // Read for a member field. Narrowing the scope clears the values it no longer
  // allows; the rest are kept.
  memberScope: t.Optional(memberScope),
  // The full option list of a select field, in display order.
  options: t.Optional(t.Array(updateFieldOption)),
});
