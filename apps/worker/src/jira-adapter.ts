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
  jiraIssueSprints,
  mapJiraAttachments,
  mapJiraComments,
  mapJiraIssue,
  mapJiraLabels,
  mapJiraLinks,
  mapJiraSprints,
  mapJiraStatuses,
  type JiraComment,
  type JiraIssue,
  type JiraSprint,
  type JiraStatus,
} from './jira-mapping';

// The SourceReader for Jira Cloud: REST v3 at the site's own
// https://<site>.atlassian.net, with Basic auth of the account email and an API
// token. docs/dev/jira-import.md has the details.

export interface JiraCredential {
  baseUrl: string;
  email: string;
  apiToken: string;
}

const PAGE_SIZE = 100;
const REQUEST_TIMEOUT_MS = 15_000;
const SPRINT_SCHEMA = 'com.pyxis.greenhopper.jira:gh-sprint';
const ISSUE_FIELDS = [
  'summary',
  'description',
  'status',
  'priority',
  'assignee',
  'labels',
  'parent',
  'duedate',
  'created',
  'updated',
  'issuelinks',
  'attachment',
];

// Jira Cloud only: the credential is sent to this host, so it must be Atlassian's.
export function isJiraCloudUrl(baseUrl: string): boolean {
  try {
    const url = new URL(baseUrl);
    return (
      url.protocol === 'https:' && url.hostname.endsWith('.atlassian.net') && url.origin === baseUrl
    );
  } catch {
    return false;
  }
}

export function jiraAuthHeader(credential: JiraCredential): string {
  return `Basic ${Buffer.from(`${credential.email}:${credential.apiToken}`).toString('base64')}`;
}

interface SearchPage {
  issues: JiraIssue[];
  nextPageToken?: string | null;
  isLast?: boolean;
}

// /search/jql pages by an opaque token. A missing token ends the walk even when
// isLast is absent.
export function jiraNextCursor(page: SearchPage): string | null {
  if (page.isLast === true) return null;
  return page.nextPageToken || null;
}

export class JiraReader implements SourceReader {
  private readonly auth: string;
  private sprintField: Promise<string | null> | null = null;
  private readonly issues = new Map<string, Promise<JiraIssue>>();

  constructor(
    private readonly credential: JiraCredential,
    private readonly projectKey: string,
    private readonly fetch: typeof pinnedFetch = pinnedFetch,
  ) {
    if (!isJiraCloudUrl(credential.baseUrl)) {
      throw new Error('Jira base URL must be an https://<site>.atlassian.net origin');
    }
    this.auth = jiraAuthHeader(credential);
  }

  async listStates(): Promise<CanonicalState[]> {
    const types = await this.get<{ statuses: JiraStatus[] }[]>(
      `/rest/api/3/project/${encodeURIComponent(this.projectKey)}/statuses`,
    );
    return mapJiraStatuses(types);
  }

  // Jira has no per-project label list; the project's issues are scanned for them.
  async listLabels(): Promise<CanonicalLabel[]> {
    const names: string[] = [];
    await this.scan(['labels'], (issue) => names.push(...(issue.fields.labels ?? [])));
    return mapJiraLabels(names);
  }

  // Sprints come from the issues too: a board can span several projects.
  async listCycles(): Promise<CanonicalCycle[]> {
    const field = await this.sprintFieldId();
    if (!field) return [];
    const sprints = new Map<number, JiraSprint>();
    await this.scan([field], (issue) => {
      for (const s of jiraIssueSprints(issue.fields, field)) sprints.set(s.id, s);
    });
    return mapJiraSprints([...sprints.values()].sort((a, b) => a.id - b.id));
  }

  async listIssues(cursor: string | null): Promise<Page<CanonicalIssue>> {
    const field = await this.sprintFieldId();
    const page = await this.search(field ? [...ISSUE_FIELDS, field] : ISSUE_FIELDS, cursor);
    return {
      items: page.issues.map((issue) => mapJiraIssue(issue, this.scope(field))),
      cursor: jiraNextCursor(page),
    };
  }

  async getIssue(sourceId: string): Promise<CanonicalIssue> {
    const field = await this.sprintFieldId();
    return mapJiraIssue(await this.issue(sourceId), this.scope(field));
  }

  async listIssueRelations(issueSourceId: string): Promise<CanonicalRelation[]> {
    const issue = await this.issue(issueSourceId);
    return mapJiraLinks(issue.id, issue.fields.issuelinks ?? []);
  }

  async listIssueComments(issueSourceId: string): Promise<CanonicalComment[]> {
    const all: JiraComment[] = [];
    for (let startAt = 0; ;) {
      const page = await this.get<{ comments: JiraComment[]; total: number }>(
        `/rest/api/3/issue/${encodeURIComponent(issueSourceId)}/comment?orderBy=created&maxResults=${PAGE_SIZE}&startAt=${startAt}`,
      );
      all.push(...page.comments);
      startAt += page.comments.length;
      if (page.comments.length === 0 || startAt >= page.total) break;
    }
    return mapJiraComments(all);
  }

  async listIssueAttachments(issueSourceId: string): Promise<CanonicalAttachment[]> {
    return mapJiraAttachments((await this.issue(issueSourceId)).fields.attachment ?? []);
  }

  // The content URL answers with a redirect to Atlassian's media storage; the
  // credential goes to the site's own host only.
  async resolveAttachmentDownload(
    _issueSourceId: string,
    attachmentSourceId: string,
  ): Promise<AttachmentDownload> {
    const site = new URL(this.credential.baseUrl).hostname;
    return resolveRedirects(
      this.fetch,
      `${this.credential.baseUrl}/rest/api/3/attachment/content/${encodeURIComponent(attachmentSourceId)}`,
      (url) => (new URL(url).hostname === site ? { Authorization: this.auth } : undefined),
      'Jira',
    );
  }

  private scope(sprintField: string | null) {
    return { projectKey: this.projectKey, sprintField };
  }

  private issue(id: string): Promise<JiraIssue> {
    let issue = this.issues.get(id);
    if (!issue) {
      issue = this.sprintFieldId().then((field) =>
        this.get<JiraIssue>(
          `/rest/api/3/issue/${encodeURIComponent(id)}?fields=${[...ISSUE_FIELDS, ...(field ? [field] : [])].join(',')}`,
        ),
      );
      this.issues.set(id, issue);
    }
    return issue;
  }

  private sprintFieldId(): Promise<string | null> {
    this.sprintField ??= this.get<{ id: string; schema?: { custom?: string } }[]>(
      '/rest/api/3/field',
    ).then((fields) => fields.find((f) => f.schema?.custom === SPRINT_SCHEMA)?.id ?? null);
    return this.sprintField;
  }

  private async scan(fields: string[], visit: (issue: JiraIssue) => void): Promise<void> {
    let cursor: string | null = null;
    do {
      const page: SearchPage = await this.search(fields, cursor);
      page.issues.forEach(visit);
      cursor = jiraNextCursor(page);
    } while (cursor !== null);
  }

  private search(fields: string[], cursor: string | null): Promise<SearchPage> {
    const params = new URLSearchParams({
      jql: `project = "${this.projectKey.replace(/"/g, '')}" ORDER BY created ASC`,
      fields: fields.join(','),
      maxResults: String(PAGE_SIZE),
    });
    if (cursor) params.set('nextPageToken', cursor);
    return this.get<SearchPage>(`/rest/api/3/search/jql?${params}`);
  }

  private async get<T>(path: string): Promise<T> {
    const res = await this.fetch(`${this.credential.baseUrl}${path}`, {
      headers: { Authorization: this.auth, Accept: 'application/json' },
      timeoutMs: REQUEST_TIMEOUT_MS,
    });
    if (res.status === 429) {
      throw new SourceRateLimitedError(
        retryAfterMs(res.headers, 60_000),
        'Jira rate limit reached',
      );
    }
    if (!res.ok) throw new Error(`Jira request failed: HTTP ${res.status}`);
    return (await res.json()) as T;
  }
}
