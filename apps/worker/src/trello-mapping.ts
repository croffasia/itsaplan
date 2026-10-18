import type {
  CanonicalAttachment,
  CanonicalComment,
  CanonicalIssue,
  CanonicalLabel,
  CanonicalState,
  CanonicalStateCategory,
} from './canonical';

// Pure mapping from Trello REST shapes (the fields trello-adapter.ts asks for) to
// the canonical import shapes. No network, no @repo/db.

export interface TrelloList {
  id: string;
  name: string;
  closed: boolean;
}

export interface TrelloLabel {
  id: string;
  name: string;
  color: string | null;
}

export interface TrelloMember {
  id: string;
  fullName?: string;
  username?: string;
  email?: string | null;
}

export interface TrelloCheckItem {
  id: string;
  name: string;
  state: 'complete' | 'incomplete';
  pos: number;
}

export interface TrelloChecklist {
  id: string;
  name: string;
  pos: number;
  checkItems: TrelloCheckItem[];
}

export interface TrelloAttachment {
  id: string;
  name: string;
  url: string;
  isUpload: boolean;
  mimeType?: string | null;
  bytes?: number | null;
  fileName?: string | null;
}

export interface TrelloCard {
  id: string;
  idShort: number;
  name: string;
  desc: string;
  idList: string;
  idLabels: string[];
  idMembers: string[];
  start?: string | null;
  due?: string | null;
  dateLastActivity: string;
  shortUrl: string;
  checklists?: TrelloChecklist[];
  attachments?: TrelloAttachment[];
}

export interface TrelloCommentAction {
  id: string;
  idMemberCreator: string;
  date: string;
  data: { text: string };
  memberCreator?: { fullName?: string; username?: string } | null;
}

// Trello lists have no category, so the name decides; anything unrecognised is
// "unstarted", and the mapping review step can change every row.
const CATEGORY_PATTERNS: [RegExp, CanonicalStateCategory][] = [
  [/cancel|won'?t do|rejected|abandon/i, 'canceled'],
  [/done|complete|finished|closed|shipped|released/i, 'completed'],
  [/doing|progress|review|testing|\bqa\b|active|working/i, 'started'],
  [/backlog|ideas?|icebox|someday/i, 'backlog'],
];

export function trelloListCategory(name: string): CanonicalStateCategory {
  return CATEGORY_PATTERNS.find(([pattern]) => pattern.test(name))?.[1] ?? 'unstarted';
}

export function mapTrelloLists(lists: TrelloList[]): CanonicalState[] {
  return lists.map((l) => ({ sourceId: l.id, name: l.name, category: trelloListCategory(l.name) }));
}

// Trello's named label colours; the "_light"/"_dark" variants share the hue.
const COLORS: Record<string, string> = {
  green: '#4bce97',
  yellow: '#f5cd47',
  orange: '#fea362',
  red: '#f87168',
  purple: '#9f8fef',
  blue: '#579dff',
  sky: '#6cc3e0',
  lime: '#94c748',
  pink: '#e774bb',
  black: '#8590a2',
};

// A label with no name is shown by its colour on Trello, so the colour names it.
export function mapTrelloLabels(labels: TrelloLabel[]): CanonicalLabel[] {
  return labels.map((l) => {
    const hue = l.color?.replace(/_(light|dark)$/, '') ?? null;
    return {
      sourceId: l.id,
      name: l.name.trim() || l.color || 'label',
      ...(hue && COLORS[hue] ? { color: COLORS[hue] } : {}),
    };
  });
}

function escapeLinkText(text: string): string {
  return text.replace(/[\\[\]]/g, '\\$&');
}

export function trelloChecklistsMarkdown(checklists: TrelloChecklist[]): string {
  return [...checklists]
    .sort((a, b) => a.pos - b.pos)
    .map((c) => {
      const items = [...c.checkItems]
        .sort((a, b) => a.pos - b.pos)
        .map((i) => `- [${i.state === 'complete' ? 'x' : ' '}] ${i.name}`);
      return [`## ${c.name}`, '', ...items].join('\n');
    })
    .join('\n\n');
}

// The card's text, then its checklists as task lists, then its link attachments,
// then the card's own URL, so every imported issue can still be found by it.
export function trelloCardDescription(card: TrelloCard): string {
  const parts: string[] = [];
  if (card.desc.trim()) parts.push(card.desc.trim());
  if (card.checklists?.length) parts.push(trelloChecklistsMarkdown(card.checklists));
  const links = (card.attachments ?? []).filter((a) => !a.isUpload);
  if (links.length > 0) {
    const items = links.map((a) => `- [${escapeLinkText(a.name.trim() || a.url)}](${a.url})`);
    parts.push(['## Links', '', ...items].join('\n'));
  }
  parts.push(`Imported from Trello: ${card.shortUrl}`);
  return parts.join('\n\n');
}

// A Trello id is a Mongo ObjectId: its first 8 hex digits are the creation time.
export function trelloIdTimestamp(id: string): string {
  return new Date(parseInt(id.slice(0, 8), 16) * 1000).toISOString();
}

// Trello shows a member's email only to that member, so most cards resolve to no
// email and the job's unmatched-user policy applies. The first member is the assignee.
export function mapTrelloCard(card: TrelloCard, emails: Map<string, string>): CanonicalIssue {
  const assignee = card.idMembers.map((id) => emails.get(id)).find(Boolean) ?? null;
  return {
    sourceId: card.id,
    sequenceId: card.idShort,
    title: card.name,
    descriptionMarkdown: trelloCardDescription(card),
    stateSourceId: card.idList,
    assigneeEmail: assignee,
    labelSourceIds: card.idLabels,
    cycleSourceId: null,
    parentSourceId: null,
    priority: null,
    startDate: card.start?.slice(0, 10) ?? null,
    dueDate: card.due?.slice(0, 10) ?? null,
    customFields: [],
    createdAt: trelloIdTimestamp(card.id),
    updatedAt: card.dateLastActivity,
  };
}

export function mapTrelloMemberEmails(members: TrelloMember[]): Map<string, string> {
  return new Map(members.flatMap((m) => (m.email ? [[m.id, m.email] as const] : [])));
}

export function mapTrelloComments(
  actions: TrelloCommentAction[],
  emails: Map<string, string>,
): CanonicalComment[] {
  return [...actions]
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
    .map((a) => ({
      sourceId: a.id,
      authorEmail: emails.get(a.idMemberCreator) ?? null,
      authorName: a.memberCreator?.fullName || a.memberCreator?.username || 'Trello',
      bodyMarkdown: a.data.text,
      createdAt: a.date,
      replyToSourceId: null,
    }));
}

// Uploaded files only; a link attachment goes into the description instead.
export function mapTrelloAttachments(attachments: TrelloAttachment[]): CanonicalAttachment[] {
  return attachments
    .filter((a) => a.isUpload)
    .map((a) => ({
      sourceId: a.id,
      filename: a.fileName || a.name,
      contentType: a.mimeType || 'application/octet-stream',
      sizeBytes: a.bytes ?? 0,
    }));
}

// Trello pages a board's cards by "before=<card id>", newest first, with no cursor
// of its own: a full page means there may be another, ending before its oldest id.
export function trelloNextCursor(cards: { id: string }[], limit: number): string | null {
  if (cards.length < limit) return null;
  return cards.reduce((min, c) => (c.id < min ? c.id : min), cards[0]!.id);
}
