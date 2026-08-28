import type { ParsedSheet } from '#modules/chat-attachments/parse';

// The column mapping an agent saves: which spreadsheet header feeds which issue
// field. Rows are never stored with the mapping — the confirm step re-reads the
// file and applies it, so what gets created is always the file's own content and
// never a model's transcription of it.

export const IMPORT_FIELDS = [
  'title',
  'description',
  'priority',
  'dueDate',
  'labels',
  'assignee',
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];

// field -> header name from the file. `title` must be mapped; everything else is
// optional and unknown keys are dropped.
export type ImportMapping = Partial<Record<ImportField, string>> & { title: string };

export interface MappingContext {
  labels: { id: number; name: string }[];
  members: { userId: string; name: string | null; email: string }[];
}

export interface ImportDraft {
  title: string;
  description?: string;
  priority?: string;
  dueDate?: string;
  labelIds?: number[];
  assigneeUserId?: string;
}

export interface AppliedRow {
  rowNumber: number;
  draft?: ImportDraft;
  reason?: string;
}

export function titleKey(title: string): string {
  return title.trim().toLowerCase();
}

function headerIndex(header: string, parsed: ParsedSheet): number {
  return parsed.headers.findIndex((h) => h.toLowerCase() === header.toLowerCase());
}

// The title of every row, normalised the way the duplicate check compares them.
export function titleKeys(
  parsed: ParsedSheet,
  mapping: Partial<Record<ImportField, string>>,
): string[] {
  const index = mapping.title ? headerIndex(mapping.title, parsed) : -1;
  if (index === -1) return [];
  return [...new Set(parsed.rows.map((row) => titleKey(row[index] ?? '')).filter(Boolean))];
}

// A title the project already holds or an earlier row of the same file already
// claimed. `taken` grows as rows claim theirs, so a repeat inside one file counts
// the same as a title that was already there.
export function duplicateTitle(title: string, taken: Set<string>): string | null {
  const key = titleKey(title);
  if (taken.has(key)) return 'An issue with this title exists';
  taken.add(key);
  return null;
}

function skipReason(item: AppliedRow | undefined, taken: Set<string>): string | null {
  if (!item) return null;
  if (!item.draft) return item.reason ?? null;
  return duplicateTitle(item.draft.title, taken);
}

// Cells are cut short: a preview line is one row of a table, not the whole
// description. `skip` is the reason confirmImport will pass the row over, from the
// same checks it runs, so the review shows what the confirm will do.
export function previewTable(
  parsed: ParsedSheet,
  mapping: Partial<Record<ImportField, string>>,
  existingTitles: Set<string>,
): {
  columns: { field: ImportField; header: string }[];
  rows: { cells: string[]; skip: string | null }[];
} {
  const columns = IMPORT_FIELDS.flatMap((field) => {
    const header = mapping[field];
    const index = header ? headerIndex(header, parsed) : -1;
    return index === -1 ? [] : [{ field, header: parsed.headers[index]!, index }];
  });
  const applied = columns.some((column) => column.field === 'title')
    ? applyMapping(parsed, mapping as ImportMapping, { labels: [], members: [] })
    : [];
  const taken = new Set(existingTitles);
  return {
    columns: columns.map(({ field, header }) => ({ field, header })),
    rows: parsed.rows.map((row, index) => ({
      cells: columns.map(({ index: column }) => (row[column] ?? '').slice(0, 200)),
      skip: skipReason(applied[index], taken),
    })),
  };
}

function cellFor(header: string, parsed: ParsedSheet): string[] {
  const index = headerIndex(header, parsed);
  if (index === -1) return [];
  return parsed.rows.map((row) => row[index] ?? '');
}

// A date is accepted as YYYY-MM-DD or anything Date.parse reads as a day; stored
// as the bare date the issue's date columns carry.
function parseDateCell(value: string): string | null {
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = value.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const time = Date.parse(value);
  if (!Number.isNaN(time)) return new Date(time).toISOString().slice(0, 10);
  return null;
}

export function validateMapping(input: unknown): ImportMapping {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('The mapping must be an object of field -> column header.');
  }
  const source = input as Record<string, unknown>;
  const mapping: Record<string, string> = {};
  for (const field of IMPORT_FIELDS) {
    const header = source[field];
    if (typeof header === 'string' && header.trim() !== '') mapping[field] = header.trim();
  }
  if (!mapping.title)
    throw new Error('Map a column for "title" — the one field every issue needs.');
  return mapping as ImportMapping;
}

// Applies the saved mapping to the whole file and returns one entry per row: the
// create input, or the reason the row was skipped. Values that do not resolve —
// an unknown priority is kept as written, an unknown label or assignee is dropped
// with a note on the row.
export function applyMapping(
  parsed: ParsedSheet,
  mapping: ImportMapping,
  ctx: MappingContext,
): AppliedRow[] {
  const titleCells = cellFor(mapping.title, parsed);
  if (titleCells.length === 0) {
    throw new Error(
      `Column "${mapping.title}" is not in the file anymore. Save the mapping again.`,
    );
  }

  return parsed.rows.map((_, index) => {
    const rowNumber = parsed.rowNumbers?.[index] ?? index + 1;
    const title = titleCells[index]?.trim();
    if (!title) return { rowNumber, reason: 'Empty title' };

    const draft: ImportDraft = { title };
    const description = mapping.description
      ? cellFor(mapping.description, parsed)[index]?.trim()
      : '';
    if (description) draft.description = description;
    const priority = mapping.priority ? cellFor(mapping.priority, parsed)[index]?.trim() : '';
    if (priority) draft.priority = priority;
    if (mapping.dueDate) {
      const raw = cellFor(mapping.dueDate, parsed)[index]?.trim() ?? '';
      const dueDate = raw ? parseDateCell(raw) : null;
      if (raw && !dueDate) return { rowNumber, reason: `"${raw}" is not a readable date` };
      if (dueDate) draft.dueDate = dueDate;
    }
    if (mapping.labels) {
      const names = (cellFor(mapping.labels, parsed)[index] ?? '')
        .split(/[,;]/)
        .map((name) => name.trim().toLowerCase())
        .filter(Boolean);
      const ids = [
        ...new Set(names.map((name) => ctx.labels.find((l) => l.name.toLowerCase() === name)?.id)),
      ].filter((id): id is number => id != null);
      if (ids.length > 0) draft.labelIds = ids;
    }
    if (mapping.assignee) {
      const who = cellFor(mapping.assignee, parsed)[index]?.trim().toLowerCase();
      if (who) {
        const member = ctx.members.find(
          (m) => m.email.toLowerCase() === who || m.name?.toLowerCase() === who,
        );
        if (member) draft.assigneeUserId = member.userId;
      }
    }
    return { rowNumber, draft };
  });
}
