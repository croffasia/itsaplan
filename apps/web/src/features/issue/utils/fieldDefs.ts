import { type CustomField } from '@/lib/api';

// The project scaffold carries every field of the project; a detail surface takes
// the project-wide ones plus the issue type's own.
export function fieldDefsForType(fields: CustomField[], typeId: number | null): CustomField[] {
  return fields.filter((f) => f.issueTypeId == null || f.issueTypeId === typeId);
}
