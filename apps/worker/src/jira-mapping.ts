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

// Pure mapping from Jira Cloud REST v3 shapes (the fields jira-adapter.ts asks for)
// to the canonical import shapes. No network, no @repo/db.

export interface AdfNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: AdfNode[];
}

export interface JiraStatus {
  id: string;
  name: string;
  statusCategory: { key: string };
}

export interface JiraSprint {
  id: number;
  name: string;
  state?: string;
  startDate?: string;
  endDate?: string;
  completeDate?: string;
  goal?: string;
}

export interface JiraUser {
  emailAddress?: string;
  displayName?: string;
}

export interface JiraIssueLink {
  type: { name: string };
  outwardIssue?: { id: string };
  inwardIssue?: { id: string };
}

export interface JiraAttachment {
  id: string;
  filename: string;
  mimeType?: string;
  size?: number;
}

export interface JiraIssueFields {
  summary: string;
  description?: AdfNode | null;
  status: { id: string };
  priority?: { name: string } | null;
  assignee?: JiraUser | null;
  labels?: string[];
  parent?: { id: string; key: string } | null;
  duedate?: string | null;
  created: string;
  updated: string;
  issuelinks?: JiraIssueLink[];
  attachment?: JiraAttachment[];
  [sprintField: string]: unknown;
}

export interface JiraIssue {
  id: string;
  key: string;
  fields: JiraIssueFields;
}

export interface JiraComment {
  id: string;
  author?: JiraUser;
  body: AdfNode | null;
  created: string;
}

// Jira's three status categories. "new" covers both To Do and a backlog; the
// mapping review step can change any row.
const STATE_CATEGORY_MAP: Record<string, CanonicalStateCategory> = {
  new: 'unstarted',
  indeterminate: 'started',
  done: 'completed',
};

export function jiraStateCategory(status: JiraStatus): CanonicalStateCategory {
  if (/cancel|won'?t do|rejected/i.test(status.name)) return 'canceled';
  if (/backlog/i.test(status.name)) return 'backlog';
  return STATE_CATEGORY_MAP[status.statusCategory.key] ?? 'backlog';
}

// GET /project/{key}/statuses lists statuses per issue type; one status is shared
// by several types, so it is kept once.
export function mapJiraStatuses(issueTypes: { statuses: JiraStatus[] }[]): CanonicalState[] {
  const seen = new Map<string, CanonicalState>();
  for (const type of issueTypes) {
    for (const s of type.statuses) {
      if (!seen.has(s.id))
        seen.set(s.id, { sourceId: s.id, name: s.name, category: jiraStateCategory(s) });
    }
  }
  return [...seen.values()];
}

// Jira's default scheme: Highest, High, Medium, Low, Lowest. Other names are dropped.
const PRIORITIES: Record<string, string> = {
  highest: 'urgent',
  blocker: 'urgent',
  critical: 'urgent',
  high: 'high',
  major: 'high',
  medium: 'medium',
  low: 'low',
  minor: 'low',
  lowest: 'low',
  trivial: 'low',
};

export function jiraPriority(name: string | undefined): string | null {
  return (name && PRIORITIES[name.toLowerCase()]) || null;
}

// A Jira label is a plain string with no id; the name is its source id.
export function mapJiraLabels(names: Iterable<string>): CanonicalLabel[] {
  return [...new Set(names)].map((name) => ({ sourceId: name, name }));
}

// A sprint without dates (one not started yet) has no cycle to become. Names are
// made distinct because the store reuses a cycle by name.
export function mapJiraSprints(sprints: JiraSprint[]): CanonicalCycle[] {
  const taken = new Set<string>();
  const cycles: CanonicalCycle[] = [];
  for (const s of sprints) {
    if (!s.startDate || !(s.endDate || s.completeDate)) continue;
    let name = s.name.trim() || `Sprint ${s.id}`;
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${s.name.trim()} (${n})`;
    taken.add(name.toLowerCase());
    cycles.push({
      sourceId: String(s.id),
      name,
      startDate: s.startDate.slice(0, 10),
      endDate: (s.endDate ?? s.completeDate)!.slice(0, 10),
      goal: s.goal || undefined,
    });
  }
  return cycles;
}

// The issue's latest sprint: an issue carried over keeps every earlier one too.
export function jiraIssueSprints(
  fields: JiraIssueFields,
  sprintField: string | null,
): JiraSprint[] {
  const value = sprintField ? fields[sprintField] : null;
  return Array.isArray(value) ? (value as JiraSprint[]) : [];
}

// Jira writes "2024-01-05T10:00:00.000+0000"; the offset needs a colon to be ISO 8601.
export function jiraTimestamp(value: string): string {
  return value.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
}

function applyMarks(text: string, marks: AdfNode['marks']): string {
  let out = text;
  for (const mark of marks ?? []) {
    if (mark.type === 'code') out = `\`${out}\``;
    else if (mark.type === 'strong') out = `**${out}**`;
    else if (mark.type === 'em') out = `_${out}_`;
    else if (mark.type === 'strike') out = `~~${out}~~`;
    else if (mark.type === 'link' && typeof mark.attrs?.href === 'string') {
      out = `[${out}](${mark.attrs.href})`;
    }
  }
  return out;
}

function inline(nodes: AdfNode[] | undefined): string {
  return (nodes ?? []).map(inlineNode).join('');
}

function inlineNode(node: AdfNode): string {
  const attrs = node.attrs ?? {};
  switch (node.type) {
    case 'text':
      return applyMarks(node.text ?? '', node.marks);
    case 'hardBreak':
      return '\n';
    case 'mention':
      return String(attrs.text ?? '@user');
    case 'emoji':
      return String(attrs.text ?? attrs.shortName ?? '');
    case 'inlineCard':
    case 'blockCard':
    case 'embedCard':
      return String(attrs.url ?? '');
    case 'status':
      return `[${String(attrs.text ?? '')}]`;
    case 'date':
      return attrs.timestamp ? new Date(Number(attrs.timestamp)).toISOString().slice(0, 10) : '';
    default:
      return inline(node.content);
  }
}

function indent(text: string, prefix: string): string {
  return text
    .split('\n')
    .map((line, i) => (i === 0 ? line : line ? `${' '.repeat(prefix.length)}${line}` : line))
    .join('\n');
}

function listItems(node: AdfNode, ordered: boolean): string {
  return (node.content ?? [])
    .map((item, i) => {
      const prefix = ordered ? `${i + 1}. ` : '- ';
      return prefix + indent(blocks(item.content).trim(), prefix);
    })
    .join('\n');
}

function tableCell(cell: AdfNode): string {
  return blocks(cell.content).trim().replace(/\n+/g, ' ').replace(/\|/g, '\\|');
}

function table(node: AdfNode): string {
  const rows = (node.content ?? []).map((row) => (row.content ?? []).map(tableCell));
  if (rows.length === 0) return '';
  const width = Math.max(...rows.map((r) => r.length));
  const line = (cells: string[]) =>
    `| ${Array.from({ length: width }, (_, i) => cells[i] ?? '').join(' | ')} |`;
  return [line(rows[0]!), line(Array(width).fill('---')), ...rows.slice(1).map(line)].join('\n');
}

function block(node: AdfNode): string {
  switch (node.type) {
    case 'paragraph':
      return inline(node.content);
    case 'heading':
      return `${'#'.repeat(Number(node.attrs?.level ?? 1))} ${inline(node.content)}`;
    case 'bulletList':
      return listItems(node, false);
    case 'orderedList':
      return listItems(node, true);
    case 'taskList':
      return (node.content ?? [])
        .map((item) => `- [${item.attrs?.state === 'DONE' ? 'x' : ' '}] ${inline(item.content)}`)
        .join('\n');
    case 'codeBlock': {
      const language = typeof node.attrs?.language === 'string' ? node.attrs.language : '';
      return `\`\`\`${language}\n${inline(node.content)}\n\`\`\``;
    }
    case 'blockquote':
    case 'panel':
      return blocks(node.content)
        .split('\n')
        .map((line) => (line ? `> ${line}` : '>'))
        .join('\n');
    case 'rule':
      return '---';
    case 'table':
      return table(node);
    case 'mediaSingle':
    case 'mediaGroup':
    case 'media':
      // The file itself is imported as an attachment of the issue.
      return '';
    case 'expand':
    case 'nestedExpand': {
      const title =
        typeof node.attrs?.title === 'string' && node.attrs.title
          ? `**${node.attrs.title}**\n\n`
          : '';
      return title + blocks(node.content);
    }
    default:
      return node.content ? blocks(node.content) : inlineNode(node);
  }
}

function blocks(nodes: AdfNode[] | undefined): string {
  return (nodes ?? [])
    .map(block)
    .filter((text) => text.trim() !== '')
    .join('\n\n');
}

// Atlassian Document Format, the JSON rich text of v3 descriptions and comments.
export function adfToMarkdown(doc: AdfNode | null | undefined): string {
  if (!doc) return '';
  return blocks(doc.content).trim();
}

// "https://acme.atlassian.net/browse/OPS-12" becomes "OPS-12" so the Rewrite phase
// can resolve it; a rewritten URL would be a broken link.
const ISSUE_URL = String.raw`https://[\w-]+\.atlassian\.net/browse/([A-Z][A-Z0-9_]*-\d+)(?:[?#][^\s)>\]]*)?`;
const ISSUE_LINK = new RegExp(String.raw`\[([^\]]*)\]\(${ISSUE_URL}\)`, 'g');
const ISSUE_BARE_URL = new RegExp(ISSUE_URL, 'g');

export function jiraIssueLinksToKeys(markdown: string): string {
  return markdown
    .replace(ISSUE_LINK, (_m, label: string, key: string) => {
      const text = label.trim();
      if (!text || text.startsWith('https://') || text === key) return key;
      return text.includes(key) ? text : `${text} (${key})`;
    })
    .replace(ISSUE_BARE_URL, (_m, key: string) => key);
}

export function jiraSequenceId(key: string): number {
  return Number(key.slice(key.lastIndexOf('-') + 1));
}

export interface JiraScope {
  projectKey: string;
  sprintField: string | null;
}

export function mapJiraIssue(issue: JiraIssue, scope: JiraScope): CanonicalIssue {
  const f = issue.fields;
  const parts: string[] = [];
  const body = jiraIssueLinksToKeys(adfToMarkdown(f.description));
  if (body) parts.push(body);
  if (f.parent && !f.parent.key.startsWith(`${scope.projectKey}-`)) {
    parts.push(`Parent in Jira: ${f.parent.key}`);
  }
  parts.push(`Imported from Jira: ${issue.key}`);
  const sprints = jiraIssueSprints(f, scope.sprintField);
  const sprint = mapJiraSprints(sprints).at(-1);
  return {
    sourceId: issue.id,
    sequenceId: jiraSequenceId(issue.key),
    title: f.summary,
    descriptionMarkdown: parts.join('\n\n'),
    stateSourceId: f.status.id,
    assigneeEmail: f.assignee?.emailAddress || null,
    labelSourceIds: f.labels ?? [],
    cycleSourceId: sprint?.sourceId ?? null,
    parentSourceId: f.parent?.id ?? null,
    priority: jiraPriority(f.priority?.name),
    startDate: null,
    dueDate: f.duedate ?? null,
    customFields: [],
    createdAt: jiraTimestamp(f.created),
    updatedAt: jiraTimestamp(f.updated),
  };
}

// Jira returns comments oldest first and has no reply threading.
export function mapJiraComments(comments: JiraComment[]): CanonicalComment[] {
  return [...comments]
    .sort((a, b) => Date.parse(jiraTimestamp(a.created)) - Date.parse(jiraTimestamp(b.created)))
    .map((c) => ({
      sourceId: c.id,
      authorEmail: c.author?.emailAddress || null,
      authorName: c.author?.displayName || c.author?.emailAddress || 'Jira',
      bodyMarkdown: jiraIssueLinksToKeys(adfToMarkdown(c.body)),
      createdAt: jiraTimestamp(c.created),
      replyToSourceId: null,
    }));
}

// Each link appears on both issues: outward on one, inward on the other. Only the
// outward side is read, so a link is imported once. Cloners and custom link types
// are dropped.
const LINK_KIND_MAP: Record<string, CanonicalRelation['kind']> = {
  blocks: 'blocks',
  duplicate: 'duplicates',
  relates: 'relates',
};

export function mapJiraLinks(issueId: string, links: JiraIssueLink[]): CanonicalRelation[] {
  return links.flatMap((link) => {
    const kind = LINK_KIND_MAP[link.type.name.toLowerCase()];
    if (!kind || !link.outwardIssue) return [];
    return [{ kind, sourceIssueSourceId: issueId, targetIssueSourceId: link.outwardIssue.id }];
  });
}

export function mapJiraAttachments(attachments: JiraAttachment[]): CanonicalAttachment[] {
  return attachments.map((a) => ({
    sourceId: a.id,
    filename: a.filename,
    contentType: a.mimeType || 'application/octet-stream',
    sizeBytes: a.size ?? 0,
  }));
}
