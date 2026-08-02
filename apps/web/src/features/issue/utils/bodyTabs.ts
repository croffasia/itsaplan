// The tab values of the new issue body. The modal reads them back to find the
// editor an attachment should be inserted into, so the two sides share them
// instead of each spelling the strings out.
export const DESCRIPTION_TAB = 'description';

// Holds the body fields that are not markdown, so it has no editor.
export const OTHER_TAB = 'other';

const FIELD_TAB_PREFIX = 'field-';

export const fieldTab = (fieldId: number) => `${FIELD_TAB_PREFIX}${fieldId}`;

export function fieldTabId(tab: string): number | null {
  if (!tab.startsWith(FIELD_TAB_PREFIX)) return null;
  const id = Number(tab.slice(FIELD_TAB_PREFIX.length));
  return Number.isNaN(id) ? null : id;
}
