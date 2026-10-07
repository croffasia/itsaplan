import type {
  CanonicalAttachment,
  CanonicalComment,
  CanonicalCycle,
  CanonicalIssue,
  CanonicalLabel,
  CanonicalRelation,
  CanonicalState,
  CanonicalStateCategory,
} from './canonical';

// Pure mapping from Linear's GraphQL shapes (the fields linear-adapter.ts asks for)
// to the canonical import shapes. No network, no @repo/db.

export interface LinearPageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface LinearConnection<T> {
  nodes: T[];
  pageInfo: LinearPageInfo;
}

export interface LinearStateNode {
  id: string;
  name: string;
  type: string;
}

export interface LinearLabelNode {
  id: string;
  name: string;
  color: string;
  isGroup: boolean;
  parent: { name: string } | null;
}

export interface LinearCycleNode {
  id: string;
  number: number;
  name: string | null;
  startsAt: string;
  endsAt: string;
  description: string | null;
}

export interface LinearIssueRef {
  id: string;
  identifier: string;
  team: { id: string };
  project: { id: string } | null;
}

export interface LinearLinkNode {
  title: string;
  url: string;
}

export interface LinearIssueNode {
  id: string;
  identifier: string;
  number: number;
  title: string;
  description: string | null;
  priority: number;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  trashed?: boolean | null;
  state: { id: string };
  assignee: { email: string } | null;
  cycle: { id: string } | null;
  parent: LinearIssueRef | null;
  labels: { nodes: { id: string }[]; pageInfo?: { hasNextPage: boolean } };
  attachments: { nodes: LinearLinkNode[]; pageInfo?: { hasNextPage: boolean } };
}

export interface LinearCommentNode {
  id: string;
  body: string;
  createdAt: string;
  parent: { id: string } | null;
  user: { email: string; name: string } | null;
  botActor: { name: string | null } | null;
  externalUser: { name: string } | null;
}

export interface LinearRelationNode {
  type: string;
  relatedIssue: { id: string };
}

// One import job: a team, and either one of its projects or its issues with no project.
export interface LinearScope {
  teamId: string;
  projectFilter: 'project' | 'none';
  projectId: string | null;
}

// Linear's WorkflowState.type. triage and duplicate have no itsaplan category of
// their own; the mapping review step can still change either.
const STATE_CATEGORY_MAP: Record<string, CanonicalStateCategory> = {
  triage: 'backlog',
  backlog: 'backlog',
  unstarted: 'unstarted',
  started: 'started',
  completed: 'completed',
  canceled: 'canceled',
  duplicate: 'canceled',
};

export function linearStateCategory(type: string): CanonicalStateCategory {
  return STATE_CATEGORY_MAP[type] ?? 'backlog';
}

export function mapLinearStates(nodes: LinearStateNode[]): CanonicalState[] {
  return nodes.map((s) => ({
    sourceId: s.id,
    name: s.name,
    category: linearStateCategory(s.type),
  }));
}

// Linear: 0 none, 1 urgent, 2 high, 3 medium, 4 low. itsaplan stores the word, or null.
const PRIORITIES: Record<number, string> = { 1: 'urgent', 2: 'high', 3: 'medium', 4: 'low' };

export function linearPriority(priority: number): string | null {
  return PRIORITIES[priority] ?? null;
}

// A label group is never applied to an issue itself, so only its members are
// imported, each named after its group.
export function mapLinearLabels(nodes: LinearLabelNode[]): CanonicalLabel[] {
  return nodes
    .filter((l) => !l.isGroup)
    .map((l) => ({
      sourceId: l.id,
      name: l.parent ? `${l.parent.name}/${l.name}` : l.name,
      color: l.color,
    }));
}

// The store reuses a cycle by name within a project, so every name in one list must be
// distinct (case-insensitively), or two Linear cycles would merge into one.
export function mapLinearCycles(nodes: LinearCycleNode[]): CanonicalCycle[] {
  const taken = new Set<string>();
  return nodes.map((c) => {
    const base = c.name?.trim() || `Cycle ${c.number}`;
    let name = base;
    for (let n = 1; taken.has(name.toLowerCase()); n++) {
      name = n === 1 ? `${base} (Cycle ${c.number})` : `${base} (Cycle ${c.number}, ${n})`;
    }
    taken.add(name.toLowerCase());
    return mapCycle(c, name);
  });
}

function mapCycle(c: LinearCycleNode, name: string): CanonicalCycle {
  return {
    sourceId: c.id,
    name,
    startDate: c.startsAt.slice(0, 10),
    endDate: c.endsAt.slice(0, 10),
    goal: c.description || undefined,
  };
}

// "https://linear.app/acme/issue/ATO-12/some-slug" and its markdown forms. The
// Rewrite phase can only resolve a bare "ATO-12": inside a URL it would rewrite the
// path and break the link.
const ISSUE_URL = String.raw`https://linear\.app/[\w-]+/issue/([A-Z][A-Z0-9]*-\d+)(?:/[\w%-]*)?(?:[?#][^\s)>\]]*)?`;
const ISSUE_LINK = new RegExp(String.raw`\[([^\]]*)\]\(${ISSUE_URL}\)`, 'g');
const ISSUE_AUTOLINK = new RegExp(String.raw`<${ISSUE_URL}>`, 'g');
const ISSUE_BARE_URL = new RegExp(ISSUE_URL, 'g');

export function linearIssueLinksToIdentifiers(markdown: string): string {
  return markdown
    .replace(ISSUE_LINK, (_m, label: string, identifier: string) => {
      const text = label.trim();
      if (!text || text.startsWith('https://') || text === identifier) return identifier;
      return new RegExp(String.raw`\b${identifier}\b`).test(text)
        ? text
        : `${text} (${identifier})`;
    })
    .replace(ISSUE_AUTOLINK, (_m, identifier: string) => identifier)
    .replace(ISSUE_BARE_URL, (_m, identifier: string) => identifier);
}

const UPLOAD_HOST = 'uploads.linear.app';

export function isLinearUploadUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === UPLOAD_HOST;
  } catch {
    return false;
  }
}

function inScope(ref: LinearIssueRef, scope: LinearScope): boolean {
  if (ref.team.id !== scope.teamId) return false;
  return scope.projectFilter === 'none'
    ? ref.project === null
    : ref.project?.id === scope.projectId;
}

function escapeLinkText(text: string): string {
  return text.replace(/[\\[\]]/g, '\\$&');
}

// The description as written, then the link attachments under "Links", then the
// parent when it lives outside this job (its parent link cannot be kept), then the
// Linear identifier, last, so every imported issue can still be found by it.
export function linearIssueDescription(issue: LinearIssueNode, scope: LinearScope): string {
  const parts: string[] = [];
  const body = linearIssueLinksToIdentifiers(issue.description ?? '').trim();
  if (body) parts.push(body);
  const links = issue.attachments.nodes.filter((a) => !isLinearUploadUrl(a.url));
  if (links.length > 0) {
    const items = links.map((a) => `- [${escapeLinkText(a.title.trim() || a.url)}](${a.url})`);
    parts.push(['## Links', '', ...items].join('\n'));
  }
  if (issue.parent && !inScope(issue.parent, scope)) {
    parts.push(`Parent in Linear: ${issue.parent.identifier}`);
  }
  parts.push(`Imported from Linear: ${issue.identifier}`);
  return parts.join('\n\n');
}

export function mapLinearIssue(issue: LinearIssueNode, scope: LinearScope): CanonicalIssue {
  return {
    sourceId: issue.id,
    sequenceId: issue.number,
    title: issue.title,
    descriptionMarkdown: linearIssueDescription(issue, scope),
    stateSourceId: issue.state.id,
    assigneeEmail: issue.assignee?.email || null,
    labelSourceIds: issue.labels.nodes.map((l) => l.id),
    cycleSourceId: issue.cycle?.id ?? null,
    parentSourceId: issue.parent?.id ?? null,
    priority: linearPriority(issue.priority),
    startDate: null,
    dueDate: issue.dueDate,
    customFields: [],
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
  };
}

// A comment from an integration or a bot has no user, so no email to match a
// member by; it keeps the bot's or the external author's name.
export function linearCommentAuthor(comment: LinearCommentNode): {
  authorEmail: string | null;
  authorName: string;
} {
  if (comment.user) {
    return {
      authorEmail: comment.user.email || null,
      authorName: comment.user.name || comment.user.email,
    };
  }
  return {
    authorEmail: null,
    authorName: comment.botActor?.name || comment.externalUser?.name || 'Linear',
  };
}

// Oldest first: the Create phase links a reply to its parent only when the parent
// was created before it.
export function mapLinearComments(nodes: LinearCommentNode[]): CanonicalComment[] {
  return [...nodes]
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .map((c) => ({
      sourceId: c.id,
      ...linearCommentAuthor(c),
      bodyMarkdown: linearIssueLinksToIdentifiers(c.body),
      createdAt: c.createdAt,
      replyToSourceId: c.parent?.id ?? null,
    }));
}

// Issue.relations lists only the relations this issue owns, each once; the same
// relation seen from the other issue (inverseRelations) is never read. "similar" is a
// suggestion Linear makes, not a link anyone created.
const RELATION_KIND_MAP: Record<string, CanonicalRelation['kind']> = {
  blocks: 'blocks',
  duplicate: 'duplicates',
  related: 'relates',
};

export function mapLinearRelations(
  issueSourceId: string,
  nodes: LinearRelationNode[],
): CanonicalRelation[] {
  return nodes.flatMap((r) => {
    const kind = RELATION_KIND_MAP[r.type];
    if (!kind) return [];
    return [{ kind, sourceIssueSourceId: issueSourceId, targetIssueSourceId: r.relatedIssue.id }];
  });
}

export function linearNextCursor(pageInfo: LinearPageInfo): string | null {
  if (!pageInfo.hasNextPage) return null;
  if (!pageInfo.endCursor) {
    throw new Error(
      'Linear reported another page but sent no end cursor; stopping to avoid a truncated import',
    );
  }
  return pageInfo.endCursor;
}

const UPLOAD_LINK = /\[([^\]]*)\]\((https:\/\/uploads\.linear\.app\/[^)\s]+)\)/g;
const UPLOAD_URL = /https:\/\/uploads\.linear\.app\/[^\s)<>\]"'`]+/g;

// The attachment's import_record source id: the upload URL, scoped to its issue, so
// the same file referenced from two issues is attached to both.
export function linearUploadSourceId(issueSourceId: string, url: string): string {
  return `${issueSourceId} ${url}`;
}

export function linearUploadUrl(issueSourceId: string, attachmentSourceId: string): string {
  const prefix = `${issueSourceId} `;
  const url = attachmentSourceId.startsWith(prefix) ? attachmentSourceId.slice(prefix.length) : '';
  if (!isLinearUploadUrl(url)) {
    throw new Error(`"${attachmentSourceId}" is not a Linear upload of issue ${issueSourceId}`);
  }
  return url;
}

export function contentTypeForFilename(filename: string): string {
  return Bun.file(filename).type.split(';')[0]!;
}

function lastPathSegment(url: string): string {
  return new URL(url).pathname.split('/').filter(Boolean).pop() ?? 'file';
}

// The Attachments phase reuses a file already on the issue under the same name, so
// three screenshots pasted as "image.png" would otherwise become one.
function uniqueFilenames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const key = name.toLowerCase();
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    if (count === 1) return name;
    const dot = name.lastIndexOf('.');
    let n = count;
    let candidate = '';
    do {
      candidate = dot > 0 ? `${name.slice(0, dot)} (${n})${name.slice(dot)}` : `${name} (${n})`;
      n++;
    } while (seen.has(candidate.toLowerCase()));
    seen.set(candidate.toLowerCase(), 1);
    return candidate;
  });
}

// Files uploaded into Linear text (description, then comments, then upload-hosted
// link attachments), first mention wins. Linear reports no size or type for them:
// the type comes from the file name and the size check waits for the real bytes.
export function extractLinearUploads(
  issueSourceId: string,
  texts: (string | null)[],
  links: LinearLinkNode[],
): CanonicalAttachment[] {
  const labels = new Map<string, string>();
  for (const text of texts) {
    if (!text) continue;
    for (const [, label, url] of text.matchAll(UPLOAD_LINK)) {
      if (!labels.has(url!)) labels.set(url!, label!.trim());
    }
    // Bare URLs: trailing sentence punctuation is not part of the URL. Link
    // destinations are exact, so they are removed before this scan.
    for (const [match] of text.replace(UPLOAD_LINK, ' ').matchAll(UPLOAD_URL)) {
      const url = match.replace(/[.,;:!?]+$/, '');
      if (!labels.has(url)) labels.set(url, '');
    }
  }
  for (const link of links) {
    if (isLinearUploadUrl(link.url) && !labels.has(link.url))
      labels.set(link.url, link.title.trim());
  }
  const urls = [...labels.keys()];
  const names = uniqueFilenames(urls.map((url) => labels.get(url) || lastPathSegment(url)));
  return urls.map((url, i) => ({
    sourceId: linearUploadSourceId(issueSourceId, url),
    filename: names[i]!,
    contentType: contentTypeForFilename(names[i]!),
    sizeBytes: 0,
  }));
}
