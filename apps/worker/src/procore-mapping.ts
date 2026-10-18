import type {
  CanonicalAttachment,
  CanonicalComment,
  CanonicalIssue,
  CanonicalState,
  CanonicalStateCategory,
} from './canonical';

// Pure mapping from Procore REST shapes (the punch item and RFI resources
// procore-adapter.ts reads) to the canonical import shapes. No network, no @repo/db.
// The field names follow docs/dev/procore-import.md; every field but `id` is read
// defensively because Procore's list and detail views differ.

export type ProcoreTool = 'punch_items' | 'rfis';

interface ProcorePerson {
  login?: string | null;
  email?: string | null;
  email_address?: string | null;
  name?: string | null;
  login_information?: { login?: string | null } | null;
}

export interface ProcoreAttachment {
  id: number | string;
  name?: string | null;
  filename?: string | null;
  url?: string | null;
  content_type?: string | null;
  size?: number | null;
}

interface ProcoreCommon {
  id: number | string;
  status?: string | null;
  description?: string | null;
  due_date?: string | null;
  priority?: string | { name?: string | null } | null;
  created_at?: string | null;
  updated_at?: string | null;
  attachments?: ProcoreAttachment[] | null;
}

export interface ProcorePunchItem extends ProcoreCommon {
  position?: number | null;
  name?: string | null;
  assignments?: ProcorePerson[] | null;
  punch_item_manager?: ProcorePerson | null;
}

export interface ProcoreReply {
  id: number | string;
  body?: string | null;
  plain_text_body?: string | null;
  created_at?: string | null;
  created_by?: ProcorePerson | null;
}

export interface ProcoreRfi extends ProcoreCommon {
  number?: number | string | null;
  full_number?: string | null;
  subject?: string | null;
  questions?: ProcoreReply[] | null;
  responses?: ProcoreReply[] | null;
  assignees?: ProcorePerson[] | null;
}

export type ProcoreItem = ProcorePunchItem | ProcoreRfi;

const PUNCH_STATES: [string, CanonicalStateCategory][] = [
  ['Draft', 'backlog'],
  ['Initiated', 'unstarted'],
  ['Open', 'unstarted'],
  ['Work Required', 'unstarted'],
  ['In Progress', 'started'],
  ['Ready for Review', 'started'],
  ['Work Not Accepted', 'started'],
  ['Ready to Close', 'started'],
  ['Closed', 'completed'],
];

const RFI_STATES: [string, CanonicalStateCategory][] = [
  ['Draft', 'backlog'],
  ['Open', 'started'],
  ['Closed', 'completed'],
  ['Void', 'canceled'],
];

export function procoreStateId(status: string | null | undefined): string {
  return (status ?? '').trim().toLowerCase().replace(/\s+/g, '-') || 'unknown';
}

export function procoreStates(tool: ProcoreTool): CanonicalState[] {
  return (tool === 'rfis' ? RFI_STATES : PUNCH_STATES).map(([name, category]) => ({
    sourceId: procoreStateId(name),
    name,
    category,
  }));
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

// Procore rich text is HTML; the import keeps its text and line breaks.
export function procoreHtmlToText(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|quot|nbsp|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function loginOf(person: ProcorePerson | null | undefined): string | null {
  const value =
    person?.login ?? person?.email ?? person?.email_address ?? person?.login_information?.login;
  return value && value.includes('@') ? value : null;
}

function firstLogin(
  people: (ProcorePerson | null | undefined)[] | null | undefined,
): string | null {
  return (people ?? []).map(loginOf).find(Boolean) ?? null;
}

export function procorePriority(priority: ProcoreCommon['priority']): string | null {
  const name = (typeof priority === 'string' ? priority : priority?.name)?.toLowerCase().trim();
  if (!name) return null;
  if (/urgent|critical|emergency/.test(name)) return 'urgent';
  if (/high/.test(name)) return 'high';
  if (/medium|normal/.test(name)) return 'medium';
  if (/low/.test(name)) return 'low';
  return null;
}

function numberOf(...values: (number | string | null | undefined)[]): number {
  for (const v of values) {
    const n = Number(v);
    if (v != null && v !== '' && Number.isInteger(n) && n >= 0) return n;
  }
  return 0;
}

function footer(label: string, id: number | string): string {
  return `Imported from Procore: ${label} (id ${id})`;
}

function common(item: ProcoreCommon, assignee: string | null, base: Partial<CanonicalIssue>) {
  const created = item.created_at ?? new Date(0).toISOString();
  return {
    sourceId: String(item.id),
    stateSourceId: procoreStateId(item.status),
    assigneeEmail: assignee,
    labelSourceIds: [],
    cycleSourceId: null,
    parentSourceId: null,
    priority: procorePriority(item.priority),
    startDate: null,
    dueDate: item.due_date?.slice(0, 10) ?? null,
    customFields: [],
    createdAt: created,
    updatedAt: item.updated_at ?? created,
    ...base,
  };
}

export function mapProcorePunchItem(item: ProcorePunchItem): CanonicalIssue {
  const description = [procoreHtmlToText(item.description), footer('punch item', item.id)]
    .filter(Boolean)
    .join('\n\n');
  return {
    ...common(item, firstLogin(item.assignments) ?? loginOf(item.punch_item_manager), {}),
    sequenceId: numberOf(item.position, item.id),
    title: item.name?.trim() || `Punch item ${item.id}`,
    descriptionMarkdown: description,
  };
}

// The question is the RFI's body; the answers are comments.
export function mapProcoreRfi(rfi: ProcoreRfi): CanonicalIssue {
  const question = (rfi.questions ?? [])
    .map((q) => procoreHtmlToText(q.plain_text_body || q.body))
    .filter(Boolean)
    .join('\n\n');
  const description = [procoreHtmlToText(rfi.description), question, footer('RFI', rfi.id)]
    .filter(Boolean)
    .join('\n\n');
  return {
    ...common(rfi, firstLogin(rfi.assignees), {}),
    sequenceId: numberOf(rfi.number, rfi.id),
    title: rfi.subject?.trim() || `RFI ${rfi.full_number ?? rfi.number ?? rfi.id}`,
    descriptionMarkdown: description,
  };
}

export function mapProcoreIssue(tool: ProcoreTool, item: ProcoreItem): CanonicalIssue {
  return tool === 'rfis'
    ? mapProcoreRfi(item as ProcoreRfi)
    : mapProcorePunchItem(item as ProcorePunchItem);
}

export function mapProcoreRfiReplies(rfi: ProcoreRfi): CanonicalComment[] {
  return [...(rfi.responses ?? [])]
    .map((r) => ({
      sourceId: String(r.id),
      authorEmail: loginOf(r.created_by),
      authorName: r.created_by?.name || 'Procore',
      bodyMarkdown: procoreHtmlToText(r.plain_text_body || r.body),
      createdAt: r.created_at ?? new Date(0).toISOString(),
      replyToSourceId: null,
    }))
    .filter((c) => c.bodyMarkdown !== '')
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export function mapProcoreAttachments(
  attachments: ProcoreAttachment[] | null | undefined,
): CanonicalAttachment[] {
  return (attachments ?? [])
    .filter((a) => a.url)
    .map((a) => ({
      sourceId: String(a.id),
      filename: a.filename || a.name || `attachment-${a.id}`,
      contentType: a.content_type || 'application/octet-stream',
      sizeBytes: a.size ?? 0,
    }));
}

// Procore pages with page/per_page and reports the totals in headers.
export function procoreNextPage(
  headers: Headers,
  page: number,
  perPage: number,
  received: number,
): number | null {
  const total = Number(headers.get('total'));
  const size = Number(headers.get('per-page')) || perPage;
  const more =
    headers.get('total') != null && Number.isFinite(total)
      ? page * size < total
      : received >= perPage;
  return more && received > 0 ? page + 1 : null;
}
