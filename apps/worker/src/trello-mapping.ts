import type {
  CanonicalAttachment,
  CanonicalChecklist,
  CanonicalComment,
  CanonicalCustomField,
  CanonicalCustomFieldType,
  CanonicalCustomFieldValue,
  CanonicalIssue,
  CanonicalLabel,
  CanonicalState,
  CanonicalStateCategory,
} from './canonical';
import { contentTypeForFilename, uniqueFilenames } from './attachment-download';

// Pure mapping from Trello's REST shapes (the fields trello-adapter.ts asks for) to
// the canonical import shapes. No network, no @repo/db.

export interface TrelloList {
  id: string;
  name: string;
  closed: boolean;
  pos: number;
}

export interface TrelloLabel {
  id: string;
  name: string;
  color: string | null;
}

export interface TrelloCustomFieldDef {
  id: string;
  name: string;
  type: string;
  options?: { id: string; value: { text: string }; pos: number }[];
}

export interface TrelloCustomFieldItem {
  idCustomField: string;
  idValue?: string | null;
  value?: { text?: string; number?: string; date?: string; checked?: string } | null;
}

export interface TrelloAttachment {
  id: string;
  name: string;
  url: string;
  isUpload: boolean;
  bytes: number | null;
  mimeType: string | null;
}

export interface TrelloChecklist {
  id: string;
  name: string;
  pos: number;
  checkItems: { id: string; name: string; state: string; pos: number }[];
}

export interface TrelloCard {
  id: string;
  idShort: number;
  name: string;
  desc: string;
  closed: boolean;
  idList: string;
  pos: number;
  idLabels: string[];
  idMembers: string[];
  start: string | null;
  due: string | null;
  dateLastActivity: string;
  shortUrl: string;
  attachments?: TrelloAttachment[];
  checklists?: TrelloChecklist[];
  customFieldItems?: TrelloCustomFieldItem[];
}

export interface TrelloCommentAction {
  id: string;
  date: string;
  idMemberCreator: string;
  data: { text: string };
  memberCreator?: { fullName?: string; username?: string } | null;
}

// One import job: a board, what to do with its archived cards, and the board
// members the user matched with project members.
export interface TrelloScope {
  boardId: string;
  archivedCards: 'archive' | 'skip';
  // Trello member id -> the email of the project member it was matched with.
  memberEmails: Record<string, string>;
}

// A Trello list has no category of its own; the name gives a default the mapping
// review step can change.
export function trelloListCategory(name: string): CanonicalStateCategory {
  if (/\b(done|completed?|finished|closed|shipped|released)\b/i.test(name)) return 'completed';
  if (/\b(doing|in progress|wip|review|testing|qa)\b/i.test(name)) return 'started';
  if (/\b(backlog|ideas?|icebox|someday)\b/i.test(name)) return 'backlog';
  return 'unstarted';
}

function byPos<T extends { pos: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.pos - b.pos);
}

// Only open lists become columns. A card of an archived list is imported archived
// and goes to the first column of the project.
export function mapTrelloStates(lists: TrelloList[]): CanonicalState[] {
  return byPos(lists.filter((l) => !l.closed)).map((l) => ({
    sourceId: l.id,
    name: l.name,
    category: trelloListCategory(l.name),
  }));
}

const LABEL_COLORS: Record<string, string> = {
  green: '#61bd4f',
  yellow: '#f2d600',
  orange: '#ff9f1a',
  red: '#eb5a46',
  purple: '#c377e0',
  blue: '#0079bf',
  sky: '#00c2e0',
  lime: '#51e898',
  pink: '#ff78cb',
  black: '#344563',
};

// Trello names its colors ("green", "green_dark"); itsaplan stores a hex value.
function trelloLabelColor(color: string | null): string | undefined {
  return color ? LABEL_COLORS[color.split('_')[0]!] : undefined;
}

// A Trello label may have no name, only a color; it is named after the color.
export function mapTrelloLabels(labels: TrelloLabel[]): CanonicalLabel[] {
  return labels.map((l) => {
    const colorName = l.color?.split('_')[0];
    const fallback = colorName ? colorName[0]!.toUpperCase() + colorName.slice(1) : 'Label';
    return { sourceId: l.id, name: l.name.trim() || fallback, color: trelloLabelColor(l.color) };
  });
}

const FIELD_TYPES: Record<string, CanonicalCustomFieldType> = {
  text: 'text',
  number: 'number',
  checkbox: 'boolean',
  date: 'datetime',
  list: 'select',
};

export function mapTrelloCustomFields(defs: TrelloCustomFieldDef[]): CanonicalCustomField[] {
  return defs.flatMap((d) => {
    const fieldType = FIELD_TYPES[d.type];
    if (!fieldType) return [];
    const options =
      fieldType === 'select' ? [...new Set(byPos(d.options ?? []).map((o) => o.value.text))] : [];
    return [{ sourceId: d.id, name: d.name, fieldType, options }];
  });
}

function customFieldValue(
  def: TrelloCustomFieldDef,
  item: TrelloCustomFieldItem,
): string | number | boolean | null {
  switch (def.type) {
    case 'list':
      return def.options?.find((o) => o.id === item.idValue)?.value.text ?? null;
    case 'checkbox':
      return item.value?.checked === 'true';
    case 'number': {
      const raw = item.value?.number;
      return raw && Number.isFinite(Number(raw)) ? Number(raw) : null;
    }
    case 'date':
      return item.value?.date ?? null;
    default:
      return item.value?.text ?? null;
  }
}

export function mapTrelloCustomFieldValues(
  items: TrelloCustomFieldItem[],
  defs: TrelloCustomFieldDef[],
): CanonicalCustomFieldValue[] {
  const byId = new Map(defs.map((d) => [d.id, d]));
  return items.flatMap((item) => {
    const def = byId.get(item.idCustomField);
    const value = def ? customFieldValue(def, item) : null;
    return value === null ? [] : [{ fieldSourceId: item.idCustomField, value }];
  });
}

// A Trello id is a MongoDB ObjectId: its first four bytes are the creation time in seconds.
export function trelloCreatedAt(id: string): string {
  return new Date(parseInt(id.slice(0, 8), 16) * 1000).toISOString();
}

function escapeLinkText(text: string): string {
  return text.replace(/[\\[\]]/g, '\\$&');
}

// The description as written, then the link attachments under "Links", then the
// card's Trello URL, last, so every imported issue can still be found by it.
function trelloCardDescription(card: TrelloCard): string {
  const parts: string[] = [];
  const body = card.desc.trim();
  if (body) parts.push(body);
  const links = (card.attachments ?? []).filter((a) => !a.isUpload);
  if (links.length > 0) {
    const items = links.map((a) => `- [${escapeLinkText(a.name.trim() || a.url)}](${a.url})`);
    parts.push(['## Links', '', ...items].join('\n'));
  }
  parts.push(`Imported from Trello: ${card.shortUrl}`);
  return parts.join('\n\n');
}

function isTrelloCardArchived(card: TrelloCard, lists: TrelloList[]): boolean {
  return card.closed || lists.some((l) => l.id === card.idList && l.closed);
}

// The first matched member is the assignee, the others watch the issue.
export function mapTrelloCard(
  card: TrelloCard,
  scope: TrelloScope,
  lists: TrelloList[],
  fieldDefs: TrelloCustomFieldDef[],
): CanonicalIssue {
  const emails = [
    ...new Set(card.idMembers.map((id) => scope.memberEmails[id]).filter((e): e is string => !!e)),
  ];
  return {
    sourceId: card.id,
    sequenceId: card.idShort,
    title: card.name,
    descriptionMarkdown: trelloCardDescription(card),
    stateSourceId: card.idList,
    assigneeEmail: emails[0] ?? null,
    watcherEmails: emails.slice(1),
    labelSourceIds: card.idLabels,
    cycleSourceId: null,
    parentSourceId: null,
    priority: null,
    startDate: card.start?.slice(0, 10) ?? null,
    dueDate: card.due?.slice(0, 10) ?? null,
    customFields: mapTrelloCustomFieldValues(card.customFieldItems ?? [], fieldDefs),
    createdAt: trelloCreatedAt(card.id),
    updatedAt: card.dateLastActivity,
    archivedAt: isTrelloCardArchived(card, lists) ? card.dateLastActivity : null,
  };
}

// The cards one job imports, in board order: list by list, each list top to bottom.
// Create makes the issues in this order, so each column keeps Trello's order.
export function trelloCardsToImport(
  cards: TrelloCard[],
  lists: TrelloList[],
  archivedCards: TrelloScope['archivedCards'],
): TrelloCard[] {
  const listPos = new Map(lists.map((l) => [l.id, l.pos]));
  return cards
    .filter((c) => archivedCards === 'archive' || !isTrelloCardArchived(c, lists))
    .sort(
      (a, b) =>
        (listPos.get(a.idList) ?? Infinity) - (listPos.get(b.idList) ?? Infinity) || a.pos - b.pos,
    );
}

export function mapTrelloChecklists(checklists: TrelloChecklist[]): CanonicalChecklist[] {
  return byPos(checklists).map((c) => ({
    sourceId: c.id,
    title: c.name,
    items: byPos(c.checkItems).map((i) => ({ content: i.name, done: i.state === 'complete' })),
  }));
}

// Oldest first, the order the Create phase writes comments in. Trello has no replies.
export function mapTrelloComments(
  actions: TrelloCommentAction[],
  memberEmails: Record<string, string>,
): CanonicalComment[] {
  return [...actions]
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
    .map((a) => ({
      sourceId: a.id,
      authorEmail: memberEmails[a.idMemberCreator] ?? null,
      authorName: a.memberCreator?.fullName || a.memberCreator?.username || 'Trello',
      bodyMarkdown: a.data.text,
      createdAt: a.date,
      replyToSourceId: null,
    }));
}

function lastPathSegment(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() ?? 'file');
  } catch {
    return 'file';
  }
}

// Files uploaded to the card. A link attachment is not a file; it is listed in the
// description instead.
export function trelloUploads(card: TrelloCard): CanonicalAttachment[] {
  const uploads = (card.attachments ?? []).filter((a) => a.isUpload);
  const names = uniqueFilenames(uploads.map((a) => a.name.trim() || lastPathSegment(a.url)));
  return uploads.map((a, i) => ({
    sourceId: a.id,
    filename: names[i]!,
    contentType: a.mimeType || contentTypeForFilename(names[i]!),
    sizeBytes: a.bytes ?? 0,
  }));
}

const CARD_URL = /^https:\/\/trello\.com\/c\/([A-Za-z0-9]+)(?:[/?#]|$)/;

// The short link of a Trello card URL ("https://trello.com/c/AbCd1234/12-title"), the
// form a link to another card takes as an attachment.
export function trelloCardShortLink(url: string): string | null {
  return CARD_URL.exec(url)?.[1] ?? null;
}
