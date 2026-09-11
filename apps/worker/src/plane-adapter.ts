import { pinnedFetch } from '@repo/net';
import type { Page, SourceReader } from './reader';
import type {
  CanonicalState,
  CanonicalStateCategory,
  CanonicalLabel,
  CanonicalCycle,
  CanonicalIssue,
  CanonicalRelation,
  CanonicalComment,
  CanonicalAttachment,
} from './canonical';

// The concrete SourceReader for Plane (docs/dev/plane-import-source-notes.md is
// the spec this file follows). Base URL, workspace slug and API key come from
// the operator's own decrypted credential (import-store.ts), never from env —
// this has to work against any self-hosted instance, not one fixed one.

export interface PlaneCredential {
  baseUrl: string;
  workspaceSlug: string;
  apiKey: string;
}

const PER_PAGE = 100;

// Thrown when Plane's rate limit is hit (or about to be): x-ratelimit-remaining
// reaches 0, or a 429 arrives. The worker catches this and reschedules the job
// instead of treating it as a failed attempt.
export class PlaneRateLimitedError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super('Plane rate limit reached');
  }
}

// A 404 confirmed live to mean "this Plane version doesn't have this
// endpoint" (custom properties, work item types, ...) rather than a broken
// import, when it happens on one of those. Nothing catches it specially yet —
// it currently propagates like any other failure — because this milestone
// doesn't call those version-dependent endpoints (custom fields are not
// imported yet).
export class PlaneNotFoundError extends Error {}

// Plane's GroupEnum uses British spelling ('cancelled') and adds 'triage',
// which itsaplan's project_column.state_type has no equivalent for.
const STATE_CATEGORY_MAP: Record<string, CanonicalStateCategory> = {
  backlog: 'backlog',
  unstarted: 'unstarted',
  started: 'started',
  completed: 'completed',
  cancelled: 'canceled',
  triage: 'backlog',
};

export function normalizeStateCategory(planeGroup: string): CanonicalStateCategory {
  return STATE_CATEGORY_MAP[planeGroup] ?? 'backlog';
}

// Plane's WorkItemRelationTypeEnum. start_before/after and finish_before/after
// are Gantt-style scheduling dependencies with no destination in itsaplan's
// schema at all, so they are dropped rather than mapped.
const RELATION_KIND_MAP: Record<string, CanonicalRelation['kind']> = {
  blocking: 'blocks',
  blocked_by: 'blocks',
  duplicate: 'duplicates',
  relates_to: 'relates',
};

// Whether next_page_results says there is another page to fetch — the only
// correct loop-termination signal (not "fewer than per_page came back", not
// "cursor unchanged"). Isolated as a pure function because getting this wrong
// silently drops results with no error (confirmed live, see the notes file).
export function nextPageCursor(nextCursor: string | null, hasNextPage: boolean): string | null {
  return hasNextPage ? nextCursor : null;
}

// x-ratelimit-remaining / x-ratelimit-reset are on every response; a 429 was
// never observed live, so Retry-After on it is handled but unconfirmed. Pure
// so the three trigger conditions (Retry-After, 429, remaining-hits-zero) are
// each unit-testable without a network call.
export function rateLimitBackoffMs(
  headers: {
    status: number;
    remaining: string | null;
    resetEpochSec: string | null;
    retryAfterSec: string | null;
  },
  nowMs = Date.now(),
): number | null {
  if (headers.retryAfterSec) return Math.max(1, Number(headers.retryAfterSec)) * 1000;
  if (headers.status === 429) return 60_000;
  if (headers.remaining === '0') {
    if (headers.resetEpochSec) {
      return Math.max(1000, Number(headers.resetEpochSec) * 1000 - nowMs);
    }
    return 60_000;
  }
  return null;
}

// Minimal HTML-to-markdown conversion for description_html (Tiptap-flavored
// markup, confirmed live — see "Descriptions" in the notes file). No
// HTML-to-markdown library is already a dependency anywhere in the monorepo
// (marked is markdown-to-HTML; tiptap-markdown needs a browser editor
// instance), so this is a small tag-by-tag pass rather than a new dependency
// for one conversion. Best-effort: nested structures beyond one level (a list
// inside a blockquote, say) are not guaranteed to round-trip perfectly.
export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  let out = html;

  // Fenced code blocks first, so their content is not touched by the inline
  // and entity passes below.
  out = out.replace(
    /<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi,
    (_m, body: string) => `\n\`\`\`\n${decodeEntities(stripTags(body))}\n\`\`\`\n`,
  );
  out = out.replace(
    /<code[^>]*>([\s\S]*?)<\/code>/gi,
    (_m, body: string) => `\`${stripTags(body)}\``,
  );

  out = out.replace(
    /<img[^>]*\balt="([^"]*)"[^>]*\bsrc="([^"]*)"[^>]*>/gi,
    (_m, alt: string, src: string) => `![${alt}](${src})`,
  );
  out = out.replace(
    /<img[^>]*\bsrc="([^"]*)"[^>]*\balt="([^"]*)"[^>]*>/gi,
    (_m, src: string, alt: string) => `![${alt}](${src})`,
  );
  out = out.replace(/<img[^>]*\bsrc="([^"]*)"[^>]*>/gi, (_m, src: string) => `![](${src})`);
  out = out.replace(
    /<a[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    (_m, href: string, text: string) => `[${stripTags(text)}](${href})`,
  );

  out = out.replace(
    /<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi,
    (_m, _tag, text: string) => `**${text}**`,
  );
  out = out.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _tag, text: string) => `*${text}*`);

  // Task-list items (Tiptap: <li data-checked="true|false">) before plain
  // list items, so the checkbox marker is not lost to the generic <li> rule.
  out = out.replace(
    /<li[^>]*\bdata-checked="(true|false)"[^>]*>([\s\S]*?)<\/li>/gi,
    (_m, checked: string, text: string) =>
      `\n- [${checked === 'true' ? 'x' : ' '}] ${stripTags(text).trim()}`,
  );
  out = out.replace(
    /<li[^>]*>([\s\S]*?)<\/li>/gi,
    (_m, text: string) => `\n- ${stripTags(text).trim()}`,
  );
  out = out.replace(/<\/?(ul|ol)[^>]*>/gi, '\n');

  for (let level = 6; level >= 1; level--) {
    const tag = `h${level}`;
    out = out.replace(
      new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi'),
      (_m, text: string) => `\n${'#'.repeat(level)} ${stripTags(text).trim()}\n`,
    );
  }

  out = out.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, text: string) => {
    const lines = stripTags(text).trim().split('\n');
    return `\n${lines.map((line) => `> ${line}`).join('\n')}\n`;
  });

  out = out.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_m, text: string) => `\n${text.trim()}\n`);
  out = out.replace(/<br\s*\/?>/gi, '\n');
  out = out.replace(/<hr\s*\/?>/gi, '\n---\n');

  out = decodeEntities(stripTags(out));
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

interface PlaneMember {
  id: string;
  email: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
}

interface PlaneListEnvelope<T> {
  results: T[];
  next_cursor: string | null;
  next_page_results: boolean;
}

export class PlaneReader implements SourceReader {
  private membersPromise: Promise<Map<string, PlaneMember>> | null = null;

  constructor(
    private readonly credential: PlaneCredential,
    private readonly projectId: string,
  ) {}

  async listStates(): Promise<CanonicalState[]> {
    const rows = await this.getResults<{ id: string; name: string; group: string }>('/states/');
    return rows.map((s) => ({
      sourceId: s.id,
      name: s.name,
      category: normalizeStateCategory(s.group),
    }));
  }

  async listLabels(): Promise<CanonicalLabel[]> {
    const rows = await this.getResults<{ id: string; name: string; color?: string }>('/labels/');
    return rows.map((l) => ({ sourceId: l.id, name: l.name, color: l.color }));
  }

  async listCycles(): Promise<CanonicalCycle[]> {
    const rows = await this.getResults<{
      id: string;
      name: string;
      start_date: string | null;
      end_date: string | null;
      description?: string;
    }>('/cycles/');
    // Cycles carry full timestamps, not dates; itsaplan's cycle.startDate/
    // endDate are date-only so the time of day is dropped here.
    return rows
      .filter((c) => c.start_date && c.end_date)
      .map((c) => ({
        sourceId: c.id,
        name: c.name,
        startDate: dateOnly(c.start_date!),
        endDate: dateOnly(c.end_date!),
        goal: c.description || undefined,
      }));
  }

  async listIssues(cursor: string | null): Promise<Page<CanonicalIssue>> {
    const query = `per_page=${PER_PAGE}&expand=assignees,labels,state${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    const envelope = await this.getJson<PlaneListEnvelope<PlaneWorkItem>>(`/work-items/?${query}`);
    return {
      items: envelope.results.map(mapWorkItem),
      cursor: nextPageCursor(envelope.next_cursor, envelope.next_page_results),
    };
  }

  async getIssue(sourceId: string): Promise<CanonicalIssue> {
    const raw = await this.getJson<PlaneWorkItem>(
      `/work-items/${sourceId}/?expand=assignees,labels,state`,
    );
    return mapWorkItem(raw);
  }

  async listIssueRelations(issueSourceId: string): Promise<CanonicalRelation[]> {
    // Not a list: one array per relation kind, each holding the related issue's
    // id directly (confirmed live) — {blocking: [...], blocked_by: [...], ...},
    // not {relation_type, related_work_item}[].
    const grouped = await this.getJson<Record<string, string[]>>(
      `/work-items/${issueSourceId}/relations/`,
    );
    return Object.entries(grouped).flatMap(([planeKind, targetIds]) => {
      const kind = RELATION_KIND_MAP[planeKind];
      if (!kind) return [];
      return targetIds.map((targetIssueSourceId) => ({
        kind,
        sourceIssueSourceId: issueSourceId,
        targetIssueSourceId,
      }));
    });
  }

  async listIssueComments(issueSourceId: string): Promise<CanonicalComment[]> {
    const rows = await this.getResults<{
      id: string;
      comment_html: string;
      created_by: string;
      created_at: string;
      reply_to_comment?: string | null;
    }>(`/work-items/${issueSourceId}/comments/`);
    if (rows.length === 0) return [];
    const members = await this.members();
    return rows.map((c) => {
      const author = members.get(c.created_by);
      return {
        sourceId: c.id,
        authorEmail: author?.email ?? null,
        authorName: author ? memberName(author) : 'Unknown',
        bodyMarkdown: htmlToMarkdown(c.comment_html),
        createdAt: c.created_at,
        replyToSourceId: c.reply_to_comment ?? null,
      };
    });
  }

  async listIssueAttachments(issueSourceId: string): Promise<CanonicalAttachment[]> {
    const rows = await this.getJson<{ id: string; attributes: { name: string; type: string } }[]>(
      `/work-items/${issueSourceId}/attachments/`,
    );
    return rows.map((a) => ({
      sourceId: a.id,
      filename: a.attributes.name,
      contentType: a.attributes.type,
    }));
  }

  // members/ is flat, unpaginated, and carries email directly — exactly what
  // comment authors (bare user ids, since expand does not reach the comments
  // endpoint) need to be matched against. Fetched once per job run and cached.
  private members(): Promise<Map<string, PlaneMember>> {
    if (!this.membersPromise) {
      this.membersPromise = this.getJson<PlaneMember[]>('/members/').then(
        (rows) => new Map(rows.map((m) => [m.id, m])),
      );
    }
    return this.membersPromise;
  }

  private async getJson<T>(path: string): Promise<T> {
    const res = await this.request(path);
    return (await res.json()) as T;
  }

  // states/, labels/ and cycles/ are the same paginated envelope as work-items,
  // confirmed live — not the bare array members/ returns. Small enough lists
  // that the default per_page covers them in one page.
  private async getResults<T>(path: string): Promise<T[]> {
    return (await this.getJson<PlaneListEnvelope<T>>(path)).results;
  }

  private async request(path: string): Promise<Response> {
    const base = this.credential.baseUrl.replace(/\/$/, '');
    const url = `${base}/api/v1/workspaces/${this.credential.workspaceSlug}/projects/${this.projectId}${path}`;
    const res = await pinnedFetch(url, {
      headers: { 'X-Api-Key': this.credential.apiKey },
      timeoutMs: 15_000,
    });
    const backoff = rateLimitBackoffMs({
      status: res.status,
      remaining: res.headers.get('x-ratelimit-remaining'),
      resetEpochSec: res.headers.get('x-ratelimit-reset'),
      retryAfterSec: res.headers.get('retry-after'),
    });
    if (backoff !== null) throw new PlaneRateLimitedError(backoff);
    if (res.status === 404) throw new PlaneNotFoundError(path);
    if (!res.ok) throw new Error(`Plane request failed: GET ${path} -> HTTP ${res.status}`);
    return res;
  }
}

function memberName(m: PlaneMember): string {
  return m.display_name || [m.first_name, m.last_name].filter(Boolean).join(' ') || m.email;
}

function dateOnly(isoTimestamp: string): string {
  return isoTimestamp.slice(0, 10);
}

// Plane's work-item shape. title/cycle/parent/due-date field names below are a
// best-effort reading (name / cycle_id / parent_id / target_date) — the notes
// file confirms description_html, state, assignees and labels live but does
// not pin these down; verify against a live response if issues import with an
// empty title, or a missing cycle/parent/due date.
interface PlaneWorkItem {
  id: string;
  name?: string;
  title?: string;
  sequence_id: number;
  description_html: string;
  state?: { id: string } | string;
  assignees?: ({ email: string } | string)[];
  labels?: ({ id: string } | string)[];
  cycle_id?: string | null;
  cycle?: string | null;
  parent_id?: string | null;
  parent?: string | null;
  priority?: string | null;
  start_date?: string | null;
  target_date?: string | null;
  due_date?: string | null;
  created_at: string;
  updated_at: string;
}

function mapWorkItem(raw: PlaneWorkItem): CanonicalIssue {
  return {
    sourceId: raw.id,
    sequenceId: raw.sequence_id,
    title: raw.name ?? raw.title ?? '',
    descriptionMarkdown: htmlToMarkdown(raw.description_html),
    stateSourceId: typeof raw.state === 'string' ? raw.state : (raw.state?.id ?? ''),
    assigneeEmail: firstAssigneeEmail(raw.assignees),
    labelSourceIds: (raw.labels ?? []).map((l) => (typeof l === 'string' ? l : l.id)),
    cycleSourceId: raw.cycle_id ?? raw.cycle ?? null,
    parentSourceId: raw.parent_id ?? raw.parent ?? null,
    priority: raw.priority ?? null,
    startDate: raw.start_date ?? null,
    dueDate: raw.target_date ?? raw.due_date ?? null,
    // Custom fields are not read by this adapter: Plane scopes them to a work
    // item type with no project-wide list endpoint, and 404s outright on a
    // real self-hosted instance (see "Custom properties" in the notes file).
    customFields: [],
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function firstAssigneeEmail(assignees: PlaneWorkItem['assignees']): string | null {
  const first = assignees?.[0];
  if (!first) return null;
  return typeof first === 'string' ? null : first.email;
}
