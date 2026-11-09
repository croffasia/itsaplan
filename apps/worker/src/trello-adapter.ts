import { pinnedFetch } from '@repo/net';
import { AttachmentRejectedError, resolveDownloadRedirects } from './attachment-download';
import {
  SourceRateLimitedError,
  type AttachmentDownload,
  type Page,
  type SourceReader,
} from './reader';
import type {
  CanonicalAttachment,
  CanonicalChecklist,
  CanonicalComment,
  CanonicalCustomField,
  CanonicalCycle,
  CanonicalIssue,
  CanonicalLabel,
  CanonicalRelation,
  CanonicalState,
} from './canonical';
import {
  mapTrelloCard,
  mapTrelloChecklists,
  mapTrelloComments,
  mapTrelloCustomFields,
  mapTrelloLabels,
  mapTrelloStates,
  trelloCardShortLink,
  trelloCardsToImport,
  trelloUploads,
  type TrelloCard,
  type TrelloCommentAction,
  type TrelloCustomFieldDef,
  type TrelloLabel,
  type TrelloList,
  type TrelloScope,
} from './trello-mapping';

// The SourceReader for Trello: its REST API with the user's API key and token.
// docs/dev/trello-import.md has the details.

export interface TrelloCredential {
  apiKey: string;
  token: string;
}

export const TRELLO_API_URL = 'https://api.trello.com/1';
// Trello returns at most 1000 cards or actions per request.
const PAGE_SIZE = 1000;
const REQUEST_TIMEOUT_MS = 15_000;
// Trello counts a token's requests over 10 seconds.
const RATE_LIMIT_WAIT_MS = 10_000;
const TRELLO_HOSTS = new Set(['trello.com', 'api.trello.com']);

const CARD_FIELDS =
  'idShort,name,desc,closed,idList,pos,idLabels,idMembers,start,due,dateLastActivity,shortUrl';
const CARD_PARAMS = {
  fields: CARD_FIELDS,
  attachments: 'true',
  attachment_fields: 'name,url,isUpload,bytes,mimeType',
  customFieldItems: 'true',
};

export function trelloAuthorization(credential: TrelloCredential): string {
  return `OAuth oauth_consumer_key="${credential.apiKey}", oauth_token="${credential.token}"`;
}

// The key and token go to Trello's own hosts only, never to the storage a download
// redirects to.
export function trelloFileHeaders(
  url: string,
  credential: TrelloCredential,
): Record<string, string> | undefined {
  const parsed = new URL(url);
  return parsed.protocol === 'https:' && TRELLO_HOSTS.has(parsed.hostname)
    ? { Authorization: trelloAuthorization(credential) }
    : undefined;
}

// Trello pages by creation date: a page holds the newest cards or actions before the
// given id, so the next page starts before the oldest of this one.
function oldestId(items: { id: string }[]): string {
  return items.reduce((oldest, item) => (item.id < oldest ? item.id : oldest), items[0]!.id);
}

export class TrelloReader implements SourceReader {
  // One tick reads the board's lists and custom fields and each card once. A reader
  // lives for one tick.
  private listsPromise: Promise<TrelloList[]> | null = null;
  private fieldsPromise: Promise<TrelloCustomFieldDef[]> | null = null;
  private readonly cards = new Map<string, Promise<TrelloCard>>();
  private readonly linkedCards = new Map<string, Promise<string | null>>();

  constructor(
    private readonly credential: TrelloCredential,
    private readonly scope: TrelloScope,
    private readonly fetch: typeof pinnedFetch = pinnedFetch,
  ) {}

  async listStates(): Promise<CanonicalState[]> {
    return mapTrelloStates(await this.lists());
  }

  async listLabels(): Promise<CanonicalLabel[]> {
    const labels = await this.get<TrelloLabel[]>(`${this.boardPath()}/labels`, {
      fields: 'name,color',
      limit: String(PAGE_SIZE),
    });
    return mapTrelloLabels(labels);
  }

  async listCycles(): Promise<CanonicalCycle[]> {
    return [];
  }

  async listCustomFields(): Promise<CanonicalCustomField[]> {
    return mapTrelloCustomFields(await this.fieldDefs());
  }

  // Every card in one page: board order needs all of them, and paging by creation
  // date would scatter a list across pages.
  async listIssues(): Promise<Page<CanonicalIssue>> {
    const filter = this.scope.archivedCards === 'archive' ? 'all' : 'open';
    const cards = new Map<string, TrelloCard>();
    let before: string | null = null;
    do {
      const page: TrelloCard[] = await this.get<TrelloCard[]>(`${this.boardPath()}/cards`, {
        ...CARD_PARAMS,
        filter,
        limit: String(PAGE_SIZE),
        ...(before ? { before } : {}),
      });
      for (const card of page) cards.set(card.id, card);
      before = page.length < PAGE_SIZE ? null : oldestId(page);
    } while (before !== null);
    const [lists, fieldDefs] = await Promise.all([this.lists(), this.fieldDefs()]);
    const ordered = trelloCardsToImport([...cards.values()], lists, this.scope.archivedCards);
    return {
      items: ordered.map((card) => mapTrelloCard(card, this.scope, lists, fieldDefs)),
      cursor: null,
    };
  }

  async getIssue(sourceId: string): Promise<CanonicalIssue> {
    const [card, lists, fieldDefs] = await Promise.all([
      this.card(sourceId),
      this.lists(),
      this.fieldDefs(),
    ]);
    return mapTrelloCard(card, this.scope, lists, fieldDefs);
  }

  // A link attachment to another card of this board is a "relates" link.
  async listIssueRelations(issueSourceId: string): Promise<CanonicalRelation[]> {
    const card = await this.card(issueSourceId);
    const shortLinks = new Set(
      (card.attachments ?? []).flatMap((a) => {
        const shortLink = a.isUpload ? null : trelloCardShortLink(a.url);
        return shortLink ? [shortLink] : [];
      }),
    );
    const relations: CanonicalRelation[] = [];
    for (const shortLink of shortLinks) {
      const target = await this.cardIdOnBoard(shortLink);
      if (target && target !== issueSourceId) {
        relations.push({
          kind: 'relates',
          sourceIssueSourceId: issueSourceId,
          targetIssueSourceId: target,
        });
      }
    }
    return relations;
  }

  async listIssueComments(issueSourceId: string): Promise<CanonicalComment[]> {
    const actions: TrelloCommentAction[] = [];
    let before: string | null = null;
    do {
      const page: TrelloCommentAction[] = await this.get<TrelloCommentAction[]>(
        `/cards/${encodeURIComponent(issueSourceId)}/actions`,
        {
          filter: 'commentCard',
          limit: String(PAGE_SIZE),
          memberCreator_fields: 'fullName,username',
          ...(before ? { before } : {}),
        },
      );
      actions.push(...page);
      before = page.length < PAGE_SIZE ? null : oldestId(page);
    } while (before !== null);
    return mapTrelloComments(actions, this.scope.memberEmails);
  }

  async listIssueAttachments(issueSourceId: string): Promise<CanonicalAttachment[]> {
    return trelloUploads(await this.card(issueSourceId));
  }

  async listIssueChecklists(issueSourceId: string): Promise<CanonicalChecklist[]> {
    return mapTrelloChecklists((await this.card(issueSourceId)).checklists ?? []);
  }

  // An upload is served from trello.com with the key and token, usually as a
  // redirect to signed storage.
  async resolveAttachmentDownload(
    issueSourceId: string,
    attachmentSourceId: string,
  ): Promise<AttachmentDownload> {
    const card = await this.card(issueSourceId);
    const upload = card.attachments?.find((a) => a.id === attachmentSourceId && a.isUpload);
    if (!upload) throw new AttachmentRejectedError('the file is no longer on the Trello card');
    return resolveDownloadRedirects(
      upload.url,
      {
        source: 'Trello',
        headersFor: (url) => trelloFileHeaders(url, this.credential),
        rateLimitWaitMs: RATE_LIMIT_WAIT_MS,
      },
      this.fetch,
    );
  }

  private boardPath(): string {
    return `/boards/${encodeURIComponent(this.scope.boardId)}`;
  }

  private lists(): Promise<TrelloList[]> {
    this.listsPromise ??= this.get<TrelloList[]>(`${this.boardPath()}/lists`, {
      filter: 'all',
      fields: 'name,closed,pos',
    });
    return this.listsPromise;
  }

  private fieldDefs(): Promise<TrelloCustomFieldDef[]> {
    this.fieldsPromise ??= this.get<TrelloCustomFieldDef[]>(`${this.boardPath()}/customFields`);
    return this.fieldsPromise;
  }

  private card(id: string): Promise<TrelloCard> {
    let card = this.cards.get(id);
    if (!card) {
      card = this.get<TrelloCard>(`/cards/${encodeURIComponent(id)}`, {
        ...CARD_PARAMS,
        checklists: 'all',
      });
      this.cards.set(id, card);
    }
    return card;
  }

  // The id of a linked card when it is on this board. A card that was deleted, that
  // the token cannot see, or whose short link is malformed (400) is not linked.
  private cardIdOnBoard(shortLink: string): Promise<string | null> {
    let id = this.linkedCards.get(shortLink);
    if (!id) {
      id = this.get<{ id: string; idBoard: string } | null>(
        `/cards/${encodeURIComponent(shortLink)}`,
        { fields: 'idBoard' },
        [400, 401, 403, 404],
      ).then((card) => (card?.idBoard === this.scope.boardId ? card.id : null));
      this.linkedCards.set(shortLink, id);
    }
    return id;
  }

  // A status in `missing` answers null instead of failing the request.
  private async get<T>(
    path: string,
    params: Record<string, string> = {},
    missing: number[] = [],
  ): Promise<T> {
    const query = new URLSearchParams(params).toString();
    const res = await this.fetch(`${TRELLO_API_URL}${path}${query ? `?${query}` : ''}`, {
      headers: { Authorization: trelloAuthorization(this.credential) },
      timeoutMs: REQUEST_TIMEOUT_MS,
    });
    if (res.status === 429) {
      throw new SourceRateLimitedError(RATE_LIMIT_WAIT_MS, 'Trello rate limit reached');
    }
    if (missing.includes(res.status)) return null as T;
    if (!res.ok) throw new Error(`Trello request failed: HTTP ${res.status}`);
    return (await res.json()) as T;
  }
}
