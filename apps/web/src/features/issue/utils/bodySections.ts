// The sections of the new issue body. The modal reads them back to find the
// editor an attachment should be inserted into, so the two sides share them
// instead of each spelling the strings out.
export const DESCRIPTION_SECTION = 'description';

// Holds the body fields that are not markdown, so it has no editor.
export const OTHER_SECTION = 'other';

const FIELD_SECTION_PREFIX = 'field-';

export const fieldSection = (fieldId: number) => `${FIELD_SECTION_PREFIX}${fieldId}`;

export function fieldSectionId(section: string): number | null {
  if (!section.startsWith(FIELD_SECTION_PREFIX)) return null;
  const id = Number(section.slice(FIELD_SECTION_PREFIX.length));
  return Number.isNaN(id) ? null : id;
}
