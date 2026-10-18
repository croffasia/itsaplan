import { pinnedFetch } from '@repo/net';
import { resolveRedirects, retryAfterMs } from './download-redirects';
import {
  SourceRateLimitedError,
  type AttachmentDownload,
  type Page,
  type SourceReader,
} from './reader';
import type {
  CanonicalAttachment,
  CanonicalComment,
  CanonicalCycle,
  CanonicalIssue,
  CanonicalLabel,
  CanonicalRelation,
  CanonicalState,
} from './canonical';
import {
  mapTrelloAttachments,
  mapTrelloCard,
  mapTrelloComments,
  mapTrelloLabels,
  mapTrelloLists,
  mapTrelloMemberEmails,
  trelloNextCursor,
  type TrelloAttachment,
  type TrelloCard,
  type TrelloCommentAction,
  type TrelloLabel,
  type TrelloList,
  type TrelloMember,
} from './trello-mapping';

// The SourceReader for Trello: its REST API at the fixed https://api.trello.com/1,
// with an API key and a user token in the OAuth Authorization header (attachment
// downloads accept no other form). docs/dev/trello-import.md has the details.

export interface TrelloCredential {
  apiKey: string;
  token: string;
}

export const TRELLO_API_URL = 'https://api.trello.com/1';
const API_HOST = 'api.trello.com';
const PAGE_SIZE = 1000;
const REQUEST_TIMEOUT_MS = 15_000;
const CARD_FIELDS =
  'idShort,name,desc,idList,idLabels,idMembers,start,due,dateLastActivity,shortUrl';
const CARD_PARAMS = `fields=${CARD_FIELDS}&checklists=all&attachments=true&attachment_fields=name,url,isUpload,mimeType,bytes,fileName`;

export function trelloAuthHeader(credential: TrelloCredential): string {
  return `OAuth oauth_consumer_key="${credential.apiKey}", oauth_token="${credential.token}"`;
}

// Trello's own attachment URL is on trello.com, which refuses the header; the same
// path on api.trello.com serves the file.
export function trelloDownloadUrl(url: string): string {
  const parsed = new URL(url);
  if (parsed.hostname === 'trello.com') parsed.hostname = API_HOST;
  return parsed.toString();
}

// Trello: 100 requests per 10 seconds per token.
const RATE_LIMIT_WAIT_MS = 10_000;

export class TrelloReader implements SourceReader {
  private readonly auth: string;
  private emails: Promise<Map<string, string>> | null = null;
  private readonly cards = new Map<string, Promise<TrelloCard>>();

  constructor(
    credential: TrelloCredential,
    private readonly boardId: string,
    private readonly fetch: typeof pinnedFetch = pinnedFetch,
  ) {
    this.auth = trelloAuthHeader(credential);
  }

  // Archived lists are included: their cards are imported too.
  async listStates(): Promise<CanonicalState[]> {
    return mapTrelloLists(
      await this.get<TrelloList[]>(`/boards/${this.board}/lists?filter=all&fields=name,closed`),
    );
  }

  async listLabels(): Promise<CanonicalLabel[]> {
    return mapTrelloLabels(
      await this.get<TrelloLabel[]>(`/boards/${this.board}/labels?limit=1000&fields=name,color`),
    );
  }

  async listCycles(): Promise<CanonicalCycle[]> {
    return [];
  }

  async listIssues(cursor: string | null): Promise<Page<CanonicalIssue>> {
    const before = cursor ? `&before=${encodeURIComponent(cursor)}` : '';
    const [cards, emails] = await Promise.all([
      this.get<TrelloCard[]>(
        `/boards/${this.board}/cards/all?limit=${PAGE_SIZE}${before}&${CARD_PARAMS}`,
      ),
      this.memberEmails(),
    ]);
    return {
      items: cards.map((card) => mapTrelloCard(card, emails)),
      cursor: trelloNextCursor(cards, PAGE_SIZE),
    };
  }

  async getIssue(sourceId: string): Promise<CanonicalIssue> {
    const [card, emails] = await Promise.all([this.card(sourceId), this.memberEmails()]);
    return mapTrelloCard(card, emails);
  }

  async listIssueRelations(): Promise<CanonicalRelation[]> {
    return [];
  }

  async listIssueComments(issueSourceId: string): Promise<CanonicalComment[]> {
    const all: TrelloCommentAction[] = [];
    let before = '';
    for (;;) {
      const page = await this.get<TrelloCommentAction[]>(
        `/cards/${encodeURIComponent(issueSourceId)}/actions?filter=commentCard&limit=${PAGE_SIZE}${before}`,
      );
      all.push(...page);
      const next = trelloNextCursor(page, PAGE_SIZE);
      if (!next) break;
      before = `&before=${next}`;
    }
    return mapTrelloComments(all, await this.memberEmails());
  }

  async listIssueAttachments(issueSourceId: string): Promise<CanonicalAttachment[]> {
    return mapTrelloAttachments((await this.card(issueSourceId)).attachments ?? []);
  }

  async resolveAttachmentDownload(
    issueSourceId: string,
    attachmentSourceId: string,
  ): Promise<AttachmentDownload> {
    const attachment = await this.get<TrelloAttachment>(
      `/cards/${encodeURIComponent(issueSourceId)}/attachments/${encodeURIComponent(attachmentSourceId)}?fields=url`,
    );
    return resolveRedirects(
      this.fetch,
      trelloDownloadUrl(attachment.url),
      (url) => (new URL(url).hostname === API_HOST ? { Authorization: this.auth } : undefined),
      'Trello',
    );
  }

  private get board(): string {
    return encodeURIComponent(this.boardId);
  }

  private card(id: string): Promise<TrelloCard> {
    let card = this.cards.get(id);
    if (!card) {
      card = this.get<TrelloCard>(`/cards/${encodeURIComponent(id)}?${CARD_PARAMS}`);
      this.cards.set(id, card);
    }
    return card;
  }

  private memberEmails(): Promise<Map<string, string>> {
    this.emails ??= this.get<TrelloMember[]>(
      `/boards/${this.board}/members?fields=fullName,username,email`,
    ).then(mapTrelloMemberEmails);
    return this.emails;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await this.fetch(`${TRELLO_API_URL}${path}`, {
      headers: { Authorization: this.auth, Accept: 'application/json' },
      timeoutMs: REQUEST_TIMEOUT_MS,
    });
    if (res.status === 429) {
      throw new SourceRateLimitedError(
        retryAfterMs(res.headers, RATE_LIMIT_WAIT_MS),
        'Trello rate limit reached',
      );
    }
    if (!res.ok) throw new Error(`Trello request failed: HTTP ${res.status}`);
    return (await res.json()) as T;
  }
}
