import { pinnedFetch } from '@repo/net';
import { AttachmentRejectedError } from './attachment-download';
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
  extractLinearUploads,
  linearNextCursor,
  linearUploadUrl,
  mapLinearComments,
  mapLinearCycles,
  mapLinearIssue,
  mapLinearLabels,
  mapLinearRelations,
  mapLinearStates,
  type LinearCommentNode,
  type LinearConnection,
  type LinearCycleNode,
  type LinearIssueNode,
  type LinearLabelNode,
  type LinearRelationNode,
  type LinearScope,
  type LinearStateNode,
} from './linear-mapping';

// The SourceReader for Linear: its GraphQL API with a personal API key, sent as
// "Authorization: <key>" (no "Bearer"). docs/dev/linear-import.md has the details.

export interface LinearCredential {
  apiKey: string;
}

export const LINEAR_GRAPHQL_URL = 'https://api.linear.app/graphql';
const UPLOAD_HOST = 'uploads.linear.app';
// 50 issues with their labels and links stay well inside Linear's 10,000-point
// limit for one query.
const PAGE_SIZE = 50;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_UPLOAD_REDIRECTS = 3;
// Linear's budgets refill over an hour, so no reset is honoured beyond that.
const MAX_RATE_LIMIT_WAIT_MS = 3_600_000;

const ISSUE_FIELDS = `
  id identifier number title description priority dueDate createdAt updatedAt trashed
  state { id }
  assignee { email }
  cycle { id }
  parent { id identifier team { id } project { id } }
  labels(first: ${PAGE_SIZE}, includeArchived: true) { nodes { id } pageInfo { hasNextPage } }
  attachments(first: ${PAGE_SIZE}, includeArchived: true) { nodes { title url } pageInfo { hasNextPage } }
`;

const STATES_QUERY = `query States($teamId: String!, $after: String) {
  team(id: $teamId) {
    connection: states(first: ${PAGE_SIZE}, after: $after, includeArchived: true) {
      nodes { id name type }
      pageInfo { hasNextPage endCursor }
    }
  }
}`;

const LABELS_QUERY = `query Labels($teamId: ID!, $after: String) {
  connection: issueLabels(
    first: ${PAGE_SIZE}
    after: $after
    includeArchived: true
    filter: { or: [{ team: { id: { eq: $teamId } } }, { team: { null: true } }] }
  ) {
    nodes { id name color isGroup parent { name } }
    pageInfo { hasNextPage endCursor }
  }
}`;

const CYCLES_QUERY = `query Cycles($teamId: String!, $after: String) {
  team(id: $teamId) {
    connection: cycles(first: ${PAGE_SIZE}, after: $after, includeArchived: true) {
      nodes { id number name startsAt endsAt description }
      pageInfo { hasNextPage endCursor }
    }
  }
}`;

const ISSUES_QUERY = `query Issues($filter: IssueFilter!, $after: String) {
  connection: issues(
    first: ${PAGE_SIZE}
    after: $after
    filter: $filter
    includeArchived: true
    orderBy: createdAt
  ) {
    nodes { ${ISSUE_FIELDS} }
    pageInfo { hasNextPage endCursor }
  }
}`;

const ISSUE_QUERY = `query Issue($id: String!) {
  issue(id: $id) { ${ISSUE_FIELDS} }
}`;

const RELATIONS_QUERY = `query Relations($id: String!, $after: String) {
  issue(id: $id) {
    connection: relations(first: ${PAGE_SIZE}, after: $after) {
      nodes { type relatedIssue { id } }
      pageInfo { hasNextPage endCursor }
    }
  }
}`;

const COMMENTS_QUERY = `query Comments($id: String!, $after: String) {
  issue(id: $id) {
    connection: comments(first: ${PAGE_SIZE}, after: $after, includeArchived: true) {
      nodes {
        id body createdAt
        parent { id }
        user { email name }
        botActor { name }
        externalUser { name }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
}`;

interface GraphqlResponse<D> {
  data?: D | null;
  errors?: { message: string; extensions?: { code?: string } }[];
}

type ConnectionData<T> = { connection: LinearConnection<T> };
type TeamConnectionData<T> = { team: ConnectionData<T> };
type IssueConnectionData<T> = { issue: ConnectionData<T> };

const RATE_LIMIT_HEADERS = ['requests', 'complexity', 'endpoint-requests'].map((kind) => ({
  remaining: `x-ratelimit-${kind}-remaining`,
  reset: `x-ratelimit-${kind}-reset`,
}));

// Linear answers a rate-limited request with HTTP 400 and the GraphQL error code
// RATELIMITED (429 is handled the same). Its reset headers are epoch milliseconds;
// the wait runs to the latest reset of a budget that is used up, capped at an hour.
export function linearRateLimitBackoffMs(
  response: { status: number; errorCodes: string[]; headers: Headers },
  nowMs = Date.now(),
): number | null {
  if (response.status !== 429 && !response.errorCodes.includes('RATELIMITED')) return null;
  const resets = RATE_LIMIT_HEADERS.flatMap(({ remaining, reset }) => {
    const left = response.headers.get(remaining);
    const at = Number(response.headers.get(reset));
    return left !== null && Number(left) <= 0 && at > 0 ? [at] : [];
  });
  if (resets.length === 0) return 60_000;
  return Math.min(MAX_RATE_LIMIT_WAIT_MS, Math.max(1000, Math.max(...resets) - nowMs));
}

export type UploadHop =
  { kind: 'download' } | { kind: 'redirect'; url: string } | { kind: 'refused' };

// What one response from the file host means for resolveAttachmentDownload.
export function nextUploadHop(
  currentUrl: string,
  status: number,
  location: string | null,
): UploadHop {
  if (status >= 200 && status < 300) return { kind: 'download' };
  if (status < 300 || status >= 400) return { kind: 'refused' };
  if (!location) throw new AttachmentRejectedError('Linear file storage redirected nowhere');
  const next = new URL(location, currentUrl);
  if (next.protocol !== 'https:') {
    throw new AttachmentRejectedError('Linear file storage redirected to a non-https URL');
  }
  return { kind: 'redirect', url: next.toString() };
}

// The API key goes to Linear's own file host only, never to wherever it redirects.
export function linearUploadHeaders(
  url: string,
  apiKey: string,
): Record<string, string> | undefined {
  return new URL(url).hostname === UPLOAD_HOST ? { Authorization: apiKey } : undefined;
}

// The nested label and link connections are read as one page of 50; more would be
// silently dropped, so the import stops instead.
function assertComplete(issue: LinearIssueNode): LinearIssueNode {
  for (const name of ['labels', 'attachments'] as const) {
    if (issue[name].pageInfo?.hasNextPage) {
      throw new Error(
        `Linear issue ${issue.identifier} has more than ${PAGE_SIZE} ${name}; stopping to avoid a truncated import`,
      );
    }
  }
  return issue;
}

export class LinearReader implements SourceReader {
  // One tick's Create step reads an issue, its comments and its uploads; these keep
  // that to one request each. A reader lives for one tick.
  private readonly issueNodes = new Map<string, Promise<LinearIssueNode>>();
  private readonly commentNodes = new Map<string, Promise<LinearCommentNode[]>>();

  constructor(
    private readonly credential: LinearCredential,
    private readonly scope: LinearScope,
    private readonly fetch: typeof pinnedFetch = pinnedFetch,
  ) {
    if (scope.projectFilter === 'project' && !scope.projectId) {
      throw new Error('Linear scope needs a projectId when projectFilter is "project"');
    }
  }

  async listStates(): Promise<CanonicalState[]> {
    const nodes = await this.paginate<LinearStateNode, TeamConnectionData<LinearStateNode>>(
      STATES_QUERY,
      { teamId: this.scope.teamId },
      (data) => data.team.connection,
    );
    return mapLinearStates(nodes);
  }

  async listLabels(): Promise<CanonicalLabel[]> {
    const nodes = await this.paginate<LinearLabelNode, ConnectionData<LinearLabelNode>>(
      LABELS_QUERY,
      { teamId: this.scope.teamId },
      (data) => data.connection,
    );
    return mapLinearLabels(nodes);
  }

  async listCycles(): Promise<CanonicalCycle[]> {
    const nodes = await this.paginate<LinearCycleNode, TeamConnectionData<LinearCycleNode>>(
      CYCLES_QUERY,
      { teamId: this.scope.teamId },
      (data) => data.team.connection,
    );
    return mapLinearCycles(nodes);
  }

  async listIssues(cursor: string | null): Promise<Page<CanonicalIssue>> {
    const project =
      this.scope.projectFilter === 'none' ? { null: true } : { id: { eq: this.scope.projectId } };
    const data = await this.graphql<ConnectionData<LinearIssueNode>>(ISSUES_QUERY, {
      filter: { team: { id: { eq: this.scope.teamId } }, project },
      after: cursor,
    });
    // includeArchived also returns issues in Linear's trash, which are deleted there.
    const kept = data.connection.nodes.filter((node) => !node.trashed);
    return {
      items: kept.map((node) => mapLinearIssue(assertComplete(node), this.scope)),
      cursor: linearNextCursor(data.connection.pageInfo),
    };
  }

  async getIssue(sourceId: string): Promise<CanonicalIssue> {
    return mapLinearIssue(await this.issueNode(sourceId), this.scope);
  }

  async listIssueRelations(issueSourceId: string): Promise<CanonicalRelation[]> {
    const nodes = await this.paginate<LinearRelationNode, IssueConnectionData<LinearRelationNode>>(
      RELATIONS_QUERY,
      { id: issueSourceId },
      (data) => data.issue.connection,
    );
    return mapLinearRelations(issueSourceId, nodes);
  }

  async listIssueComments(issueSourceId: string): Promise<CanonicalComment[]> {
    return mapLinearComments(await this.commentNodesOf(issueSourceId));
  }

  async listIssueAttachments(issueSourceId: string): Promise<CanonicalAttachment[]> {
    const [issue, comments] = await Promise.all([
      this.issueNode(issueSourceId),
      this.commentNodesOf(issueSourceId),
    ]);
    const bodies = mapLinearComments(comments).map((c) => c.bodyMarkdown);
    return extractLinearUploads(
      issueSourceId,
      [issue.description, ...bodies],
      issue.attachments.nodes,
    );
  }

  // uploads.linear.app needs the API key; whether it serves the file or redirects
  // to signed storage, pinnedFetch follows no redirect, so each hop is taken here.
  // Every hop only reads the response head.
  async resolveAttachmentDownload(
    issueSourceId: string,
    attachmentSourceId: string,
  ): Promise<AttachmentDownload> {
    let url = linearUploadUrl(issueSourceId, attachmentSourceId);
    for (let hop = 0; hop <= MAX_UPLOAD_REDIRECTS; hop++) {
      const headers = linearUploadHeaders(url, this.credential.apiKey);
      const res = await this.fetch(url, {
        headers,
        timeoutMs: REQUEST_TIMEOUT_MS,
        maxBytes: 0,
        truncateBody: true,
      });
      if (res.status === 429) throw new SourceRateLimitedError(60_000, 'Linear rate limit reached');
      const next = nextUploadHop(url, res.status, res.headers.get('location'));
      if (next.kind === 'download') return headers ? { url, headers } : { url };
      if (next.kind === 'refused') {
        throw new AttachmentRejectedError(`Linear file storage answered HTTP ${res.status}`);
      }
      url = next.url;
    }
    throw new AttachmentRejectedError(
      `Linear file storage redirected more than ${MAX_UPLOAD_REDIRECTS} times`,
    );
  }

  private issueNode(id: string): Promise<LinearIssueNode> {
    let node = this.issueNodes.get(id);
    if (!node) {
      node = this.graphql<{ issue: LinearIssueNode }>(ISSUE_QUERY, { id }).then((d) =>
        assertComplete(d.issue),
      );
      this.issueNodes.set(id, node);
    }
    return node;
  }

  private commentNodesOf(id: string): Promise<LinearCommentNode[]> {
    let nodes = this.commentNodes.get(id);
    if (!nodes) {
      nodes = this.paginate<LinearCommentNode, IssueConnectionData<LinearCommentNode>>(
        COMMENTS_QUERY,
        { id },
        (data) => data.issue.connection,
      );
      this.commentNodes.set(id, nodes);
    }
    return nodes;
  }

  private async paginate<T, D>(
    query: string,
    variables: Record<string, unknown>,
    connectionOf: (data: D) => LinearConnection<T>,
  ): Promise<T[]> {
    const all: T[] = [];
    let after: string | null = null;
    do {
      const connection = connectionOf(await this.graphql<D>(query, { ...variables, after }));
      all.push(...connection.nodes);
      after = linearNextCursor(connection.pageInfo);
    } while (after !== null);
    return all;
  }

  private async graphql<D>(query: string, variables: Record<string, unknown>): Promise<D> {
    const res = await this.fetch(LINEAR_GRAPHQL_URL, {
      method: 'POST',
      headers: { Authorization: this.credential.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      timeoutMs: REQUEST_TIMEOUT_MS,
    });
    const body = (await res.json().catch(() => ({}))) as GraphqlResponse<D>;
    const errors = body.errors ?? [];
    const backoff = linearRateLimitBackoffMs({
      status: res.status,
      errorCodes: errors.map((e) => e.extensions?.code ?? ''),
      headers: res.headers,
    });
    if (backoff !== null) throw new SourceRateLimitedError(backoff, 'Linear rate limit reached');
    if (errors.length > 0) throw new Error(`Linear request failed: ${errors[0]!.message}`);
    if (!res.ok || !body.data) throw new Error(`Linear request failed: HTTP ${res.status}`);
    return body.data;
  }
}
