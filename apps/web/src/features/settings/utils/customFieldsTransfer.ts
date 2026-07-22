// Serialize/parse a project's custom fields for the copy/paste transfer between
// projects. The payload holds each field with its scope named by the issue type (null
// for a global field) and, for select fields, its option values. Matching is by name
// within a scope: an existing field is left as is (its type and options cannot be
// changed after creation), a missing one is created, and a referenced issue type that
// does not exist yet is created first.

import type { CustomField, CustomFieldType, IssueType } from '@/lib/api';

const PAYLOAD_TYPE = 'plan.custom-fields';
const PAYLOAD_VERSION = 1;

export interface FieldTransfer {
  name: string;
  fieldType: CustomFieldType;
  showInBody: boolean;
  options: string[];
  // The issue type's name this field is scoped to, or null for a global field.
  type: string | null;
}

interface CustomFieldsEnvelope {
  type: typeof PAYLOAD_TYPE;
  version: number;
  fields: FieldTransfer[];
}

export interface PlannedField extends FieldTransfer {
  action: 'create' | 'skip';
}

export interface CustomFieldsImportPlan {
  // Issue type names referenced by the fields that do not exist yet and will be created.
  newTypeNames: string[];
  fields: PlannedField[];
}

const FIELD_TYPES: CustomFieldType[] = [
  'text',
  'markdown',
  'url',
  'number',
  'boolean',
  'date',
  'select',
  'multi_select',
];

// The clipboard text for the project's custom fields. When includeTypeScoped is false,
// only global fields are exported.
export function serializeCustomFields(
  fields: CustomField[],
  typeNameById: Map<number, string>,
  includeTypeScoped: boolean,
): string {
  const chosen = includeTypeScoped ? fields : fields.filter((f) => f.issueTypeId == null);
  const envelope: CustomFieldsEnvelope = {
    type: PAYLOAD_TYPE,
    version: PAYLOAD_VERSION,
    fields: chosen.map((f) => ({
      name: f.name,
      fieldType: f.fieldType,
      showInBody: f.showInBody,
      options: f.options.map((o) => o.value),
      type: f.issueTypeId != null ? (typeNameById.get(f.issueTypeId) ?? null) : null,
    })),
  };
  return JSON.stringify(envelope, null, 2);
}

// Parses clipboard text into fields, or throws with a user-facing message.
export function parseCustomFieldsText(text: string): FieldTransfer[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Clipboard does not contain valid JSON.');
  }
  const env = data as Partial<CustomFieldsEnvelope>;
  if (!env || env.type !== PAYLOAD_TYPE || !Array.isArray(env.fields)) {
    throw new Error('Clipboard does not contain a custom fields export.');
  }
  const fields: FieldTransfer[] = [];
  for (const raw of env.fields) {
    const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
    if (!name || !FIELD_TYPES.includes(raw?.fieldType as CustomFieldType)) continue;
    const type = typeof raw?.type === 'string' && raw.type.trim() ? raw.type.trim() : null;
    fields.push({
      name,
      fieldType: raw.fieldType as CustomFieldType,
      showInBody: raw?.showInBody === true,
      options: Array.isArray(raw?.options)
        ? raw.options.filter((o): o is string => typeof o === 'string')
        : [],
      type,
    });
  }
  if (fields.length === 0) throw new Error('The custom fields export is empty.');
  return fields;
}

// Decides what applying the incoming fields does: which referenced issue types are
// missing (to be created), and for each field whether it is created or skipped (a field
// with the same name already exists in its scope).
export function planCustomFieldsImport(
  incoming: FieldTransfer[],
  existingTypes: IssueType[],
  existingFields: CustomField[],
): CustomFieldsImportPlan {
  const typeIdByName = new Map(existingTypes.map((t) => [t.name.toLowerCase(), t.id]));
  // Existing field keys, namespaced by scope: "<typeId|global>:<name>".
  const fieldKey = (scope: number | null, name: string) =>
    `${scope ?? 'global'}:${name.toLowerCase()}`;
  const existingKeys = new Set(existingFields.map((f) => fieldKey(f.issueTypeId, f.name)));

  const newTypeNames: string[] = [];
  const seenMissingType = new Set<string>();
  const fields: PlannedField[] = incoming.map((field) => {
    if (field.type == null) {
      const action = existingKeys.has(fieldKey(null, field.name)) ? 'skip' : 'create';
      return { ...field, action };
    }
    const typeId = typeIdByName.get(field.type.toLowerCase());
    if (typeId == null) {
      // The type does not exist yet; it will be created, so the field is new too.
      if (!seenMissingType.has(field.type.toLowerCase())) {
        seenMissingType.add(field.type.toLowerCase());
        newTypeNames.push(field.type);
      }
      return { ...field, action: 'create' };
    }
    const action = existingKeys.has(fieldKey(typeId, field.name)) ? 'skip' : 'create';
    return { ...field, action };
  });

  return { newTypeNames, fields };
}
