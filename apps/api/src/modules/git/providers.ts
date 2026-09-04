import { createHmac, timingSafeEqual } from 'node:crypto';

// The provider adapters behind the one inbound webhook receiver. An adapter
// recognises a delivery by its headers, verifies it with the credential its
// platform sends, and normalizes pull request and CI events for the handler.

// A pull request delivery in provider-neutral form. `defaultBranch` is null when
// the payload does not carry it, which turns off the merged-into-default-branch
// check for that delivery.
export type GitProviderKey = 'github' | 'gitlab' | 'gitea' | 'forgejo' | 'bitbucket';
export type PullRequestState = 'open' | 'merged' | 'closed';
export type PipelineStatus = 'pending' | 'running' | 'success' | 'failed' | 'canceled' | 'skipped';

export interface PullRequestEvent {
  kind: 'pull_request';
  action: 'opened' | 'updated' | 'merged' | 'closed';
  number: number;
  title: string;
  body: string;
  url: string | null;
  repo: string;
  sourceBranch: string | null;
  targetBranch: string;
  headSha: string | null;
  defaultBranch: string | null;
  draft: boolean;
}

export interface BranchEvent {
  kind: 'branch';
  action: 'created' | 'deleted';
  repo: string;
  branch: string;
  url: string | null;
  headSha: string | null;
  defaultBranch: string | null;
}

export interface PipelineEvent {
  kind: 'pipeline';
  repo: string;
  pullRequestNumber: number | null;
  headSha: string | null;
  status: PipelineStatus;
  url: string | null;
}

export interface CheckEvent {
  kind: 'check';
  repo: string;
  pullRequestNumbers: number[];
  headSha: string;
  externalId: string;
  appId: string;
  name: string;
  status: PipelineStatus;
  url: string | null;
}

export type GitEvent = PullRequestEvent | BranchEvent | PipelineEvent | CheckEvent;

export type DeliveryHeaders = Record<string, string | undefined>;

export interface GitProvider {
  key(headers: DeliveryHeaders): GitProviderKey;
  // The actor of the activity entry the delivery creates. Gitea and Forgejo share
  // an adapter, so the name comes from the headers rather than a fixed string.
  label(headers: DeliveryHeaders): string;
  matches(headers: DeliveryHeaders): boolean;
  verify(secret: string, rawBody: string, headers: DeliveryHeaders): boolean;
  deliveryId(headers: DeliveryHeaders): string | undefined;
  // The repository the delivery came from, recorded as telemetry for any event.
  repo(payload: unknown): string | undefined;
  parse(payload: unknown, headers: DeliveryHeaders): GitEvent | null;
}

// An HMAC-SHA256 hex digest of the raw body, with or without the "sha256=" prefix
// the platform may put in front of it.
function hmacValid(secret: string, rawBody: string, signature: string | undefined): boolean {
  if (!signature) return false;
  const hex = signature.startsWith('sha256=') ? signature.slice('sha256='.length) : signature;
  const given = Buffer.from(hex, 'hex');
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// A shared token sent as-is, which is how GitLab authenticates a delivery.
function tokenValid(secret: string, token: string | undefined): boolean {
  if (token == null) return false;
  const given = Buffer.from(token);
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// The pull request URL is rendered as a link in the activity feed. Only http(s)
// passes, so a crafted delivery cannot plant a javascript: href; anything else
// becomes null and the entry carries no link.
function httpUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol) ? url : null;
  } catch {
    return null;
  }
}

function refPath(ref: string): string {
  return ref.split('/').map(encodeURIComponent).join('/');
}

// The slice of a GitHub pull_request payload the adapters read. Gitea and Forgejo
// send the same shape.
interface GithubPayload {
  action?: string;
  ref?: string;
  ref_type?: string;
  sha?: string;
  master_branch?: string;
  pull_request?: {
    number?: number;
    title?: string;
    body?: string | null;
    html_url?: string;
    merged?: boolean;
    draft?: boolean;
    base?: { ref?: string };
    head?: { ref?: string; sha?: string };
  };
  check_run?: {
    id?: number;
    name?: string;
    status?: string;
    conclusion?: string | null;
    head_sha?: string;
    html_url?: string;
    details_url?: string | null;
    pull_requests?: { number?: number }[];
    app?: { id?: number };
  };
  repository?: { full_name?: string; default_branch?: string; html_url?: string };
}

function githubRepo(payload: unknown): string | undefined {
  return (payload as GithubPayload).repository?.full_name;
}

function pipelineStatus(status: string | undefined): PipelineStatus | null {
  const value = status;
  if (!value) return null;
  if (value === 'success' || value === 'passed') return 'success';
  if (
    value === 'failure' ||
    value === 'failed' ||
    value === 'timed_out' ||
    value === 'action_required' ||
    value === 'startup_failure'
  )
    return 'failed';
  if (value === 'cancelled' || value === 'canceled') return 'canceled';
  if (value === 'skipped' || value === 'neutral' || value === 'stale') return 'skipped';
  if (
    value === 'created' ||
    value === 'queued' ||
    value === 'waiting' ||
    value === 'waiting_for_resource' ||
    value === 'preparing' ||
    value === 'pending' ||
    value === 'manual' ||
    value === 'scheduled'
  )
    return 'pending';
  if (value === 'running' || value === 'in_progress') return 'running';
  return null;
}

function parseGithubPullRequest(payload: unknown): PullRequestEvent | null {
  const { action, pull_request: pr, repository } = payload as GithubPayload;
  if (!pr?.number || !repository?.full_name) return null;
  const merged = action === 'closed' && pr.merged === true;
  const closed = action === 'closed' && !merged;
  const opened = action === 'opened' || action === 'reopened' || action === 'ready_for_review';
  const updated =
    action === 'edited' || action === 'synchronize' || action === 'converted_to_draft';
  if (!opened && !updated && !merged && !closed) return null;
  return {
    kind: 'pull_request',
    action: merged ? 'merged' : closed ? 'closed' : opened ? 'opened' : 'updated',
    number: pr.number,
    title: pr.title ?? '',
    body: pr.body ?? '',
    url: httpUrl(pr.html_url),
    repo: repository.full_name,
    sourceBranch: pr.head?.ref ?? null,
    targetBranch: pr.base?.ref ?? '',
    headSha: pr.head?.sha ?? null,
    defaultBranch: repository.default_branch ?? null,
    draft: pr.draft === true,
  };
}

function parseGithubCheck(payload: unknown): CheckEvent | null {
  const { check_run: check, repository } = payload as GithubPayload;
  if (!check?.id || !check.name || !check.head_sha || !repository?.full_name) return null;
  const status =
    check.status === 'completed'
      ? pipelineStatus(check.conclusion ?? undefined)
      : pipelineStatus(check.status);
  if (!status) return null;
  return {
    kind: 'check',
    repo: repository.full_name,
    pullRequestNumbers: (check.pull_requests ?? [])
      .map((pullRequest) => pullRequest.number)
      .filter((number): number is number => number != null),
    headSha: check.head_sha,
    externalId: String(check.id),
    appId: String(check.app?.id ?? 'unknown'),
    name: check.name,
    status,
    url: httpUrl(check.details_url ?? check.html_url),
  };
}

function parseGithubBranch(payload: unknown, headers: DeliveryHeaders): BranchEvent | null {
  const value = payload as GithubPayload;
  const event = headers['x-github-event'] ?? headers['x-gitea-event'] ?? headers['x-forgejo-event'];
  if (!['create', 'delete'].includes(event ?? '') || value.ref_type !== 'branch') return null;
  if (!value.ref || !value.repository?.full_name) return null;
  const base = httpUrl(value.repository.html_url);
  return {
    kind: 'branch',
    action: event === 'delete' ? 'deleted' : 'created',
    repo: value.repository.full_name,
    branch: value.ref,
    url: base ? `${base}/tree/${refPath(value.ref)}` : null,
    headSha: event === 'delete' ? null : (value.sha ?? null),
    defaultBranch: value.repository.default_branch ?? value.master_branch ?? null,
  };
}

function parseGithubPayload(payload: unknown, headers: DeliveryHeaders): GitEvent | null {
  const event = headers['x-github-event'] ?? headers['x-gitea-event'] ?? headers['x-forgejo-event'];
  if (event === 'check_run') return parseGithubCheck(payload);
  if (event === 'create' || event === 'delete') return parseGithubBranch(payload, headers);
  return parseGithubPullRequest(payload);
}

const github: GitProvider = {
  key: () => 'github',
  label: () => 'GitHub',
  matches: (h) => h['x-github-event'] != null,
  verify: (secret, body, h) => hmacValid(secret, body, h['x-hub-signature-256']),
  deliveryId: (h) => h['x-github-delivery'],
  repo: githubRepo,
  parse: parseGithubPayload,
};

// Gitea and Forgejo send GitHub-shaped payloads under their own headers, plus
// GitHub's for compatibility — so this is matched before the GitHub adapter. Both
// repeat the same digest under every signature header they know, and a Forgejo
// delivery carries X-Gitea-Event too, so either header can be the one that arrives.
const gitea: GitProvider = {
  key: (h) => (h['x-forgejo-event'] != null ? 'forgejo' : 'gitea'),
  label: (h) => (h['x-forgejo-event'] != null ? 'Forgejo' : 'Gitea'),
  matches: (h) => h['x-gitea-event'] != null || h['x-forgejo-event'] != null,
  verify: (secret, body, h) =>
    hmacValid(
      secret,
      body,
      h['x-forgejo-signature'] ?? h['x-gitea-signature'] ?? h['x-hub-signature-256'],
    ),
  deliveryId: (h) => h['x-forgejo-delivery'] ?? h['x-gitea-delivery'],
  repo: githubRepo,
  parse: parseGithubPayload,
};

interface GitlabPayload {
  before?: string;
  after?: string;
  ref?: string;
  checkout_sha?: string;
  object_kind?: string;
  object_attributes?: {
    iid?: number;
    title?: string;
    description?: string | null;
    url?: string;
    action?: string;
    status?: string;
    ref?: string;
    web_url?: string;
    id?: number;
    source_branch?: string;
    target_branch?: string;
    sha?: string;
    last_commit?: { id?: string };
    merge_commit_sha?: string | null;
    squash_commit_sha?: string | null;
    draft?: boolean;
    work_in_progress?: boolean;
  };
  project?: { path_with_namespace?: string; default_branch?: string; web_url?: string };
  merge_request?: { iid?: number; source_branch?: string };
  changes?: { draft?: { previous?: boolean; current?: boolean } };
}

const gitlab: GitProvider = {
  key: () => 'gitlab',
  label: () => 'GitLab',
  matches: (h) => h['x-gitlab-event'] != null,
  // GitLab sends the secret token as-is instead of signing the body.
  verify: (secret, _body, h) => tokenValid(secret, h['x-gitlab-token']),
  // Idempotency-Key is the id GitLab keeps stable across retries. X-Gitlab-Event-UUID
  // is only a fallback for versions that predate it: events one webhook triggers in
  // turn share its value, so it cannot identify a delivery on its own.
  deliveryId: (h) => h['idempotency-key'] ?? h['x-gitlab-event-uuid'],
  repo: (payload) => (payload as GitlabPayload).project?.path_with_namespace,
  parse: (payload) => {
    const { object_kind: kind, object_attributes: mr, project, changes } = payload as GitlabPayload;
    if (!project?.path_with_namespace) return null;
    if (kind === 'push') {
      const push = payload as GitlabPayload;
      const branch = push.ref?.replace(/^refs\/heads\//, '');
      const zero = /^0+$/;
      const created = push.before != null && zero.test(push.before) && !zero.test(push.after ?? '');
      const deleted = push.after != null && zero.test(push.after);
      if (!branch || (!created && !deleted)) return null;
      return {
        kind: 'branch',
        action: deleted ? 'deleted' : 'created',
        repo: project.path_with_namespace,
        branch,
        url: project.web_url ? httpUrl(`${project.web_url}/-/tree/${refPath(branch)}`) : null,
        headSha: deleted ? null : (push.checkout_sha ?? push.after ?? null),
        defaultBranch: project.default_branch ?? null,
      };
    }
    if (kind === 'pipeline') {
      const pipeline = mr;
      const status = pipelineStatus(pipeline?.status);
      if (!status) return null;
      const pipelineUrl =
        pipeline?.url ??
        pipeline?.web_url ??
        (project.web_url && pipeline?.id
          ? `${project.web_url}/-/pipelines/${pipeline.id}`
          : undefined);
      return {
        kind: 'pipeline',
        repo: project.path_with_namespace,
        pullRequestNumber: (payload as GitlabPayload).merge_request?.iid ?? null,
        headSha: pipeline?.sha ?? null,
        status,
        url: httpUrl(pipelineUrl),
      };
    }
    if (kind !== 'merge_request' || !mr?.iid) return null;
    // Marking a draft merge request ready is one of the many edits GitLab reports
    // as "update"; only the changes diff says which one it was.
    const readied =
      mr.action === 'update' &&
      changes?.draft?.previous === true &&
      changes.draft.current === false;
    const opened = mr.action === 'open' || mr.action === 'reopen' || readied;
    const merged = mr.action === 'merge';
    const closed = mr.action === 'close';
    const updated = mr.action === 'update' && !readied;
    if (!opened && !merged && !closed && !updated) return null;
    return {
      kind: 'pull_request',
      action: merged ? 'merged' : closed ? 'closed' : opened ? 'opened' : 'updated',
      number: mr.iid,
      title: mr.title ?? '',
      body: mr.description ?? '',
      url: httpUrl(mr.url),
      repo: project.path_with_namespace,
      sourceBranch: mr.source_branch ?? null,
      targetBranch: mr.target_branch ?? '',
      headSha:
        (merged ? (mr.merge_commit_sha ?? mr.squash_commit_sha) : null) ??
        mr.last_commit?.id ??
        null,
      defaultBranch: project.default_branch ?? null,
      draft: mr.draft === true || mr.work_in_progress === true,
    };
  },
};

interface BitbucketPayload {
  branch?: {
    name?: string;
    target?: { hash?: string };
    links?: { html?: { href?: string } };
  };
  // Bitbucket documents branch lifecycle payloads using the same change shape
  // as a repository push. Some deliveries also expose the branch directly.
  push?: {
    changes?: {
      new?: {
        type?: string;
        name?: string;
        target?: { hash?: string };
        links?: { html?: { href?: string } };
      } | null;
      old?: {
        type?: string;
        name?: string;
        target?: { hash?: string };
        links?: { html?: { href?: string } };
      } | null;
    }[];
  };
  pullrequest?: {
    id?: number;
    title?: string;
    description?: string | null;
    draft?: boolean;
    destination?: { branch?: { name?: string } };
    source?: { branch?: { name?: string }; commit?: { hash?: string } };
    links?: { html?: { href?: string } };
  };
  repository?: { full_name?: string; mainbranch?: { name?: string } };
}

const bitbucket: GitProvider = {
  key: () => 'bitbucket',
  label: () => 'Bitbucket',
  matches: (h) => h['x-event-key'] != null,
  // Bitbucket signs the body with the webhook secret and sends the digest as
  // "sha256=<hex>" in X-Hub-Signature.
  verify: (secret, body, h) => hmacValid(secret, body, h['x-hub-signature']),
  deliveryId: (h) => h['x-request-uuid'] ?? h['x-request-id'],
  repo: (payload) => (payload as BitbucketPayload).repository?.full_name,
  parse: (payload, headers) => {
    const key = headers['x-event-key'];
    if (key === 'repo:branch_created' || key === 'repo:branch_deleted') {
      const value = payload as BitbucketPayload;
      const deleted = key === 'repo:branch_deleted';
      const change = value.push?.changes?.[0];
      const branch = value.branch ?? (deleted ? change?.old : change?.new);
      if (!branch?.name || !value.repository?.full_name) return null;
      return {
        kind: 'branch',
        action: deleted ? 'deleted' : 'created',
        repo: value.repository.full_name,
        branch: branch.name,
        url: httpUrl(branch.links?.html?.href),
        headSha: deleted ? null : (branch.target?.hash ?? null),
        defaultBranch: value.repository.mainbranch?.name ?? null,
      };
    }
    const opened = key === 'pullrequest:created';
    const merged = key === 'pullrequest:fulfilled';
    const closed = key === 'pullrequest:rejected';
    const updated = key === 'pullrequest:updated';
    if (!opened && !merged && !closed && !updated) return null;
    const { pullrequest: pr, repository } = payload as BitbucketPayload;
    if (!pr?.id || !repository?.full_name) return null;
    return {
      kind: 'pull_request',
      action: merged ? 'merged' : closed ? 'closed' : opened ? 'opened' : 'updated',
      number: pr.id,
      title: pr.title ?? '',
      body: pr.description ?? '',
      url: httpUrl(pr.links?.html?.href),
      repo: repository.full_name,
      sourceBranch: pr.source?.branch?.name ?? null,
      targetBranch: pr.destination?.branch?.name ?? '',
      headSha: pr.source?.commit?.hash ?? null,
      // Not part of the documented repository entity, so it is usually absent and
      // the merged-into-default-branch check is off for Bitbucket.
      defaultBranch: repository.mainbranch?.name ?? null,
      draft: pr.draft === true,
    };
  },
};

const PROVIDERS: GitProvider[] = [gitea, gitlab, bitbucket, github];

export function detectProvider(headers: DeliveryHeaders): GitProvider | null {
  return PROVIDERS.find((p) => p.matches(headers)) ?? null;
}
