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
  mapProcoreAttachments,
  mapProcoreIssue,
  mapProcoreRfiReplies,
  procoreNextPage,
  procoreStates,
  type ProcoreItem,
  type ProcoreRfi,
  type ProcoreTool,
} from './procore-mapping';

// The SourceReader for Procore: the REST API at Procore's fixed hosts, with a bearer
// token from the client-credentials grant of a Developer Managed Service Account.
// docs/dev/procore-import.md has the details, including what is unverified.

export interface ProcoreCredential {
  clientId: string;
  clientSecret: string;
  companyId: string;
  sandbox?: boolean;
}

export function procoreHosts(sandbox: boolean | undefined) {
  return sandbox
    ? { api: 'https://sandbox.procore.com', login: 'https://login-sandbox.procore.com' }
    : { api: 'https://api.procore.com', login: 'https://login.procore.com' };
}

// The bearer token goes to Procore's own hosts only.
export function isProcoreHost(hostname: string): boolean {
  return hostname === 'procore.com' || hostname.endsWith('.procore.com');
}

const PAGE_SIZE = 100;
const REQUEST_TIMEOUT_MS = 15_000;
const RATE_LIMIT_WAIT_MS = 60_000;
const TOKEN_EXPIRY_MARGIN_MS = 60_000;

// X-Rate-Limit-Reset is read as seconds until the window resets, or as a Unix time.
export function procoreRetryAfterMs(headers: Headers, now = Date.now()): number {
  if (headers.get('retry-after')) return retryAfterMs(headers, RATE_LIMIT_WAIT_MS);
  const reset = Number(headers.get('x-rate-limit-reset'));
  if (!Number.isFinite(reset) || reset <= 0) return RATE_LIMIT_WAIT_MS;
  const seconds = reset > 1e9 ? reset - now / 1000 : reset;
  return Math.min(3_600_000, Math.max(1000, seconds * 1000));
}

export class ProcoreReader implements SourceReader {
  private readonly hosts: ReturnType<typeof procoreHosts>;
  private token: { value: string; expiresAt: number } | null = null;
  private readonly items = new Map<string, Promise<ProcoreItem>>();

  constructor(
    private readonly credential: ProcoreCredential,
    private readonly projectId: string,
    private readonly tool: ProcoreTool,
    private readonly fetch: typeof pinnedFetch = pinnedFetch,
    private readonly now: () => number = Date.now,
  ) {
    this.hosts = procoreHosts(credential.sandbox);
  }

  async listStates(): Promise<CanonicalState[]> {
    return procoreStates(this.tool);
  }

  async listLabels(): Promise<CanonicalLabel[]> {
    return [];
  }

  async listCycles(): Promise<CanonicalCycle[]> {
    return [];
  }

  async listIssues(cursor: string | null): Promise<Page<CanonicalIssue>> {
    const page = cursor ? Number(cursor) : 1;
    const res = await this.request(`${this.listPath()}${this.listQuery(page)}`);
    const items = (await res.json()) as ProcoreItem[];
    const next = procoreNextPage(res.headers, page, PAGE_SIZE, items.length);
    return {
      items: items.map((item) => mapProcoreIssue(this.tool, item)),
      cursor: next === null ? null : String(next),
    };
  }

  async getIssue(sourceId: string): Promise<CanonicalIssue> {
    return mapProcoreIssue(this.tool, await this.item(sourceId));
  }

  async listIssueRelations(): Promise<CanonicalRelation[]> {
    return [];
  }

  async listIssueComments(issueSourceId: string): Promise<CanonicalComment[]> {
    if (this.tool !== 'rfis') return [];
    return mapProcoreRfiReplies((await this.item(issueSourceId)) as ProcoreRfi);
  }

  async listIssueAttachments(issueSourceId: string): Promise<CanonicalAttachment[]> {
    return mapProcoreAttachments((await this.item(issueSourceId)).attachments);
  }

  async resolveAttachmentDownload(
    issueSourceId: string,
    attachmentSourceId: string,
  ): Promise<AttachmentDownload> {
    this.items.delete(issueSourceId);
    const attachment = (await this.item(issueSourceId)).attachments?.find(
      (a) => String(a.id) === attachmentSourceId,
    );
    if (!attachment?.url) throw new Error('Procore attachment has no download URL');
    const auth = {
      Authorization: `Bearer ${await this.accessToken()}`,
      'Procore-Company-Id': this.credential.companyId,
    };
    return resolveRedirects(
      this.fetch,
      new URL(attachment.url, this.hosts.api).toString(),
      (url) => (isProcoreHost(new URL(url).hostname) ? auth : undefined),
      'Procore',
    );
  }

  private get project(): string {
    return encodeURIComponent(this.projectId);
  }

  private listPath(): string {
    return this.tool === 'rfis'
      ? `/rest/v1.0/projects/${this.project}/rfis`
      : '/rest/v1.0/punch_items';
  }

  private listQuery(page: number): string {
    const project = this.tool === 'rfis' ? '' : `project_id=${this.project}&`;
    return `?${project}page=${page}&per_page=${PAGE_SIZE}`;
  }

  private item(id: string): Promise<ProcoreItem> {
    let item = this.items.get(id);
    if (!item) {
      const path =
        this.tool === 'rfis'
          ? `/rest/v1.0/projects/${this.project}/rfis/${encodeURIComponent(id)}`
          : `/rest/v1.0/punch_items/${encodeURIComponent(id)}?project_id=${this.project}`;
      item = this.request(path).then((res) => res.json() as Promise<ProcoreItem>);
      this.items.set(id, item);
    }
    return item;
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > this.now()) return this.token.value;
    const res = await this.fetch(`${this.hosts.login}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.credential.clientId,
        client_secret: this.credential.clientSecret,
      }).toString(),
      timeoutMs: REQUEST_TIMEOUT_MS,
    });
    if (res.status === 429) {
      throw new SourceRateLimitedError(
        procoreRetryAfterMs(res.headers, this.now()),
        'Procore rate limit reached',
      );
    }
    if (!res.ok) throw new Error(`Procore token request failed: HTTP ${res.status}`);
    const body = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token) throw new Error('Procore token response has no access_token');
    this.token = {
      value: body.access_token,
      expiresAt: this.now() + Math.max(0, (body.expires_in ?? 0) * 1000 - TOKEN_EXPIRY_MARGIN_MS),
    };
    return this.token.value;
  }

  private async request(path: string, retriedAuth = false): Promise<Response> {
    const res = await this.fetch(`${this.hosts.api}${path}`, {
      headers: {
        Authorization: `Bearer ${await this.accessToken()}`,
        'Procore-Company-Id': this.credential.companyId,
        Accept: 'application/json',
      },
      timeoutMs: REQUEST_TIMEOUT_MS,
    });
    if (res.status === 429) {
      throw new SourceRateLimitedError(
        procoreRetryAfterMs(res.headers, this.now()),
        'Procore rate limit reached',
      );
    }
    if (res.status === 401 && !retriedAuth) {
      this.token = null;
      return this.request(path, true);
    }
    if (!res.ok) throw new Error(`Procore request failed: HTTP ${res.status}`);
    return res;
  }
}
