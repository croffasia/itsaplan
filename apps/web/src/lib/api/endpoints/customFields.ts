import { request } from '@/lib/api/core/client';

export type CustomFieldType =
  | 'text'
  | 'markdown'
  | 'url'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'datetime_range'
  | 'select'
  | 'multi_select'
  | 'member';

// Who a member field may hold: every candidate, the people only, or the agents only.
// Null for every other field type.
export type MemberScope = 'all' | 'humans' | 'agents';

export interface CustomFieldOption {
  id: number;
  value: string;
  color: string;
  position: number;
}

export interface CustomField {
  id: number;
  issueTypeId: number | null;
  name: string;
  fieldType: CustomFieldType;
  memberScope: MemberScope | null;
  // When true the field renders in the issue body (under the description);
  // when false it renders as a Properties row.
  showInBody: boolean;
  position: number;
  options: CustomFieldOption[];
}

// A field can be reshaped after it exists, and the values issues hold follow: a new
// fieldType clears them, a narrowed memberScope clears the ones it no longer allows,
// and an option missing from `options` is deleted along with the selections of it.
export interface CustomFieldPatch {
  name?: string;
  showInBody?: boolean;
  fieldType?: CustomFieldType;
  memberScope?: MemberScope;
  // The full option list of a select field, in display order. An entry with an id
  // renames that option; one without is new.
  options?: { id?: number; value: string }[];
}

export interface NewCustomFieldInput {
  issueTypeId?: number | null;
  name: string;
  fieldType: CustomFieldType;
  memberScope?: MemberScope;
  showInBody?: boolean;
  options?: string[];
}

export const createCustomField = (projectKey: string, input: NewCustomFieldInput) =>
  request<CustomField>(`/projects/${projectKey}/custom-fields`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateCustomField = (projectKey: string, fieldId: number, patch: CustomFieldPatch) =>
  request<CustomField>(`/projects/${projectKey}/custom-fields/${fieldId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });

export const deleteCustomField = (projectKey: string, fieldId: number) =>
  request<void>(`/projects/${projectKey}/custom-fields/${fieldId}`, { method: 'DELETE' });
